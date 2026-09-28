import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './args.ts';
import { run } from './run.ts';
import type { Io } from './run.ts';

interface FakeIo extends Io {
  readonly files: Record<string, string>;
  outText(): string;
  errText(): string;
}

function fakeIo(files: Record<string, string>): FakeIo {
  const out: string[] = [];
  const err: string[] = [];
  return {
    files,
    read: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error('ENOENT: no such file, ' + path);
      return text;
    },
    write: (path, text) => {
      files[path] = text;
    },
    out: (text) => void out.push(text),
    err: (text) => void err.push(text),
    optionsFor: () => ({}),
    outText: () => out.join(''),
    errText: () => err.join(''),
  };
}

describe('CLI argument parsing', () => {
  test('defaults to printing the formatted document', () => {
    assert.deepEqual(parseArgs(['a.md']), { mode: 'stdout', files: ['a.md'] });
  });
  test('recognises check, write and diff', () => {
    assert.equal(parseArgs(['--check', 'a.md']).mode, 'check');
    assert.equal(parseArgs(['--write', 'a.md']).mode, 'write');
    assert.equal(parseArgs(['--diff', 'a.md']).mode, 'diff');
  });
  test('collects several files', () => {
    assert.deepEqual(parseArgs(['--check', 'a.md', 'b.md']).files, ['a.md', 'b.md']);
  });
  test('rejects two modes at once', () => {
    assert.throws(() => parseArgs(['--check', '--write', 'a.md']), /one of/i);
  });
  test('rejects an unknown flag', () => {
    assert.throws(() => parseArgs(['--wat', 'a.md']), /unknown/i);
  });
  test('help needs no files', () => {
    assert.equal(parseArgs(['--help']).mode, 'help');
  });
});

describe('CLI run', () => {
  test('stdout mode prints the formatted document', () => {
    const io = fakeIo({ 'a.md': '#标题\n' });
    assert.equal(run(['a.md'], io), 0);
    assert.equal(io.outText(), '# 标题\n');
  });
  test('check exits non-zero when a file would change', () => {
    const io = fakeIo({ 'a.md': '#标题\n' });
    assert.equal(run(['--check', 'a.md'], io), 1);
    assert.ok(io.errText().includes('a.md'));
    assert.equal(io.files['a.md'], '#标题\n', 'check must not write');
  });
  test('check exits zero when the file is already formatted', () => {
    assert.equal(run(['--check', 'a.md'], fakeIo({ 'a.md': '# A\n' })), 0);
  });
  test('write rewrites the file and exits zero', () => {
    const io = fakeIo({ 'a.md': '#标题\n' });
    assert.equal(run(['--write', 'a.md'], io), 0);
    assert.equal(io.files['a.md'], '# 标题\n');
  });
  test('write leaves a clean file untouched', () => {
    const io = fakeIo({ 'a.md': '# A\n' });
    assert.equal(run(['--write', 'a.md'], io), 0);
    assert.equal(io.files['a.md'], '# A\n');
  });
  test('diff prints the changed lines and exits non-zero', () => {
    const io = fakeIo({ 'a.md': '#标题\n' });
    assert.equal(run(['--diff', 'a.md'], io), 1);
    assert.ok(io.outText().includes('-#标题'));
    assert.ok(io.outText().includes('+# 标题'));
  });
  test('a missing file is an error, not a crash', () => {
    assert.equal(run(['nope.md'], fakeIo({})), 2);
  });
  test('no files at all is a usage error', () => {
    assert.equal(run([], fakeIo({})), 2);
  });
  test('help prints usage and exits zero', () => {
    const io = fakeIo({});
    assert.equal(run(['--help'], io), 0);
    assert.ok(io.outText().includes('fuxi-fmt'));
  });
  test('the project config drives the result', () => {
    const io: FakeIo = {
      ...fakeIo({ 'a.md': '- item\n' }),
      optionsFor: () => ({ list: { unorderedMarker: 'asterisks' } }),
    };
    assert.equal(io.read('a.md'), '- item\n');
    assert.equal(run(['--check', 'a.md'], io), 1);
  });
});
