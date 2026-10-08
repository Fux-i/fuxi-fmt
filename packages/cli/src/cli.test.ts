import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { english } from '../../core/src/index.ts';
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

describe('CLI warnings and notices', () => {
  test('a warning is reported but does not fail the run', () => {
    // stdout mode, not --check: --check exits 1 for a file that would change, and
    // the point here is that the warning itself does not add to that.
    const io = fakeIo({ 'a.md': '#  Title\n\n他说 "你好 了\n' });
    const code = run(['a.md'], io);
    assert.equal(code, 0, 'a warning is not a failure');
    assert.match(io.errText(), /TYPO-11/);
    assert.match(io.errText(), /warning/);
  });
  test('a diagnostic is one machine-readable line: path, line, severity, rule', () => {
    // The shape every compiler uses, so an editor or a CI log can pick it up. The
    // line is the one in the file on disk - the quote is on the third line, and
    // the blank-line policy adding one is the formatter's problem, not the
    // reader's.
    const io = fakeIo({ 'a.md': '#  Title\n\n他说 "你好 了\n' });
    run(['a.md'], io);
    assert.match(io.errText(), /^a\.md:3: warning: TYPO-11 /m);
  });
  test('an error still fails the run', () => {
    // An opening fence longer than the closing one is not a fence pair, and the
    // guard refuses the document rather than guessing.
    const io = fakeIo({ 'a.md': '\u0060\u0060\u0060\u0060js\ncode\n\u0060\u0060\u0060\n' });
    const code = run(['--check', 'a.md'], io);
    assert.equal(code, 2);
  });
  test('--explain says where the configuration came from and what changed', () => {
    const io = fakeIo({ 'a.md': '#  Title\n' });
    const code = run(['--explain', 'a.md'], io);
    assert.equal(code, 0);
    assert.match(io.errText(), /config: none, using the defaults/);
    assert.match(io.errText(), /changed: yes/);
  });
  test('a notice is reported and does not fail the run', () => {
    // TBL-01's cap reports the row it left out of the column widths. That is a
    // report about what the formatter did rather than a complaint about the
    // document, so it must not add to the exit code - and it prints in the same
    // machine-readable shape as everything else, one severity word lower.
    const io: FakeIo = {
      ...fakeIo({ 'a.md': '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n' }),
      optionsFor: () => ({ table: { mode: 'normalize', maxWidth: 30 } }),
    };
    const code = run(['a.md'], io);
    assert.equal(code, 0, 'a notice is not a failure');
    assert.match(io.errText(), /^a\.md:1: info: TBL-01 /m);
  });
  test('--explain counts notices beside warnings', () => {
    const io: FakeIo = {
      ...fakeIo({ 'a.md': '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n' }),
      optionsFor: () => ({ table: { mode: 'normalize', maxWidth: 30 } }),
    };
    const code = run(['--explain', 'a.md'], io);
    assert.equal(code, 0);
    assert.match(io.errText(), /warnings: 0/);
    assert.match(io.errText(), /notices: 1/);
  });
  test('a configuration notice is printed for the file it affects', () => {
    const io = {
      ...fakeIo({ 'a.md': '#  Title\n' }),
      configFor: () => ({
        options: {},
        configPath: '/tmp/fuxi-fmt.json',
        notices: [
          {
            kind: 'unknown' as const,
            key: 'typo',
            messageId: 'cfg.unknownKey' as const,
            args: ['typo'],
            // Rendered from the catalogue rather than spelled out here, so the
            // fake notice cannot drift from the real one.
            message: english('cfg.unknownKey', ['typo']),
          },
        ],
      }),
    };
    const code = run(['a.md'], io);
    assert.equal(code, 0);
    assert.match(io.errText(), /typo is not a fuxi-fmt option/);
  });
});

describe('CLI language', () => {
  const FILE = { 'a.md': '用 ' + String.fromCharCode(96) + ' 表示,很常见\n' };

  test('--lang takes the next word, or the equals form', () => {
    assert.equal(parseArgs(['--lang', 'zh', 'a.md']).lang, 'zh');
    assert.equal(parseArgs(['--lang=zh', 'a.md']).lang, 'zh');
    assert.equal(parseArgs(['a.md']).lang, undefined);
  });

  test('--lang with nothing to take is an error, not a filename', () => {
    assert.throws(() => parseArgs(['--lang']), /needs a language/);
    assert.throws(() => parseArgs(['--lang', '--check', 'a.md']), /needs a language/);
  });

  test('the messages are Chinese when asked for, and English otherwise', () => {
    const zh = fakeIo(FILE);
    assert.equal(run(['--lang', 'zh', 'a.md'], zh), 0);
    assert.match(zh.errText(), /DET-06/);
    assert.match(zh.errText(), /反引号/);

    const en = fakeIo(FILE);
    run(['a.md'], en);
    assert.match(en.errText(), /DET-06/);
    assert.match(en.errText(), /unmatched backtick/);
  });

  test('the environment decides when nothing is asked for', () => {
    const io = { ...fakeIo(FILE), env: { LC_ALL: 'zh_CN.UTF-8' } };
    run(['a.md'], io);
    assert.match(io.errText(), /反引号/);
  });

  test('--lang beats the environment, so a CI log can be pinned', () => {
    const io = { ...fakeIo(FILE), env: { LC_ALL: 'zh_CN.UTF-8' } };
    run(['--lang', 'en', 'a.md'], io);
    assert.match(io.errText(), /unmatched backtick/);
  });
});

describe('CLI argument parsing', () => {
  test('defaults to printing the formatted document', () => {
    assert.deepEqual(parseArgs(['a.md']), { mode: 'stdout', files: ['a.md'], explain: false });
  });
  test('recognises check, write and diff', () => {
    assert.equal(parseArgs(['--check', 'a.md']).mode, 'check');
    assert.equal(parseArgs(['--write', 'a.md']).mode, 'write');
    assert.equal(parseArgs(['--diff', 'a.md']).mode, 'diff');
  });
  test('--explain is a modifier, not a mode', () => {
    const parsed = parseArgs(['--explain', '--check', 'a.md']);
    assert.equal(parsed.mode, 'check');
    assert.equal(parsed.explain, true);
    assert.deepEqual(parsed.files, ['a.md']);
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
