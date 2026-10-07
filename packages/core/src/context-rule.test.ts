/**
 * The context rule the two width rules share, tested through the formatter.
 *
 * They share the question and not the precedence. A punctuation mark keeps its
 * word guard first, which is what holds `第 1,000 个字符` together; a parenthesis
 * asks the context first, because the line is what says which script the
 * sentence is written in. The cases below are the bounds that make each order
 * safe, several of them written as the answer the other order would get wrong.
 *
 * Spec references: TYPO-05, TYPO-08.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

/** Both the expected output and that a second pass changes nothing. */
function settles(src: string, expected: string, options?: FormatOptionsInput): void {
  assert.equal(out(src, options), expected);
  assert.equal(out(expected, options), expected, 'not idempotent');
}

describe('TYPO-05 and TYPO-08 share a context, not a precedence', () => {
  test('an emphasis marker no longer hides the Han before a parenthesis', () => {
    settles('这就是**自信**(confidence)的体现\n', '这就是**自信**（confidence）的体现\n');
  });

  test('the same sentence without emphasis still converts', () => {
    settles('这就是(confidence)的体现\n', '这就是（confidence）的体现\n');
  });

  test('a parenthesis glued to a Latin word follows the line, not the word', () => {
    // The mark below keeps its guard; a parenthesis does not, because a digit
    // or a letter before it says nothing about which script the sentence is in.
    settles('这是 foo(bar) 的调用\n', '这是 foo（bar）的调用\n');
    // The narrow setting still keeps Latin parentheticals half-width when Latin
    // is what sits outside them on both sides.
    const adjacent: FormatOptionsInput = { typography: { context: 'adjacent' } };
    settles('见 English(term)English 处\n', '见 English（term）English 处\n');
    settles('见 English(term)English 处\n', '见 English(term)English 处\n', adjacent);
  });

  test('CJK directly beside a mark wins, whichever side it is on', () => {
    settles('abc,中文\n', 'abc，中文\n');
    settles('中文,abc\n', '中文，abc\n');
  });

  test('a mark tight against a number is left alone', () => {
    settles('第 1,000 个字符\n', '第 1,000 个字符\n');
    settles('时间是 10:30\n', '时间是 10:30\n');
    settles('圆周率是 3.14\n', '圆周率是 3.14\n');
    settles('这是 e.g. 的例子\n', '这是 e.g. 的例子\n');
    settles('版本 1.2.3 发布\n', '版本 1.2.3 发布\n');
  });

  test('a space no longer hides the mark from the rule', () => {
    settles('中文 , 后面\n', '中文，后面\n');
    settles('中文 .后面还有字\n', '中文。后面还有字\n');
  });

  test('a quoted span is its own scope, even before the quotes are curly', () => {
    // The line is Chinese, the quotation is not, and the comma between two spaces
    // is loose enough that only the scope can protect it. TYPO-11 pairs the quotes
    // on the way through and TYPO-07 takes the spaces the wider marks leave behind;
    // the comma inside is the point here, and it stays half-width.
    settles('他说 "a , b" 这句话\n', '他说“a , b”这句话\n');
  });

  test('a curly span is a scope too, or the rule is not idempotent', () => {
    // Full-width quotes are full-width punctuation, so TYPO-07 takes the spaces
    // around them on the way out. What matters here is the comma inside.
    settles('他说 \u201ca , b\u201d 这句话\n', '他说\u201ca , b\u201d这句话\n');
  });

  test('adjacent mode reads only the characters beside the mark', () => {
    const options: FormatOptionsInput = { typography: { context: 'adjacent' } };
    settles('中文 test , test 中文\n', '中文 test , test 中文\n', options);
    settles('中文,后面\n', '中文，后面\n', options);
  });

  test('line mode converts that same loose mark', () => {
    settles('中文 test , test 中文\n', '中文 test，test 中文\n');
  });

  test('an English line is left alone whatever the mode', () => {
    settles('test english brackets (oh)this!\n', 'test english brackets (oh)this!\n');
    settles('test english brackets (oh)this!\n', 'test english brackets (oh)this!\n', {
      typography: { context: 'adjacent' },
    });
  });
});
