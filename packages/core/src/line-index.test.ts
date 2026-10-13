/**
 * The line an offset sits on, answered once.
 *
 * A diagnostic has to name the line the author wrote, and six modules used to
 * answer that question their own way - two algorithms and two not-found
 * sentinels. This is the one answer, and the cases where the old copies could
 * have disagreed are pinned here.
 *
 * Spec references: CFG-02, DET-01, GRT-04.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineIndexOf, splitSourceLines } from './scan.ts';

// Offsets: a=0, \n=1, bb=2..3, \n=4, \n=5, ccc=6..8, \n=9, trailing line starts at 10.
const lines = splitSourceLines('a\nbb\n\nccc\n');

describe('CFG-02 the line an offset sits on', () => {
  test('an offset inside the first line', () => {
    assert.equal(lineIndexOf(lines, 0), 0);
    assert.equal(lineIndexOf(lines, 1), 0);
  });

  test('a line break belongs to the line it ends', () => {
    assert.equal(lineIndexOf(lines, 2), 1);
    assert.equal(lineIndexOf(lines, 4), 1);
  });

  test('a blank line is still a line', () => {
    assert.equal(lineIndexOf(lines, 5), 2);
    assert.equal(lineIndexOf(lines, 6), 3);
  });

  test('past the last line start is that last line', () => {
    assert.equal(lineIndexOf(lines, 999), 4);
  });

  test('an empty document has one line', () => {
    assert.equal(lineIndexOf(splitSourceLines(''), 0), 0);
  });

  test('before the document there is no line, and -1 says so', () => {
    assert.equal(lineIndexOf(lines, -1), -1);
  });
});
