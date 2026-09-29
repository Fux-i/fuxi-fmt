import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assignParents, findExcludedLists, planListIndent, scanListItems } from './list-scan.ts';

const setup = (lines: readonly string[]) => {
  const items = scanListItems(lines);
  return { items, parents: assignParents(items) };
};

const reindent = (lines: readonly string[], protectedLines: readonly boolean[]): string[] => {
  const { items, parents } = setup(lines);
  const excluded = new Set(findExcludedLists(lines, items, parents, protectedLines));
  const out = [...lines];
  for (const change of planListIndent(lines, items, parents, excluded)) out[change.line] = change.text;
  return out;
};

describe('BLK-08 protected-block exclusion', () => {
  const WITH_FENCE = ['- a', '    - b', '      ```', '      code', '      ```'];

  test('a list containing a protected block is reported', () => {
    const protectedLines = [false, false, true, true, true];
    const { items, parents } = setup(WITH_FENCE);
    assert.deepEqual(findExcludedLists(WITH_FENCE, items, parents, protectedLines), [0]);
  });

  test('the whole list is excluded, not only the item that contains it', () => {
    const protectedLines = [false, false, true, true, true];
    assert.deepEqual(reindent(WITH_FENCE, protectedLines), WITH_FENCE);
  });

  test('a list with no protected block is not excluded', () => {
    const protectedLines = WITH_FENCE.map(() => false);
    const { items, parents } = setup(WITH_FENCE);
    assert.deepEqual(findExcludedLists(WITH_FENCE, items, parents, protectedLines), []);
  });

  test('a sibling list without a protected block still normalises', () => {
    const lines = ['    - b', '      ```', '      code', '      ```', '', '- separate', '    - c'];
    const protectedLines = [false, true, true, true, false, false, false];
    const out = reindent(lines, protectedLines);
    assert.deepEqual(out.slice(0, 4), lines.slice(0, 4), 'the fenced list must be untouched');
    assert.deepEqual(out.slice(5), ['- separate', '  - c'], 'the other list should normalise');
  });

  test('exclusion propagates to descendants of the excluded root', () => {
    const lines = ['- a', '  - b', '        - c'];
    const { items, parents } = setup(lines);
    // The protected line is inside c, whose root is a.
    const excluded = findExcludedLists(lines, items, parents, [false, false, true]);
    assert.deepEqual(excluded, [0]);
    assert.deepEqual(planListIndent(lines, items, parents, new Set(excluded)), []);
  });

  test('excluding one list leaves the other alone in the same document', () => {
    const lines = ['- a', '    - b', '', '- x', '    - y'];
    const { items, parents } = setup(lines);
    const excluded = new Set(findExcludedLists(lines, items, parents, [true, false, false, false, false]));
    const out = [...lines];
    for (const change of planListIndent(lines, items, parents, excluded)) out[change.line] = change.text;
    assert.deepEqual(out, ['- a', '    - b', '', '- x', '  - y']);
  });
});
