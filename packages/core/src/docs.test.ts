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
      for (const match of line.matchAll(/`(typography|list)\.([A-Za-z]+)`/g)) {
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
