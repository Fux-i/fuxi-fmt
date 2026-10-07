import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

/**
 * A parenthesis takes the width of the context it sits in, and
 * `typography.context` decides how wide that context is read: the whole line by
 * default, only the two characters outside the pair when it is set to
 * `adjacent`.
 *
 * The neighbours used to decide first, and the setting was nearly unreachable
 * behind them: a space was enough to change the answer, so
 * `中文（NMRI）` was protected only for as long as its author happened not to
 * write one.
 */
describe('TYPO-08 parenthesis width', () => {
  const adjacent: FormatOptionsInput = { typography: { context: 'adjacent' } };

  test('a Chinese line makes the pair full-width, whatever the contents', () => {
    assert.equal(format('中文（English）文\n').output, '中文（English）文\n');
    assert.equal(format('中文(English)文\n').output, '中文（English）文\n');
    // The price of reading the whole line: Han inside the pair makes the line
    // Chinese, so a Latin sentence quoting a Chinese term takes full-width
    // parentheses unless its author asks for the narrower rule.
    assert.equal(format('English(中文)English\n').output, 'English（中文）English\n');
  });

  test('a number before the pair no longer decides it', () => {
    // 版本 22.18（推荐 24 LTS） came out half-width because the character before
    // the opener is a digit. Nothing about a digit says that the parentheses
    // around a Chinese term belong to it.
    assert.equal(format('版本 22.18（推荐 24 LTS）。\n').output, '版本 22.18（推荐 24 LTS）。\n');
    assert.equal(format('版本 22.18(推荐 24 LTS)。\n').output, '版本 22.18（推荐 24 LTS）。\n');
  });

  test('a pair glued to a Latin word follows the line, not the word', () => {
    // The accepted cost of asking the context first. Bare code in Chinese prose
    // is the author's to protect, and inline code is how this tool expects it
    // protected.
    assert.equal(format('调用 foo(bar) 函数\n').output, '调用 foo（bar）函数\n');
  });

  test('spaces around the result are then removed by TYPO-07', () => {
    assert.equal(format('中文 (English) 文\n').output, '中文（English）文\n');
  });

  test('the line decides at its start too, not the contents', () => {
    assert.equal(format('(English)\n').output, '(English)\n');
    assert.equal(format('(中文)\n').output, '（中文）\n');
  });

  test('adjacent reads the two characters outside the pair', () => {
    // Latin outside on both sides, so the pair is half-width and the Han inside
    // it has no vote - which is the whole point of the narrower setting.
    assert.equal(format('English(中文)English\n', adjacent).output, 'English(中文)English\n');
    assert.equal(format('English（中文）English\n', adjacent).output, 'English(中文)English\n');
    // Han outside, on the left: full-width.
    assert.equal(format('中文(English)文\n', adjacent).output, '中文（English）文\n');
  });

  test('preserve leaves both alone', () => {
    const options = { typography: { parenStyle: 'preserve' as const } };
    assert.equal(format('中文(English)文\n', options).output, '中文(English)文\n');
    assert.equal(format('中文（English）文\n', options).output, '中文（English）文\n');
  });

  test('the forced modes still force', () => {
    assert.equal(
      format('English(中文)English\n', { typography: { parenStyle: 'fullwidth' } }).output,
      'English（中文）English\n',
    );
    assert.equal(
      format('中文（English）文\n', { typography: { parenStyle: 'halfwidth' } }).output,
      '中文(English)文\n',
    );
  });
});
