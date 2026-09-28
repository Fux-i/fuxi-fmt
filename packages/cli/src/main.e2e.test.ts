import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The unit tests inject a fake Io, so `main.ts` and `fileIo` - the parts that
 * actually touch a disk and a process - were never executed. This runs the real
 * entry point as a child process.
 *
 * Scratch files live in `dist/`, which is gitignored, so a failing run cannot
 * dirty the tree.
 */

const here = new URL('.', import.meta.url).pathname;
const entry = join(here, 'main.ts');
const scratch = join(here, '..', 'dist');
const fixture = join(scratch, 'e2e-fixture.md');

function cli(args: readonly string[]) {
  return spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8' });
}

describe('CLI as a real process', () => {
  mkdirSync(scratch, { recursive: true });

  test('--check exits 1 and says why', () => {
    writeFileSync(fixture, '#标题\n');
    const result = cli(['--check', fixture]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /would be reformatted/);
  });

  test('--write rewrites the file and exits 0', () => {
    writeFileSync(fixture, '#标题\n');
    const result = cli(['--write', fixture]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(fixture, 'utf8'), '# 标题\n');
  });

  test('--check then exits 0 on the rewritten file', () => {
    assert.equal(cli(['--check', fixture]).status, 0);
  });

  test('--diff prints the change and exits 1', () => {
    writeFileSync(fixture, '#标题\n');
    const result = cli(['--diff', fixture]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /-\#标题/);
    assert.match(result.stdout, /\+# 标题/);
  });

  test('a missing file exits 2 without a stack trace', () => {
    const result = cli([join(scratch, 'does-not-exist.md')]);
    assert.equal(result.status, 2);
    assert.doesNotMatch(result.stderr, /at Object\./);
    assert.match(result.stderr, /ENOENT|no such file/i);
  });

  test('no arguments prints usage and exits 2', () => {
    const result = cli([]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });

  test('--help exits 0', () => {
    const result = cli(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /fuxi-fmt/);
  });

  after(() => rmSync(scratch, { recursive: true, force: true }));
});
