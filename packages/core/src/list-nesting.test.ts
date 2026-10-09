import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assignParents, scanListItems } from './list-scan.ts';

/** These unit tests exercise the scan alone; nothing here is a protected region. */
const none = (): boolean => false;
const scan = (lines: readonly string[]) => scanListItems(lines, none);

const parentsOf = (lines: readonly string[]): number[] => assignParents(scan(lines));

describe('BLK-08 parent assignment', () => {
  test('a flat list has no parents', () => {
    assert.deepEqual(parentsOf(['- a', '- b', '- c']), [-1, -1, -1]);
  });

  test('an item under another item is its child', () => {
    assert.deepEqual(parentsOf(['- a', '  - b']), [-1, 0]);
  });

  test('nesting composes to any depth', () => {
    assert.deepEqual(parentsOf(['- a', '  - b', '    - c']), [-1, 0, 1]);
  });

  test('a shallower item closes the deeper ones', () => {
    assert.deepEqual(parentsOf(['- a', '  - b', '- c']), [-1, 0, -1]);
  });

  test('the case that killed the stack version has no parent at all', () => {
    const items = scan(['  - nested']);
    assert.deepEqual(assignParents(items), [-1]);
    assert.equal(items[0]?.indent, 2);
  });

  test('a fragment keeps its offset through several items', () => {
    const lines = ['  - a', '    - b', '  - c'];
    assert.deepEqual(parentsOf(lines), [-1, 0, -1]);
    assert.deepEqual(
      scan(lines).map((item) => item.indent),
      [2, 4, 2],
    );
  });

  test('ordered and unordered items nest by column, not by kind', () => {
    assert.deepEqual(parentsOf(['1. a', '   - b', '2. c']), [-1, 0, -1]);
  });

  test('an item indented past its sibling still nests under the same parent', () => {
    assert.deepEqual(parentsOf(['- a', '   - b']), [-1, 0]);
  });
});
