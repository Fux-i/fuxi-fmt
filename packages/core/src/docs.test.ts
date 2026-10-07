import { execFileSync } from 'node:child_process';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { defaultOptions } from './options.ts';

/**
 * Documentation drifts silently. No typecheck, test or guard notices that the
 * changelog is two releases behind or that the specification describes an
 * option as missing after it shipped - both of which happened here.
 *
 * These two checks are deliberately narrow. They do not try to verify prose;
 * they verify the two mechanical claims that rotted.
 */

const root = new URL('../../../', import.meta.url).pathname;
const spec = readFileSync(join(root, 'FUXI-FMT-SPEC.md'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const contributing = readFileSync(join(root, 'CONTRIBUTING.md'), 'utf8');
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

/**
 * Markers, not prose. A check that matches an English sentence breaks the day
 * the document is written in another language - which is what happened here.
 * An HTML comment is invisible in the rendered document and survives every
 * rewrite of the sentence around it. Mid-line on purpose: a comment at the
 * start of a line is an HTML block, and these documents are their own test
 * corpus.
 */
const NOT_IMPLEMENTED = '<!-- fuxi-fmt:not-implemented -->';
const PARTIALLY_IMPLEMENTED = '<!-- fuxi-fmt:partially-implemented -->';
/** A document that admits it has gaps carries this. */
const WORK_IN_PROGRESS = '<!-- fuxi-fmt:work-in-progress -->';

describe('documentation stays true to the code', () => {
  test('everything the specification calls unimplemented really is', () => {
    // Anchored on a marker rather than on prose, so a partially implemented
    // option can be described honestly without tripping the check, and so the
    // check still reads the document after the sentence is rewritten.
    const after = anchoredAfter(spec, NOT_IMPLEMENTED);
    const paragraph = after.split(PARTIALLY_IMPLEMENTED)[0] ?? '';
    // An empty list is legitimate: it means everything is implemented. What
    // matters is that nothing named here is secretly present in the defaults.
    const claimed = [...paragraph.matchAll(/`(typography|list)\.([A-Za-z]+)`/g)];

    for (const match of claimed) {
      const section = match[1] ?? '';
      const name = match[2] ?? '';
      const bag = (defaultOptions as unknown as Record<string, Record<string, unknown>>)[section];
      const present = bag !== undefined && Object.prototype.hasOwnProperty.call(bag, name);
      assert.equal(
        present,
        false,
        section + '.' + name + ' is listed as unimplemented but is implemented',
      );
    }
  });

  /** Numeric x.y.z comparison: -1, 0 or 1. Lexicographic order puts 0.9 after 0.10. */
  function compareVersions(a: string, b: string): number {
    const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const l = left[i] ?? 0;
      const r = right[i] ?? 0;
      if (l !== r) return l < r ? -1 : 1;
    }
    return 0;
  }

  /** The newest release tag, or null when nothing is comparable. */
  function newestTag(): string | null {
    const tags = spawnSync('git', ['tag', '-l'], { cwd: root, encoding: 'utf8' });
    if (tags.status !== 0) return null;
    const versions = tags.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^v\d/.test(line));
    // A shallow clone may have no tags at all; there is nothing to compare.
    if (versions.length === 0) return null;
    return versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1) ?? null;
  }

  test('no document calls shipped work unfinished', () => {
    // The specification was checked from the start; the readme was not, and it
    // drifted: it listed four typography options as outstanding long after each
    // had shipped, and still claimed 173 tests at 254.
    //
    // The readme no longer keeps a list at all - the specification's anchored
    // list is the only one - so what is left to check is the prose. A sentence
    // admitting unfinished work must not name an option or a rule that has
    // shipped. Narrow by construction: it only sees lines that use the phrase,
    // and only option names and rule IDs on them.
    const admits = (text: string) =>
      text.split('\n').filter((line) => /未实现|尚未实现|待实现|还没实现/.test(line));
    const lines = [...admits(readme), ...admits(contributing)];
    assert.ok(lines.length > 0, 'expected a document to admit what is not finished');

    for (const line of lines) {
      for (const match of line.matchAll(/`([A-Za-z]+)\.([A-Za-z]+)`/g)) {
        const section = match[1] ?? '';
        const name = match[2] ?? '';
        const bag = (defaultOptions as unknown as Record<string, Record<string, unknown>>)[section];
        const present = bag !== undefined && Object.prototype.hasOwnProperty.call(bag, name);
        assert.equal(
          present,
          false,
          'a document calls ' + section + '.' + name + ' unfinished, but it is implemented',
        );
      }
      // A rule ID on such a line is the same claim in a form that is easy to
      // miss. Every rule the specification declares is implemented, so an ID
      // here means the sentence is stale - and if a rule is ever genuinely
      // withdrawn, this assertion is where that has to be said out loud.
      const rules = [...line.matchAll(/\b([A-Z]{2,4}-\d{2})\b/g)].map((m) => m[1] ?? '');
      assert.deepEqual(
        rules,
        [],
        'a document calls ' + rules.join(', ') + ' unfinished; if a rule really is unfinished, say so in the specification first',
      );
    }
  });

  test('every option the specification documents is implemented or declared missing', () => {
    // The inverse of the check above, and the one that had never been run: the
    // specification documented nine options that nothing implements, including
    // all four ignore directives. A user setting any of them got silence.
    const block = (spec.split('```yaml')[1] ?? '').split('```')[0] ?? '';
    assert.ok(block.length > 0, 'the specification has no config block');

    const declared = new Set(
      [...anchoredAfter(spec, NOT_IMPLEMENTED).matchAll(/`([A-Za-z]+)\.([A-Za-z]+)`/g)].map(
        (match) => (match[1] ?? '') + '.' + (match[2] ?? ''),
      ),
    );

    const bags = defaultOptions as unknown as Record<string, Record<string, unknown>>;
    let section = '';
    let checked = 0;

    for (const raw of block.split('\n')) {
      const line = raw.replace(/#.*$/, '');
      if (line.trim().length === 0) continue;
      const top = /^([A-Za-z][A-Za-z0-9]*):/.exec(line);
      if (top !== null) {
        section = top[1] ?? '';
        continue;
      }
      const nested = /^ {2}([A-Za-z][A-Za-z0-9]*):/.exec(line);
      if (nested === null || section.length === 0) continue;
      const name = nested[1] ?? '';
      const key = section + '.' + name;
      checked++;
      const bag = bags[section];
      const present = bag !== undefined && Object.prototype.hasOwnProperty.call(bag, name);
      assert.ok(
        present || declared.has(key),
        'the specification documents ' + key + ' but nothing implements it',
      );
    }

    assert.ok(checked >= 20, 'expected to check many keys, saw ' + String(checked));
  });

  /** The text that follows an anchor, up to the blank line that ends its paragraph. */
  function anchoredAfter(text: string, anchor: string): string {
    const marker = text.indexOf(anchor);
    assert.ok(marker > -1, 'no "' + anchor + '" anchor found');
    return text.slice(marker + anchor.length).split('\n\n')[0] ?? '';
  }

  /** The options a document declares as not implemented at all. */
  function declaredMissing(text: string): string[] {
    // Stop at the anchor that follows in the same paragraph: the specification
    // puts "partially implemented" right after the list, and the readme keeps
    // prose below it.
    const paragraph = anchoredAfter(text, NOT_IMPLEMENTED).split(PARTIALLY_IMPLEMENTED)[0] ?? '';
    return [...paragraph.matchAll(/`([A-Za-z]+)\.([A-Za-z]+)`/g)]
      .map((match) => (match[1] ?? '') + '.' + (match[2] ?? ''))
      .sort();
  }

  test('only the specification enumerates what is missing', () => {
    // Two documents claiming the same thing is exactly the arrangement that
    // drifts, and this pair drifted twice. The specification's anchored list is
    // checked against the defaults above; it is the only list, and this is what
    // keeps it that way.
    assert.ok(!readme.includes(NOT_IMPLEMENTED), 'the readme must not carry the missing list');
    assert.ok(
      !contributing.includes(NOT_IMPLEMENTED),
      'CONTRIBUTING.md must not carry the missing list',
    );
  });

  test('every command the contributor guide names actually exists', () => {
    // The development block had drifted: it said 'npm install' where CI runs
    // 'npm ci', described typecheck as 'tsc --noEmit', and never mentioned
    // 'npm run build' at all. None of that fails a test, and all of it misleads
    // a reader. This is the cheapest possible check for that class. The block
    // lives in CONTRIBUTING.md now; the readme is for users.
    const parsed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = new Set(Object.keys(parsed.scripts ?? {}));

    const required = new Set<string>();
    // An npm script name may contain a digit - 'l10n' is the conventional one for
    // this job - and the pattern used to stop at the first one, reading it as 'l'
    // and then claiming the readme named a script that does not exist.
    for (const match of contributing.matchAll(/npm run ([a-z][a-z0-9:._-]*)/g)) {
      required.add(match[1] ?? '');
    }
    if (/npm test\b/.test(contributing)) required.add('test');

    // 'npm ci' and 'npm install' are npm's own subcommands, not scripts.
    assert.ok(required.size >= 3, 'expected the guide to name several commands');

    for (const name of required) {
      assert.ok(
        scripts.has(name),
        'the guide names "npm run ' + name + '" but no such script exists',
      );
    }
  });

  test('the contributor guide installs the way CI installs', () => {
    // I claimed last round that this had no mechanical check. It does: the
    // workflow file says which command CI runs, and the guide says which one a
    // contributor should run. They are two statements of the same fact.
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const ciUses = /npm ci\b/.test(workflow) ? 'npm ci' : /npm install\b/.test(workflow) ? 'npm install' : null;
    assert.ok(ciUses !== null, 'the CI workflow installs nothing?');

    const guideMentions = new RegExp(ciUses.replace(' ', '\\s+') + '\\b');
    assert.ok(
      guideMentions.test(contributing),
      'CI runs "' + ciUses + '" but the guide never mentions it',
    );
  });

  test('the contributor guide documents every script CI runs', () => {
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const scripts = new Set(
      Object.keys(
        (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
          scripts?: Record<string, string>;
        }).scripts ?? {},
      ),
    );
    let seen = 0;
    for (const match of workflow.matchAll(/npm run ([a-z][a-z0-9:._-]*)/g)) {
      const name = match[1] ?? '';
      if (!scripts.has(name)) continue;
      seen++;
      assert.ok(
        new RegExp('npm run ' + name + '\\b').test(contributing),
        'CI runs "npm run ' + name + '" but the guide does not document it',
      );
    }
    assert.ok(seen > 0, 'expected CI to run at least one script');
  });

  test('every option the code has is documented in the specification', () => {
    // The inverse of the audit above, which asks whether documented options
    // exist. This asks whether existing options are documented - an option the
    // specification never mentions is one nobody can discover.
    const block = (spec.split('```yaml')[1] ?? '').split('```')[0] ?? '';
    assert.ok(block.length > 0, 'the specification has no config block');

    // Option bags nest (`typography.emphasis.strong`, `table.mode`), so the block
    // is read by indentation rather than by "one level and no more": a rule that
    // documents only its top level would otherwise pass while listing nothing.
    const documented = new Set<string>();
    const stack: { indent: number; path: string }[] = [];
    for (const raw of block.split('\n')) {
      const line = raw.replace(/#.*$/, '');
      if (line.trim().length === 0) continue;
      const match = /^(\s*)([A-Za-z][A-Za-z0-9]*):/.exec(line);
      if (match === null) continue;
      const indent = (match[1] ?? '').length;
      const name = match[2] ?? '';
      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= indent) stack.pop();
      const parent = stack[stack.length - 1];
      const path = parent === undefined ? name : parent.path + '.' + name;
      stack.push({ indent, path });
      documented.add(path);
    }

    const bags = defaultOptions as unknown as Record<string, unknown>;
    let checked = 0;
    for (const [name, value] of Object.entries(bags)) {
      if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value as Record<string, unknown>)) {
          checked++;
          assert.ok(
            documented.has(name + '.' + key),
            'the code has ' + name + '.' + key + ' but the specification does not document it',
          );
        }
      } else {
        checked++;
        assert.ok(
          documented.has(name),
          'the code has ' + name + ' but the specification does not document it',
        );
      }
    }
    assert.ok(checked >= 15, 'expected to check many options, saw ' + String(checked));
  });

  test('a document with gaps says so where a reader looks first', () => {
    // Every other check here compares one artifact to another: spec to readme,
    // manifests to tags, workflow to readme. This one compares a document to
    // itself, which is how the status line once came to say "every option it
    // names" while five unimplemented options were listed four paragraphs below
    // it. The narrow half of that gap: if the specification declares gaps, the
    // documents a reader opens first must admit them.
    if (declaredMissing(spec).length === 0) return;

    assert.ok(
      readme.includes(WORK_IN_PROGRESS),
      'the specification declares gaps but the readme does not admit being unfinished',
    );
    assert.ok(
      contributing.includes(WORK_IN_PROGRESS),
      'the specification declares gaps but CONTRIBUTING.md does not admit being unfinished',
    );
  });

  test('unreleased work is recorded, or there is none', () => {
    // The changelog check above asserts the newest TAG has an entry, so its frame
    // is tag -> entry and untagged work falls outside it entirely. That is how
    // '[Unreleased] Nothing yet.' survived nine commits.
    // This used to assert that a tag existed, which tested the environment rather
    // than the changelog: a source tarball, a shallow clone and GitHub Actions'
    // default checkout all have no tags, so the suite was red on every CI run for
    // two releases while staying green on every machine that had ever fetched
    // tags. The workflow fetches them now, so the check runs where it matters; a
    // tagless clone has no baseline and says so instead of failing.
    const newest = newestTag();
    if (newest === null) return;

    const subjects = execFileSync('git', ['log', '--format=%s', newest + '..HEAD'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((line) => line.length > 0);
    const substantive = subjects.filter((line) => /^(feat|fix|perf)[(:]/.test(line));

    const unreleased = (changelog.split('## [Unreleased]')[1] ?? '').split('## [')[0] ?? '';
    if (substantive.length > 0) {
      assert.ok(
        !/Nothing yet/.test(unreleased),
        String(substantive.length) + ' unreleased feature commits but the changelog says nothing yet',
      );
    }
  });

  test('the changelog has an entry for the newest tag', () => {
    const newest = newestTag();
    if (newest === null) return;
    const version = newest.replace(/^v/, '');
    // The heading now links to its own diff, so the version is followed by
    // "](url)" rather than by "]" - the old substring test read false on every
    // release once that landed. Anchored at the line start and with the dots
    // escaped, because an unescaped version is a regex.
    const heading = new RegExp('^## \\[' + version.replace(/\./g, '\\.') + '\\]', 'm');
    assert.ok(heading.test(changelog), 'the changelog has no entry for ' + newest);
  });

  test('an older version is what the tag check rejects', () => {
    // The comparison is numeric, not lexicographic: 0.9.0 precedes 0.10.0.
    assert.equal(compareVersions('0.9.0', '0.10.0'), -1);
    assert.equal(compareVersions('0.24.0', '0.25.0'), -1);
    assert.equal(compareVersions('0.25.0', '0.25.0'), 0);
    assert.equal(compareVersions('0.26.0', '0.25.0'), 1);
  });

  test('the published package version tracks the newest tag', () => {
    const newest = newestTag();
    if (newest === null) return;
    const version = newest.replace(/^v/, '');
    // packages/vscode is the one a marketplace would read a version from.
    for (const file of ['package.json', 'packages/core/package.json', 'packages/cli/package.json', 'packages/vscode/package.json']) {
      const parsed = JSON.parse(readFileSync(join(root, file), 'utf8')) as { version?: string };
      const found = parsed.version ?? '';
      // The direction matters, and equality was the wrong test. A package OLDER
      // than the newest tag contradicts its release: the tag is published and the
      // manifest is not - that is the bug this check exists for. A package NEWER
      // than the newest tag is the release sequence working: the version is bumped,
      // the commit is pushed, and the tag is pushed next, and tag pushes do not
      // trigger this workflow. Demanding equality made CI red on a commit that was
      // already correct, with a message about a version mismatch that did not
      // exist - which is exactly what happened on the v0.25.0 release.
      assert.ok(
        compareVersions(found, version) >= 0,
        file + ' says ' + found + ' but ' + newest + ' is already released',
      );
    }
  });
});
