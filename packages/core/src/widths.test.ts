import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('cjkClasses selects which scripts count as CJK', () => {
  test('Han is always available', () => {
    assert.equal(out('中文abc\n'), '中文 abc\n');
  });
  test('kana is left alone by default', () => {
    assert.equal(out('テレビabc\n'), 'テレビabc\n');
  });
  test('kana joins the class when opted in', () => {
    assert.equal(
      out('テレビabc\n', { typography: { cjkClasses: ['han', 'kana'] } }),
      'テレビ abc\n',
    );
  });
  test('enclosed characters join when opted in', () => {
    assert.equal(
      out('㈱abc\n', { typography: { cjkClasses: ['han', 'enclosed'] } }),
      '㈱ abc\n',
    );
  });
});

describe('TYPO-08 parenthesis width follows the surrounding text', () => {
  test('full-width in a Chinese sentence, whatever the contents', () => {
    // This test used to assert the opposite, and the opposite was the bug: a
    // Chinese sentence quoting an English term had its parens narrowed.
    assert.equal(out('中文（NMRI）后续\n'), '中文（NMRI）后续\n');
    assert.equal(out('中文(NMRI)后续\n'), '中文（NMRI）后续\n');
  });
  test('full-width when the contents contain Han', () => {
    assert.equal(out('中文(中文内容)后续\n'), '中文（中文内容）后续\n');
  });
  test('what sits inside no longer decides, so digits are irrelevant', () => {
    assert.equal(out('见（1）与（二）\n'), '见（1）与（二）\n');
  });
  test('preserve leaves both alone', () => {
    assert.equal(
      out('中文（NMRI）\n', { typography: { parenStyle: 'preserve' } }),
      '中文（NMRI）\n',
    );
  });
  test('a nested pair is skipped rather than guessed', () => {
    // The outer pair has another opener inside it, so the walker bails and
    // leaves it exactly as written. The inner pair is a pair of its own and
    // takes the line's decision like any other, which is why it widens here.
    assert.equal(out('中文（a(b)c）\n'), '中文（a（b）c）\n');
  });
  test('never touches a fence', () => {
    const src = '```\n中文（NMRI）\n```\n';
    assert.equal(out(src), src);
  });
});

describe('TYPO-06 full-width alphanumerics become half-width', () => {
  test('converts full-width digits and then spaces them from Han', () => {
    assert.equal(out('中文１２３\n'), '中文 123\n');
  });
  test('converts full-width Latin', () => {
    assert.equal(out('ＡＢＣ中文\n'), 'ABC 中文\n');
  });
  test('converts full-width lowercase', () => {
    assert.equal(out('ａｂｃ\n'), 'abc\n');
  });
  test('converts an ideographic space', () => {
    assert.equal(out('中文\u3000abc\n'), '中文 abc\n');
  });
  test('never touches a fence', () => {
    const src = '```\n中文１２３\n```\n';
    assert.equal(out(src), src);
  });
  test('never touches front matter', () => {
    const src = '---\na: １２３\n---\n\ntext\n';
    assert.equal(out(src), src);
  });
});

describe('TYPO-05 punctuation width follows CJK adjacency', () => {
  test('converts a comma between Han characters', () => {
    assert.equal(out('中文,中文\n'), '中文，中文\n');
  });
  test('converts a question mark after Han', () => {
    assert.equal(out('真的吗?\n'), '真的吗？\n');
  });
  test('converts a colon after Han and tightens the following space', () => {
    assert.equal(out('注意: 见下文\n'), '注意：见下文\n');
  });
  test('converts a period at the end of a Han sentence', () => {
    assert.equal(out('结束.\n'), '结束。\n');
  });
  test('converts when Han follows the mark', () => {
    assert.equal(out('abc,中文\n'), 'abc，中文\n');
  });
  test('leaves thousands separators and decimals alone', () => {
    assert.equal(out('1,000 与 2.5\n'), '1,000 与 2.5\n');
  });
  test('leaves an abbreviation alone', () => {
    assert.equal(out('e.g. 中文\n'), 'e.g. 中文\n');
  });
  test('never converts inside a fence', () => {
    const src = '```\n中文,中文\n```\n';
    assert.equal(out(src), src);
  });
  test('never converts inside inline code', () => {
    assert.equal(out('中文`a,b`中文\n'), '中文 `a,b` 中文\n');
  });
  test('the semicolon converts by default, since it is in the change list', () => {
    assert.equal(out('中文;中文\n'), '中文；中文\n');
  });

  test('removing it from the change list leaves it alone', () => {
    assert.equal(
      out('中文;中文\n', { typography: { punctuationChangeList: [','] } }),
      '中文;中文\n',
    );
  });

  test('the flag that used to gate it is gone, leaving the list as the only control', () => {
    assert.equal(
      out('中文;中文\n', { typography: { punctuationChangeList: [',', ';'] } }),
      '中文；中文\n',
    );
  });
  test('can be turned off', () => {
    assert.equal(out('中文,中文\n', { typography: { punctuationStyle: 'off' } }), '中文,中文\n');
  });
  test('halfwidth style reverses the direction against Latin', () => {
    assert.equal(
      out('abc，def\n', { typography: { punctuationStyle: 'halfwidth' } }),
      'abc,def\n',
    );
  });
  test('mixed style applies whichever direction the neighbours ask for', () => {
    assert.equal(
      out('abc，def 与 中文,中文\n', { typography: { punctuationStyle: 'mixed' } }),
      'abc,def 与 中文，中文\n',
    );
  });
});
