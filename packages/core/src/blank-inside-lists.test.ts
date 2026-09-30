import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * A blank line between list items decides whether the list renders tight or
 * loose. The default removes it; 'one' adds it; 'preserve' leaves it alone.
 */
describe('blankLines.insideLists', () => {
  test('removes the blank between items of one list by default', () => {
    assert.equal(format('- a\n\n- b\n').output, '- a\n- b\n');
  });

  test('one flips a tight list to loose', () => {
    assert.equal(
      format('- a\n- b\n', { blankLines: { insideLists: 'one' } }).output,
      '- a\n\n- b\n',
    );
  });

  test('preserve leaves both shapes alone', () => {
    const options = { blankLines: { insideLists: 'preserve' as const } };
    assert.equal(format('- a\n\n- b\n', options).output, '- a\n\n- b\n');
    assert.equal(format('- a\n- b\n', options).output, '- a\n- b\n');
  });

  test('a blank between different markers is kept, because it separates two lists', () => {
    assert.equal(format('- a\n\n1. b\n').output, '- a\n\n1. b\n');
  });

  test('the result settles in one pass', () => {
    for (const mode of ['remove', 'one', 'preserve'] as const) {
      const options = { blankLines: { insideLists: mode } };
      const once = format('- a\n\n- b\n- c\n', options).output;
      assert.equal(format(once, options).output, once, 'not idempotent in ' + mode);
    }
  });
});
