import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * A parenthesis takes the width of the text it sits in, not of the text it
 * encloses. Deciding from the contents rewrote the full-width parens of a Chinese
 * sentence whenever the bracketed term happened to be English.
 */
describe('TYPO-08 parenthesis width', () => {
  test('a Chinese sentence keeps full-width parens around an English term', () => {
    assert.equal(format('中文（English）文\n').output, '中文（English）文\n');
    assert.equal(format('中文(English)文\n').output, '中文（English）文\n');
  });

  test('an English sentence keeps half-width parens around a Chinese term', () => {
    assert.equal(format('English(中文)English\n').output, 'English(中文)English\n');
    assert.equal(format('English（中文）English\n').output, 'English(中文)English\n');
  });

  test('spaces around the result are then removed by TYPO-07', () => {
    assert.equal(format('中文 (English) 文\n').output, '中文（English）文\n');
  });

  test('with nothing before it on the line, the contents decide', () => {
    assert.equal(format('(English)\n').output, '(English)\n');
    assert.equal(format('(中文)\n').output, '（中文）\n');
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
