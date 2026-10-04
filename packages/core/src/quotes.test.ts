/**
 * TYPO-11: straight double quotes become paired Chinese quotation marks.
 *
 * Spec references: TYPO-11.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

function settles(src: string, expected: string, options?: FormatOptionsInput): void {
  assert.equal(out(src, options), expected);
  assert.equal(out(expected, options), expected, 'not idempotent');
}

describe('TYPO-11 paired quotation marks', () => {
  test('a straight pair in Chinese text becomes a Chinese pair', () => {
    settles('这就是"自信"的体现\n', '这就是“自信”的体现\n');
  });

  test('a quotation is a scope, so the English inside it keeps its punctuation', () => {
    // The reported preference exactly: Chinese quotation marks around an English
    // sentence, and the comma inside stays half-width because that scope is not
    // Chinese.
    settles('他说 "hello, world" 这句话\n', '他说“hello, world”这句话\n');
  });

  test('a line mixing curly and straight marks has only the straight ones paired', () => {
    settles(
      '很生气啊（），这；就“不对”"了"，符号都搞错了\n',
      '很生气啊（），这；就“不对”“了”，符号都搞错了\n',
    );
  });

  test('an inch mark is not a quotation', () => {
    settles('尺寸是 12" x 8" 的板子\n', '尺寸是 12" x 8" 的板子\n');
  });

  test('the apostrophe is never touched', () => {
    settles("这是 don't 的缩写\n", "这是 don't 的缩写\n");
    settles('这是 John\'s book\n', '这是 John\'s book\n');
  });

  test('an English line is left alone', () => {
    settles('He said "hi" to me\n', 'He said "hi" to me\n');
  });

  test('can be turned off', () => {
    settles('这就是"自信"的体现\n', '这就是"自信"的体现\n', {
      typography: { quotes: 'preserve' },
    });
  });

  test('a quotation wrapped across two lines is one quotation', () => {
    // Found by the dogfood test, which formats this repository's own CHANGELOG:
    // a hard-wrapped quotation produced a warning per wrapped quote, and a
    // warning nobody reads twice is worse than none. An author wraps inside a
    // paragraph, so a paragraph is the unit that pairs.
    settles('他说 "hello\nworld" 这句话\n', '他说“hello\nworld”这句话\n');
  });

  test('a wrapped paragraph with an odd count warns once, not once per line', () => {
    const result = format('中文 "a\nb\nc\n');
    assert.equal(result.output, '中文 "a\nb\nc\n');
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('an unpaired quote leaves the whole line alone and says so', () => {
    const result = format('他说 "你好 了\n');
    assert.equal(result.output, '他说 "你好 了\n');
    assert.equal(result.diagnostics.length, 1);
    const diagnostic = result.diagnostics[0];
    assert.equal(diagnostic?.ruleId, 'TYPO-11');
    assert.equal(diagnostic?.line, 0);
    // The line is data. Writing it into the message as well printed it twice, in
    // two different bases, whenever a caller printed both.
    assert.doesNotMatch(diagnostic?.message ?? '', /line \d/);
  });

  test('the warning carries the line as data, counting from zero', () => {
    const result = format('第一行\n\n他说 "你好 了\n');
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('the line is the one the author wrote, not the one the formatter moved it to', () => {
    // The blank-line policy inserts a line after a heading. The quotes pass runs
    // on the rebuilt text, so counting lines there reported line 2 for a quote on
    // line 1, and the editor put the squiggle on the blank line instead.
    const heading = format('# 标题\n他说 "你好 了\n');
    assert.equal(heading.diagnostics[0]?.line, 1);
    const fence = format('```js\nx\n```\n他说 "你好 了\n');
    assert.equal(fence.diagnostics[0]?.line, 3);
  });

  test('a warning does not stop the rest of the document formatting', () => {
    const result = format('#  标题\n\n他说 "你好 了\n');
    assert.equal(result.output, '# 标题\n\n他说 "你好 了\n');
    assert.equal(result.changed, true);
    assert.equal(result.diagnostics.length, 1);
  });
});
