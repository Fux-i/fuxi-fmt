import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkSemantics } from './guard.ts';
import { format } from './format.ts';

describe('GRT-01 the guard accepts intended transformations', () => {
  test('blank line insertion between blocks', () => {
    assert.deepEqual(checkSemantics('a\n- x\n', 'a\n\n- x\n'), []);
  });
  test('marker spacing', () => {
    assert.deepEqual(checkSemantics('-   x\n', '- x\n'), []);
    assert.deepEqual(checkSemantics('>q\n', '> q\n'), []);
  });
  test('CJK spacing', () => {
    assert.deepEqual(checkSemantics('中文abc\n', '中文 abc\n'), []);
  });
  test('ordered list renumbering', () => {
    assert.deepEqual(checkSemantics('1. a\n5. b\n', '1. a\n2. b\n'), []);
  });
  test('a heading promotion that only inserts a space', () => {
    assert.deepEqual(checkSemantics('#标题\n', '# 标题\n'), []);
  });
});

describe('GRT-01 the guard rejects semantic change', () => {
  test('a paragraph silently becoming a heading', () => {
    assert.ok(checkSemantics('a\n', '# a\n').length > 0);
  });
  test('modified fenced code', () => {
    assert.ok(checkSemantics('```\ncode\n```\n', '```\nCODE\n```\n').length > 0);
  });
  test('a changed fence info string', () => {
    assert.ok(checkSemantics('```js\nx\n```\n', '```ts\nx\n```\n').length > 0);
  });
  test('modified front matter', () => {
    assert.ok(checkSemantics('---\na: 1\n---\n', '---\na: 2\n---\n').length > 0);
  });
  test('a changed inline code span', () => {
    assert.ok(checkSemantics('`a`\n', '`b`\n').length > 0);
  });
  test('a changed URL destination', () => {
    assert.ok(checkSemantics('x https://a.b\n', 'x https://a.c\n').length > 0);
  });
  test('a lost line', () => {
    assert.ok(checkSemantics('a\nb\n', 'a\n').length > 0);
  });
});

describe('GRT-01 the guard holds over a corpus of awkward documents', () => {
  const CORPUS = [
    '#标题\n',
    '中文abc\n\n\n\n-  x\n',
    '```js\nconst a = 1;\n```\n',
    '---\ntitle: 中文abc\nlist:\n  - a\n---\n\ntext\n',
    '>quote\n>>nested\n',
    '| a | b |\n| - | - |\n| 1 | 2 |\n',
    '1. a\n   1. x\n5. b\n',
    '文本`code`文本 $x$ 与 https://a.b\n',
    'a\n\ntext\n\n5. b\n',
    '\n\n\n# A\n\n\n',
    '~~~ c {3, 4}\nx\n~~~\n',
    '- [ ]   todo\n- [x]  done\n',
    '中文#标签 和 A-B 与 GPT-4o\n',
  ];

  for (const [index, src] of CORPUS.entries()) {
    test('corpus case ' + String(index + 1) + ' survives the guard', () => {
      const result = format(src);
      assert.deepEqual(checkSemantics(src, result.output), []);
      assert.deepEqual(result.diagnostics, []);
    });
  }
});
