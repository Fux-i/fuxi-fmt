import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** BLK-08 through the whole pipeline, not just the pure functions. */

describe('BLK-08 list reindentation', () => {
  test('an item over-indented by three spaces is normalised', () => {
    assert.equal(format('- a\n   - b\n').output, '- a\n  - b\n');
  });

  test('an item already at its parent content column is untouched', () => {
    assert.equal(format('- a\n  - b\n').output, '- a\n  - b\n');
  });

  test('a top-level list is untouched', () => {
    assert.equal(format('- a\n- b\n').output, '- a\n- b\n');
  });

  test('four-space over-indentation is normalised too, not treated as indented code', () => {
    // I assumed this was excluded as an indented code block and wrote a test
    // asserting the list was untouched. It was untouched, but not for that
    // reason: the reindent plan was being computed and then discarded at the
    // emit step. Once the emit path was fixed this case normalised like any
    // other, and the assumption was the thing that had been wrong.
    assert.equal(format('- a\n    - b\n').output, '- a\n  - b\n');
  });

  test('a list containing a fenced block is left alone', () => {
    const source = '- a\n  - b\n\n    \`\`\`\n    code\n    \`\`\`\n';
    assert.equal(format(source).output, source);
  });

  test('the result settles in one pass', () => {
    for (const source of ['- a\n   - b\n', '- a\n  - b\n', '- a\n\n- b\n', '   - a\n   - b\n']) {
      const once = format(source).output;
      assert.equal(format(once).output, once, 'not idempotent: ' + JSON.stringify(source));
    }
  });
});
