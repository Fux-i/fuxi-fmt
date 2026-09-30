import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * A '.' is a full stop, a decimal point or an ellipsis. Only a lone dot standing
 * after CJK converts, wherever it sits on the line.
 */
describe('the full stop', () => {
  test('converts a lone dot after CJK at the end of a line', () => {
    assert.equal(format('中文.\n').output, '中文。\n');
  });

  test('converts a lone dot after CJK in the middle of a line', () => {
    assert.equal(format('中文.后面还有字\n').output, '中文。后面还有字\n');
    assert.equal(format('中文.中文\n').output, '中文。中文\n');
  });

  test('leaves an ellipsis alone', () => {
    assert.equal(format('中文...\n').output, '中文...\n');
    assert.equal(format('等等...\n').output, '等等...\n');
    assert.equal(format('等等……\n').output, '等等……\n');
  });

  test('leaves a dot that does not follow CJK alone', () => {
    assert.equal(format('1.5\n').output, '1.5\n');
    assert.equal(format('a.b\n').output, 'a.b\n');
    assert.equal(format('e.g.\n').output, 'e.g.\n');
    assert.equal(format('abc.中文\n').output, 'abc.中文\n');
  });

  test('an already full-width stop is untouched', () => {
    assert.equal(format('中文。\n').output, '中文。\n');
  });

  test('each line is judged separately', () => {
    assert.equal(format('中文.\nabc.\n').output, '中文。\nabc.\n');
  });
});
