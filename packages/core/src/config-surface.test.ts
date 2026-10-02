/**
 * The fuxi-fmt.json surface, option by option.
 *
 * A unit test for the reader is not enough. The failure this guards against is an
 * option that exists in the defaults, is read by the formatter, and is never
 * parsed from a config file - so setting it produces silence. That happened four
 * times in this repository, and one of those, list.indentWidth, sat in the
 * defaults doing nothing for twenty releases.
 *
 * Every leaf of defaultOptions therefore needs a JSON sample here, and the table
 * is compared against the defaults in both directions, so adding an option
 * without adding a row fails the suite rather than shipping silent.
 *
 * The editor half of the same surface is audited by settings.test.ts.
 *
 * Spec references: CFG-01, CFG-02.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from './config.ts';
import { defaultOptions } from './options.ts';
import type { FormatOptionsInput } from './options.ts';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Set)
  );
}

/** Every leaf of an options tree, as 'section.leaf' paths. */
function leaves(node: unknown, prefix = ''): string[] {
  if (!isPlainObject(node)) return prefix === '' ? [] : [prefix];
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    out.push(...leaves(value, prefix === '' ? key : prefix + '.' + key));
  }
  return out;
}

/**
 * A value *different from the default* for every leaf, so a key the reader
 * ignored entirely cannot pass by accident. A sample equal to the default is a
 * test of nothing.
 */
const SAMPLES: Record<string, unknown> = {
  'blankLines.aroundBlocks': 'atLeast',
  'blankLines.maxConsecutive': 3,
  'blankLines.insideLists': 'preserve',
  'typography.cjkSpacing': false,
  'typography.punctuationStyle': 'halfwidth',
  'typography.punctuationChangeList': [',', ';'],
  'typography.halfwidthAlphanumerics': false,
  'typography.ideographicSpace': false,
  'typography.hashtag': true,
  'typography.parenStyle': 'preserve',
  'typography.context': 'adjacent',
  'typography.quotes': 'preserve',
  'typography.cjkClasses': ['han', 'kana'],
  'typography.spacingSymbols': ['%', '\u00a7'],
  'list.orderedStyle': 'renumber',
  'list.orderedDelimiter': ')',
  'list.orderedIndent': 4,
  'list.unorderedIndent': 3,
  'list.tabWidth': 4,
  'list.unorderedMarker': 'asterisks',
  'codeBlock.fenceChar': 'tildes',
  'codeBlock.fenceLength': false,
  endOfLine: 'crlf',
  'ignore.file': 'no-format-file',
  'ignore.start': 'no-format-start',
  'ignore.end': 'no-format-end',
  'ignore.line': 'no-format-line',
};

/** The nested config object a 'section.leaf' path describes. */
function nest(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.');
  const root: Record<string, unknown> = {};
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next: Record<string, unknown> = {};
    node[parts[i] ?? ''] = next;
    node = next;
  }
  node[parts[parts.length - 1] ?? ''] = value;
  return root;
}

function read(parsed: FormatOptionsInput, path: string): unknown {
  let node: unknown = parsed;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe('CFG-01 the fuxi-fmt.json surface', () => {
  test('the sample table covers every option, and no others', () => {
    assert.deepEqual(Object.keys(SAMPLES).sort(), leaves(defaultOptions).sort());
  });

  for (const [path, value] of Object.entries(SAMPLES)) {
    test('a config file can set ' + path, () => {
      const parsed = parseConfig(JSON.stringify(nest(path, value)));
      assert.deepEqual(read(parsed, path), value);
    });
  }

  // A table of samples that happen to equal the defaults would pass while the
  // reader ignored every key, which is the exact failure being guarded against.
  test('every sample differs from its default, or the row tests nothing', () => {
    const flat = (value: unknown): unknown => {
      if (value instanceof Set) return [...value].sort();
      if (Array.isArray(value)) return [...value].sort();
      return value;
    };
    for (const [path, value] of Object.entries(SAMPLES)) {
      const fallback = read(defaultOptions as unknown as FormatOptionsInput, path);
      assert.notDeepEqual(flat(value), flat(fallback), path + ': sample equals its default');
    }
  });

  test('maxConsecutive accepts null, which means unbounded', () => {
    const parsed = parseConfig('{"blankLines":{"maxConsecutive":null}}');
    assert.equal(parsed.blankLines?.maxConsecutive, null);
  });

  test('a boolean key rejects a non-boolean rather than ignoring it', () => {
    assert.throws(() => parseConfig('{"typography":{"cjkSpacing":"yes"}}'), /must be true or false/);
  });

  test('an unknown key is ignored, so a config from a later version still loads', () => {
    const parsed = parseConfig('{"typography":{"cjkSpacing":false},"future":{"thing":1}}');
    assert.equal(parsed.typography?.cjkSpacing, false);
  });
});
