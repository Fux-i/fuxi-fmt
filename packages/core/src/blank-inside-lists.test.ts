import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * BLK-03: a blank between list items flips a tight list to loose, which changes
 * rendering. So it is opt-in and the default must never do it.
 */
describe('blankLines.insideLists', () => {
  test('is off by default', () => {
    assert.equal(format('- a\n- b\n').output, '- a\n- b\n');
  });

  test('separates items when enabled', () => {
    assert.equal(
      format('- a\n- b\n', { blankLines: { insideLists: true } }).output,
      '- a\n\n- b\n',
    );
  });

  test('does not add a blank before the first item', () => {
    assert.equal(format('- a\n', { blankLines: { insideLists: true } }).output, '- a\n');
  });

  test('settles in one pass', () => {
    const options = { blankLines: { insideLists: true } };
    const once = format('- a\n- b\n- c\n', options).output;
    assert.equal(format(once, options).output, once);
  });

  test('an already loose list is left alone', () => {
    const options = { blankLines: { insideLists: true } };
    assert.equal(format('- a\n\n- b\n', options).output, '- a\n\n- b\n');
  });
});
