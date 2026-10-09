/**
 * The fixture corpus: every nasty combination, byte-exact.
 *
 * AGENTS.md has required a corpus since the first draft, and .gitattributes has
 * marked one byte-exact since the first draft, and until now the directory held
 * three files, none of them Markdown. Every test in this package was a
 * hand-written case derived from the implementation, which is why a rule's blind
 * spot stayed invisible: the test asserted what the rule did, not what was
 * wanted.
 *
 * These files are inputs from outside the implementation. The first is the
 * author's own stress document; the second is a zoo of every protected region the
 * scanner knows. Both are compared byte for byte.
 *
 * Spec references: GRT-01, GRT-02.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { format, scanRegions } from './index.ts';
import { isBlockRegionKind } from './scan.ts';
import type { RegionKind } from './scan.ts';

const DIR = new URL('../test/fixtures/corpus/', import.meta.url);

const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.md') && !name.endsWith('.expected.md'))
  .sort();

const read = (name: string) => readFileSync(new URL(name, DIR), 'utf8');

/** The offset each line starts at. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** The 0-based line containing an offset, by walking the starts. */
function lineOfOffset(starts: readonly number[], offset: number): number {
  let line = 0;
  for (let i = 0; i < starts.length; i++) {
    if ((starts[i] ?? 0) > offset) break;
    line = i;
  }
  return line;
}

/**
 * The lines a rule must not touch: a block region occupies whole lines, and any
 * region that contains a line ending covers the lines it spans (SAFE-01 is a
 * promise about bytes, not about block kinds).
 */
function protectedLines(text: string): boolean[] {
  const starts = lineStarts(text);
  const out = new Array<boolean>(starts.length).fill(false);
  for (const region of scanRegions(text)) {
    const newline = text.indexOf('\n', region.start);
    const spansLines = newline !== -1 && newline < region.end;
    if (!isBlockRegionKind(region.kind) && !spansLines) continue;
    const from = lineOfOffset(starts, region.start);
    const to = lineOfOffset(starts, Math.max(region.start, region.end - 1));
    for (let i = from; i <= to; i++) out[i] = true;
  }
  return out;
}

/**
 * Every kind of protected region the scanner can report.
 *
 * Written as a record that must have a key for each member of the union, so
 * adding a region kind without adding it here - and therefore without adding a
 * fixture that exercises it - is a compile error rather than a quietly weaker
 * corpus.
 */
const ALL_KINDS: readonly RegionKind[] = Object.keys({
  frontMatter: true,
  fencedCode: true,
  indentedCode: true,
  htmlBlock: true,
  htmlComment: true,
  inlineCode: true,
  inlineMath: true,
  mathBlock: true,
  url: true,
  wikilink: true,
  mdx: true,
  linkSyntax: true,
  inlineHtml: true,
} satisfies Record<RegionKind, true>) as RegionKind[];

describe('the fixture corpus', () => {
  test('has inputs to run, or this file is checking nothing', () => {
    assert.ok(files.length >= 2, 'the corpus is empty');
  });

  for (const name of files) {
    const expectedName = name.replace(/\.md$/, '.expected.md');

    test(name + ' formats byte for byte as recorded', () => {
      const result = format(read(name));
      // A warning is not the guard tripping, and the corpus is about the bytes: a
      // warning does not change them. user-notes.md legitimately warns - DET-11,
      // because its own "  - ok" falls out of the list above it - which is the
      // very report that round of work came from.
      assert.deepEqual(
        result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
        [],
        'the corpus must not be refused',
      );
      assert.equal(result.output, read(expectedName));
    });

    test(name + ' is already formatted once formatted', () => {
      const expected = read(expectedName);
      assert.equal(format(expected).output, expected, 'not idempotent');
    });
  }

  test('covers every protected region the scanner has', () => {
    // The charter says the corpus covers every protected region. This is the
    // difference between a corpus and a pile of files.
    const seen = new Set<RegionKind>();
    for (const name of files) {
      for (const region of scanRegions(read(name))) seen.add(region.kind);
    }
    const missing = ALL_KINDS.filter((kind) => !seen.has(kind));
    assert.deepEqual(missing, [], 'no corpus file exercises: ' + missing.join(', '));
  });

  test('no diagnostic points into a protected region', () => {
    // A rule that fires inside code, front matter or a comment read the document
    // wrong. The guard refuses a document whose regions *changed*, but a warning
    // inside a region passed every check there was: DET-12 read a fence body as a
    // list and warned that the fence contained a protected block. This is the
    // assertion that catches that class, and it is why every region kind needs a
    // fixture with a body that looks like a list.
    for (const name of files) {
      const protectedLine = protectedLines(read(name));
      for (const diagnostic of format(read(name)).diagnostics) {
        if (diagnostic.line === undefined) continue;
        assert.equal(
          protectedLine[diagnostic.line],
          false,
          name + ':' + String(diagnostic.line + 1) + ' ' + diagnostic.ruleId +
            ' points inside a protected region',
        );
      }
    }
  });

  test('the protection claim is verified, not assumed', () => {
    // Byte-exact golden files would pass even if every region were mangled, as
    // long as the recorded output was the mangled one. This compares the regions
    // themselves: same kinds, same order, same bytes - except a fenced
    // delimiter, which BLK-10 may resize, and BLK-12's edge blank lines.
    for (const name of files) {
      const expectedName = name.replace(/\.md$/, '.expected.md');
      const before = scanRegions(read(name));
      const after = scanRegions(read(expectedName));
      assert.equal(after.length, before.length, name + ': region count changed');
      for (let i = 0; i < before.length; i++) {
        const a = before[i];
        const b = after[i];
        if (a === undefined || b === undefined) continue;
        assert.equal(b.kind, a.kind, name + ': region ' + String(i) + ' changed kind');
        const slice = (text: string, region: { start: number; end: number }) =>
          text.slice(region.start, region.end);
        if (a.kind === 'fencedCode') {
          const body = (text: string, region: { start: number; end: number }) =>
            slice(text, region)
              .replace(/^[ \t]*[`~]{3,}/, '')
              .replace(/[`~]{3,}[ \t]*$/, '')
              .replace(/^(?:[ \t]*\n)+/, '')
              .replace(/(?:\n[ \t]*)+$/, '');
          assert.equal(body(read(expectedName), b), body(read(name), a), name + ': fence body changed');
        } else {
          assert.equal(slice(read(expectedName), b), slice(read(name), a), name + ': ' + a.kind + ' changed');
        }
      }
    }
  });
});
