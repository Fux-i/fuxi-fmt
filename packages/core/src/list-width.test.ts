import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * Indentation is per list kind. 'aligned' puts the child's marker at its parent's
 * content column; an explicit width is a floor that can widen nesting but never
 * break it, because a child must be indented at least as far as its parent's
 * content to be a child at all.
 */
describe('list indentation', () => {
  test('aligned is the default for both kinds', () => {
    assert.equal(format('- a\n     - b\n').output, '- a\n  - b\n');
    assert.equal(format('- a\n     1. b\n').output, '- a\n  1. b\n');
    assert.equal(format('1. a\n   - b\n').output, '1. a\n   - b\n');
  });

  test('an unordered width of 3 or 4 widens unordered nesting', () => {
    assert.equal(
      format('- a\n   - b\n', { list: { unorderedIndent: 3 } }).output,
      '- a\n   - b\n',
    );
    assert.equal(
      format('- a\n   - b\n', { list: { unorderedIndent: 4 } }).output,
      '- a\n    - b\n',
    );
  });

  test('an ordered width of 4 applies to ordered children', () => {
    assert.equal(
      format('- a\n   1. b\n', { list: { orderedIndent: 4 } }).output,
      '- a\n    1. b\n',
    );
  });

  test('the width is a floor, so a long ordered marker keeps its own column', () => {
    // '10. ' is four wide, so a floor of 3 must not pull the child in to 3 -
    // that would place it shallower than its parent's content and unnest it.
    assert.equal(
      format('10. a\n      - b\n', { list: { unorderedIndent: 3 } }).output,
      '10. a\n    - b\n',
    );
  });

  test('a top-level list is untouched whatever the widths', () => {
    const source = '  - a\n  1. b\n';
    assert.equal(format(source, { list: { unorderedIndent: 4 } }).output, source);
  });

  test('settles in one pass', () => {
    const options = { list: { unorderedIndent: 3, orderedIndent: 4 } } as const;
    const once = format('- a\n   - b\n     1. c\n', options).output;
    assert.equal(format(once, options).output, once);
  });
});
