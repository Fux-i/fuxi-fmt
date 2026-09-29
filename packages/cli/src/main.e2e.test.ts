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

  // Remove only this block's fixture. Deleting all of dist/ would wipe the next
  // block's configuration fixture, which is created during collection before
  // either block's tests run.
  after(() => rmSync(fixture, { force: true }));
});

describe('the real entry point discovers configuration', () => {
  mkdirSync(scratch, { recursive: true });
  const dir = join(scratch, 'config-probe');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'fuxi-fmt.json'), '{ "list": { "unorderedMarker": "asterisks" } }');
  const doc = join(dir, 'doc.md');

  test('a config file beside the document changes the result', () => {
    writeFileSync(doc, '- item\n');
    assert.equal(cli(['--write', doc]).status, 0);
    assert.equal(readFileSync(doc, 'utf8'), '* item\n');
  });

  test('the same file is then clean, so discovery is stable', () => {
    assert.equal(cli(['--check', doc]).status, 0);
  });

  test('a relative path resolves against the working directory', () => {
    writeFileSync(doc, '- item\n');
    const result = spawnSync(process.execPath, [entry, '--write', 'doc.md'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(readFileSync(doc, 'utf8'), '* item\n');
  });

  test('without the config the default marker is used', () => {
    const bare = join(scratch, 'bare');
    mkdirSync(bare, { recursive: true });
    const file = join(bare, 'doc.md');
    writeFileSync(file, '* item\n');
    assert.equal(cli(['--write', file]).status, 0);
    assert.equal(readFileSync(file, 'utf8'), '- item\n');
  });

  after(() => rmSync(join(scratch, 'config-probe'), { recursive: true, force: true }));
});

describe('the entry point respects the ignore-file directive', () => {
  mkdirSync(scratch, { recursive: true });
  const ignored = join(scratch, 'ignored.md');
  const source = '<!-- fuxi-fmt-ignore-file -->\n#标题\n\n本项目 使用Vue3开发\n';

  test('--check reports nothing to do', () => {
    writeFileSync(ignored, source);
    const result = cli(['--check', ignored]);
    assert.equal(result.status, 0, 'an ignored file should need no formatting');
    assert.equal(result.stderr, '');
  });

  test('--write leaves the file byte for byte', () => {
    writeFileSync(ignored, source);
    assert.equal(cli(['--write', ignored]).status, 0);
    assert.equal(readFileSync(ignored, 'utf8'), source);
  });

  test('--diff prints nothing', () => {
    assert.equal(cli(['--diff', ignored]).stdout, '');
  });

  after(() => rmSync(ignored, { force: true }));
});
