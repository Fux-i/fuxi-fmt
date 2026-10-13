/**
 * DET-10 / DET-13: the table grammar's one reading.
 *
 * `tables.ts` owns what a table row is - its cells, the escaped pipe, the
 * optional outer pipes, the delimiter cell. `detect.ts` used to keep a second
 * copy of that grammar, and these are the cases where a second copy could
 * disagree. Each is asserted against the single owner instead.
 *
 * Spec references: DET-10, DET-13, TBL-01.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isDelimiterRow, tableCells, tableRow } from './tables.ts';

describe('DET-10/DET-13 one table grammar', () => {
  test('the outer pipes are optional and are stripped', () => {
    assert.deepEqual(tableCells('| a | b |'), [' a ', ' b ']);
    assert.deepEqual(tableCells('a | b'), ['a ', ' b']);
  });

  test('a backslash-escaped pipe is content, not a separator', () => {
    assert.deepEqual(tableCells('| a \\| b | c |'), [' a \\| b ', ' c ']);
  });

  test('a line with no pipe is not a row at all', () => {
    assert.equal(tableCells('plain prose'), null);
  });

  test('a bare pipe has an empty cell list, and is not a row', () => {
    assert.deepEqual(tableCells('|'), []);
    assert.equal(tableRow('|'), null);
  });

  test('a delimiter row is read from the same cells', () => {
    assert.equal(isDelimiterRow('| --- | :--: |'), true);
    assert.equal(isDelimiterRow('| --- | x |'), false);
    assert.equal(isDelimiterRow('|'), false);
  });
});
