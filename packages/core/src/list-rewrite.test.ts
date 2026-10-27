import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assignParents, planListIndent, scanListItems } from './list-scan.ts';

/** These unit tests exercise the scan alone; nothing here is a protected region. */
const none = (): boolean => false;
const scan = (lines: readonly string[]) => scanListItems(lines, none);

const apply = (lines: readonly string[]): string[] => {
  const items = scan(lines);
  const out = [...lines];
  for (const change of planListIndent(lines, items, assignParents(items))) out[change.line] = change.text;
  return out;
};

describe('BLK-08 marker rewriting', () => {
  test('an already aligned nested item is left alone', () => {
    assert.deepEqual(apply(['- a', '  - b']), ['- a', '  - b']);
  });

  test('an over-indented nested item moves to its parent content column', () => {
    assert.deepEqual(apply(['- a', '    - b']), ['- a', '  - b']);
  });

  test('a grandchild follows its parent rather than staying where it was', () => {
    assert.deepEqual(apply(['- a', '    - b', '        - c']), ['- a', '  - b', '    - c']);
  });

  test('a fragment keeps its offset, and its children keep their place under it', () => {
    assert.deepEqual(apply(['  - a', '      - b']), ['  - a', '    - b']);
  });

  test('a continuation line moves with its item', () => {
    assert.deepEqual(apply(['- a', '    - b', '      body']), ['- a', '  - b', '    body']);
  });

  test('a line less indented than its item is not part of it', () => {
    assert.deepEqual(apply(['- a', '    - b', 'not a continuation']), [
      '- a',
      '  - b',
      'not a continuation',
    ]);
  });

  test('a continuation does not cross the indented-code threshold', () => {
    // Moving the item up one column and leaving the body at 8 made a line that was
    // prose an indented code block - a region that was not there before, which the
    // guard refused the document for.
    assert.deepEqual(
      apply(['- x', '   - a', '', '        code']),
      ['- x', '  - a', '', '       code'],
    );
  });

  test('a blank line does not end the continuation run', () => {
    // The line after the blank is still the item's body, so it moves with it. It
    // has to be its body: measured against the item's content column, not its
    // marker column, because a line between the two belongs to the parent.
    assert.deepEqual(apply(['- a', '    - b', '', '      loose']), ['- a', '  - b', '', '    loose']);
  });

  test('a line at the parent content column does not move with the child', () => {
    assert.deepEqual(apply(['- a', '    - b', '', '    loose']), ['- a', '  - b', '', '    loose']);
  });

  test('the result settles in one pass', () => {
    // The first implementation moved a grandchild relative to where its parent
    // started, so this took two runs. It has to be idempotent to ship.
    for (const source of [
      ['- a', '    - b', '        - c'],
      ['  - a', '      - b', '          - c'],
      ['- a', '      - b', '   - c', '        - d'],
    ]) {
      const once = apply(source);
      assert.deepEqual(apply(once), once, 'not idempotent: ' + JSON.stringify(source));
    }
  });

  test('planning changes nothing on its own', () => {
    const lines = ['- a', '    - b'];
    const items = scan(lines);
    planListIndent(lines, items, assignParents(items));
    assert.deepEqual(lines, ['- a', '    - b']);
  });
});
