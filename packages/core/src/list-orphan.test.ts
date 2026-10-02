/**
 * BLK-08: an item that falls out of an open ancestor is dedented to its container.
 *
 * The pass deliberately keeps the offset of a top-level item, because snapping an
 * already-indented fragment to column 0 was the bug that made this scanner
 * necessary. That policy also pinned a different thing: an item written shallower
 * than the item above it cannot be its child, so it falls out of the list - and it
 * kept the indent that made it look like a child anyway. The two are not the same
 * situation and are no longer treated as one.
 *
 * Spec references: BLK-08.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

const out = (src: string) => format(src).output;

describe('BLK-08 an item that falls out of an open ancestor', () => {
  test('the reported snippet becomes the tree it already had', () => {
    const src = '1. 333\n   - yes\n  - ok\n    1) fine\n    2) 33\n';
    assert.equal(out(src), '1. 333\n   - yes\n- ok\n  1) fine\n  2) 33\n');
  });

  test('it is idempotent', () => {
    const once = out('1. 333\n   - yes\n  - ok\n    1) fine\n    2) 33\n');
    assert.equal(out(once), once);
  });

  test('a fragment that opens the list keeps its offset', () => {
    // The behaviour the policy exists for, and the reason the two cases cannot be
    // one rule: this list starts where the author put it.
    assert.equal(out('  - a\n      - b\n'), '  - a\n    - b\n');
  });

  test('the dedent is to the container, not to the item it broke out of', () => {
    // '- c' at indent 1 is shallower than every open item, so it ends both lists
    // and becomes a top-level list of its own.
    const src = '1. a\n   1. b\n - c\n1. d\n';
    assert.equal(out(src), '1. a\n   1. b\n- c\n1. d\n');
  });

  test('an item at the same indent as the one it follows is a sibling', () => {
    // The distinction the first attempt at this rule missed: '- b' closes '- a'
    // on the way in, but it closes a sibling rather than an ancestor.
    assert.equal(out('  - a\n  - b\n'), '  - a\n  - b\n');
    assert.equal(out('  - a\n      - b\n  - c\n'), '  - a\n    - b\n  - c\n');
  });

  test('an item deeper than its parent is nested as before', () => {
    assert.equal(out('- a\n      - b\n'), '- a\n  - b\n');
  });

  test('a two-space fragment is left exactly as written', () => {
    const src = '  - a\n  - b\n';
    assert.equal(out(src), src);
  });
});
