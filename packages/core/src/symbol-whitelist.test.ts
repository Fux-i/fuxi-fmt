import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** TYPO-01: which symbols count as word characters for CJK spacing. */
describe('typography.symbolWhitelist', () => {
  test('a symbol in the default set is spaced like a word', () => {
    assert.equal(format('中文%中文\n').output, '中文 % 中文\n');
  });

  test('removing a symbol from the set stops it being spaced', () => {
    assert.equal(
      format('中文%中文\n', { typography: { symbolWhitelist: ['+'] } }).output,
      '中文%中文\n',
    );
  });

  test('adding a symbol makes it word-like', () => {
    assert.equal(format('中文§中文\n').output, '中文§中文\n');
    assert.equal(
      format('中文§中文\n', { typography: { symbolWhitelist: ['+', '§'] } }).output,
      '中文 § 中文\n',
    );
  });

  test('the default set is unchanged when the option is absent', () => {
    assert.equal(format('中文+中文\n').output, '中文 + 中文\n');
  });
});
