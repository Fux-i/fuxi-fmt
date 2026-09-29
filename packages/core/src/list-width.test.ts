import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * list.indentWidth was documented as controlling list indentation and only ever
 * controlled hard-tab expansion. BLK-08 now consults it, as a floor under the
 * parent's content column rather than instead of it.
 */
describe('list.indentWidth', () => {
  test('the default width leaves nesting at the parent content column', () => {
    assert.equal(format('- a\n     - b\n').output, '- a\n  - b\n');
  });

  test('a width of four indents children by four', () => {
    assert.equal(
      format('- a\n     - b\n', { list: { indentWidth: 4 } }).output,
      '- a\n    - b\n',
    );
  });

  test('a long ordered marker keeps its own content column even at width two', () => {
    // '10. ' is four wide. An indentWidth of 2 must not put the child at 2, or
    // it would sit shallower than its parent's content and stop nesting.
    assert.equal(format('10. a\n     - b\n').output, '10. a\n    - b\n');
  });

  test('the result settles in one pass at both widths', () => {
    const source = '- a\n       - b\n';
    const once = format(source).output;
    assert.equal(format(once).output, once);
    const four = format(source, { list: { indentWidth: 4 } }).output;
    assert.equal(format(four, { list: { indentWidth: 4 } }).output, four);
  });
});
