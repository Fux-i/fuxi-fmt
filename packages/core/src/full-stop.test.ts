import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * A '.' is a full stop, a decimal point or an ellipsis. Only the first converts,
 * and only when it is the lone full stop ending its line.
 */
describe('the full stop', () => {
  test('converts a lone dot at the end of a line', () => {
    assert.equal(format('中文.\n').output, '中文。\n');
  });

  test('converts one followed only by spaces', () => {
    assert.equal(format('中文.  \n').output, '中文。\n');
  });

  test('leaves an ellipsis alone', () => {
    assert.equal(format('中文...\n').output, '中文...\n');
    assert.equal(format('等等...\n').output, '等等...\n');
    assert.equal(format('等等……\n').output, '等等……\n');
  });

  test('leaves a mid-line dot alone, because it may not be a full stop', () => {
    assert.equal(format('中文.后面还有字\n').output, '中文.后面还有字\n');
  });

  test('leaves decimals and abbreviations alone', () => {
    assert.equal(format('1.5\n').output, '1.5\n');
    assert.equal(format('a.b\n').output, 'a.b\n');
  });

  test('an already full-width stop is untouched', () => {
    assert.equal(format('中文。\n').output, '中文。\n');
  });

  test('each line is judged separately', () => {
    assert.equal(format('中文.\nabc.\n').output, '中文。\nabc.\n');
  });
});
