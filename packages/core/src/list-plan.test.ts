/**
 * BLK-08 and DET-12: the list plan.
 *
 * Normalising list indentation keeps the line count, which is what lets it run on
 * the line array before segmentation; and a list that holds a protected block is
 * left entirely alone, because reindenting the code inside it is exactly what
 * SAFE-02 forbids. Both facts lived as comments inside format().
 *
 * Spec references: BLK-08, DET-12, SAFE-02.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planLists } from './format.ts';
import { resolveOptions } from './options.ts';

describe('BLK-08/DET-12 the list plan', () => {
  test('a list holding a protected block is left alone, and reported once', () => {
    const texts = ['- a', '  ```', '  code', '  ```'];
    const protectedLine = [false, true, true, true];
    const out = planLists(texts, protectedLine, resolveOptions().list);
    assert.deepEqual(out.reindented, texts);
    assert.deepEqual(out.diagnostics.map((d) => [d.ruleId, d.line]), [['DET-12', 0]]);
    assert.ok(out.excludedItemLines.has(0), 'the protected list was not excluded');
  });

  test('a nested item is reindented to the configured width', () => {
    const options = resolveOptions({ list: { unorderedIndent: 4 } });
    const out = planLists(['- a', '   - b'], [false, false], options.list);
    assert.deepEqual(out.reindented, ['- a', '    - b']);
    assert.deepEqual(out.diagnostics, []);
    assert.equal(out.excludedItemLines.size, 0);
  });

  test('the default aligns a nested item with the parent content', () => {
    const options = resolveOptions();
    const out = planLists(['- a', '   - b'], [false, false], options.list);
    assert.deepEqual(out.reindented, ['- a', '  - b']);
  });
});
