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
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

describe('documentation stays true to the code', () => {
  test('everything the specification calls unimplemented really is', () => {
    // Anchored on an explicit phrase rather than on prose, so a partially
    // implemented option can be described honestly without tripping the check.
    const marker = spec.indexOf('**Not implemented at all:**');
    assert.ok(marker > -1, 'the specification has no "not implemented at all" note');

    const after = spec.slice(marker + '**Not implemented at all:**'.length);
    const paragraph = after.split('**Partially implemented:**')[0] ?? '';
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

  test('the readme does not call an implemented option outstanding', () => {
    // The specification was checked from the start; the readme was not, and it
    // drifted: it listed four typography options as outstanding long after each
    // had shipped, and still claimed 173 tests at 254.
    const lines = readme.split('\n').filter((line) => /outstanding/i.test(line));
    assert.ok(lines.length > 0, 'expected the readme to state what is outstanding');

    for (const line of lines) {
      for (const match of line.matchAll(/`([A-Za-z]+)\.([A-Za-z]+)`/g)) {
        const section = match[1] ?? '';
        const name = match[2] ?? '';
        const bag = (defaultOptions as unknown as Record<string, Record<string, unknown>>)[section];
        const present = bag !== undefined && Object.prototype.hasOwnProperty.call(bag, name);
        assert.equal(
          present,
          false,
          'the readme calls ' + section + '.' + name + ' outstanding, but it is implemented',
        );
      }
    }
  });

  test('every option the specification documents is implemented or declared missing', () => {
    // The inverse of the check above, and the one that had never been run: the
    // specification documented nine options that nothing implements, including
    // all four ignore directives. A user setting any of them got silence.
    const block = (spec.split('```yaml')[1] ?? '').split('```')[0] ?? '';
    assert.ok(block.length > 0, 'the specification has no config block');

    const declared = new Set(
      [
        ...(spec.slice(spec.indexOf('**Not implemented at all:**')).split('\n\n')[0] ?? '').matchAll(
          /`([A-Za-z]+)\.([A-Za-z]+)`/g,
        ),
      ].map((match) => (match[1] ?? '') + '.' + (match[2] ?? '')),
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

  /** The options a document declares as not implemented at all. */
  function declaredMissing(text: string): string[] {
    const marker = text.indexOf('**Not implemented at all:**');
    assert.ok(marker > -1, 'no "not implemented at all" note found');
    const after = text.slice(marker + '**Not implemented at all:**'.length);
    // Stop at a blank line or at the sentence that follows in the same
    // paragraph, whichever comes first: the specification puts "partially
    // implemented" right after the list, and the readme keeps prose below it.
    const paragraph = after.split(/\n\n|\*\*Partially/)[0] ?? '';
    return [...paragraph.matchAll(/`([A-Za-z]+)\.([A-Za-z]+)`/g)]
      .map((match) => (match[1] ?? '') + '.' + (match[2] ?? ''))
      .sort();
  }

  test('the readme and the specification agree on what is missing', () => {
    // Two documents claiming the same thing is exactly the arrangement that
    // drifts. Requiring them to agree means neither can rot alone.
    assert.deepEqual(declaredMissing(readme), declaredMissing(spec));
  });

  test('every command the readme names actually exists', () => {
    // The readme's development block had drifted: it said 'npm install' where CI
    // runs 'npm ci', described typecheck as 'tsc --noEmit', and never mentioned
    // 'npm run build' at all. None of that fails a test, and all of it misleads
    // a reader. This is the cheapest possible check for that class.
    const parsed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = new Set(Object.keys(parsed.scripts ?? {}));

    const required = new Set<string>();
    for (const match of readme.matchAll(/npm run ([a-z][a-z:-]*)/g)) required.add(match[1] ?? '');
    if (/npm test\b/.test(readme)) required.add('test');

    // 'npm ci' and 'npm install' are npm's own subcommands, not scripts.
    assert.ok(required.size >= 3, 'expected the readme to name several commands');

    for (const name of required) {
      assert.ok(scripts.has(name), 'the readme names "npm run ' + name + '" but no such script exists');
    }
  });

  test('the readme installs the way CI installs', () => {
    // I claimed last round that this had no mechanical check. It does: the
    // workflow file says which command CI runs, and the readme says which one a
    // contributor should run. They are two statements of the same fact.
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const ciUses = /npm ci\b/.test(workflow) ? 'npm ci' : /npm install\b/.test(workflow) ? 'npm install' : null;
    assert.ok(ciUses !== null, 'the CI workflow installs nothing?');

    const readmeMentions = new RegExp(ciUses.replace(' ', '\\s+') + '\\b');
    assert.ok(
      readmeMentions.test(readme),
      'CI runs "' + ciUses + '" but the readme never mentions it',
    );
  });

  test('the readme documents every script CI runs', () => {
    const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const scripts = new Set(
      Object.keys(
        (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
          scripts?: Record<string, string>;
        }).scripts ?? {},
      ),
    );
    let seen = 0;
    for (const match of workflow.matchAll(/npm run ([a-z][a-z:-]*)/g)) {
      const name = match[1] ?? '';
      if (!scripts.has(name)) continue;
      seen++;
      assert.ok(
        new RegExp('npm run ' + name + '\\b').test(readme),
        'CI runs "npm run ' + name + '" but the readme does not document it',
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

    const documented = new Set<string>();
    let section = '';
    for (const raw of block.split('\n')) {
      const line = raw.replace(/#.*$/, '');
      if (line.trim().length === 0) continue;
      const top = /^([A-Za-z][A-Za-z0-9]*):/.exec(line);
      if (top !== null) {
        section = top[1] ?? '';
        documented.add(section);
        continue;
      }
      const nested = /^ {2}([A-Za-z][A-Za-z0-9]*):/.exec(line);
      if (nested !== null && section.length > 0) documented.add(section + '.' + (nested[1] ?? ''));
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

  test('unreleased work is recorded, or there is none', () => {
    // The changelog check above asserts the newest TAG has an entry, so its frame
    // is tag -> entry and untagged work falls outside it entirely. That is how
    // '[Unreleased] Nothing yet.' survived nine commits.
    const tags = execFileSync('git', ['tag', '-l'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((tag) => tag.length > 0)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const newest = tags[tags.length - 1];
    assert.ok(newest !== undefined, 'expected at least one tag');

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
    assert.ok(
      changelog.includes('## [' + version + ']'),
      'the changelog has no entry for ' + newest,
    );
  });

  test('the published package version tracks the newest tag', () => {
    const newest = newestTag();
    if (newest === null) return;
    const version = newest.replace(/^v/, '');
    // packages/vscode is the one a marketplace would read a version from.
    for (const file of ['package.json', 'packages/core/package.json', 'packages/cli/package.json', 'packages/vscode/package.json']) {
      const parsed = JSON.parse(readFileSync(join(root, file), 'utf8')) as { version?: string };
      assert.equal(parsed.version, version, file + ' does not match ' + newest);
    }
  });
});
