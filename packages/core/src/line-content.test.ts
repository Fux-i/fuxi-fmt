/**
 * The line head, read once.
 *
 * A line wrapped in block quote markers is a document of its own, and every pass
 * that asks "what is on this line, past the markers?" - the region scanner, the
 * list scanner, the table scanner, the thematic-break rule - has to agree about
 * the answer. That reading used to live privately in scan.ts; this pins it at its
 * one home, including the tab-stop rule that decides whether what follows is
 * indented code.
 *
 * Spec references: SAFE-01, BLK-08, BLK-09, BLK-14.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineContentOf } from './blocks.ts';

describe('BLK-09/BLK-14 the line head past its quote markers', () => {
  test('a line with no marker has no separator and no depth', () => {
    assert.deepEqual(lineContentOf('  a'), { at: 0, body: 2, columns: 2, depth: 0 });
  });

  test('one quote marker and its separating space are not content', () => {
    assert.deepEqual(lineContentOf('> a'), { at: 2, body: 2, columns: 0, depth: 1 });
  });

  test('a nested quote chain counts its markers', () => {
    assert.deepEqual(lineContentOf('> > a'), { at: 4, body: 4, columns: 0, depth: 2 });
  });

  test('whitespace after the separator is the content own indentation', () => {
    assert.deepEqual(lineContentOf('>   a'), { at: 2, body: 4, columns: 2, depth: 1 });
  });

  test('a tab counts to the next four-column stop', () => {
    assert.deepEqual(lineContentOf('> \tx'), { at: 2, body: 3, columns: 4, depth: 1 });
  });

  test('four columns inside a quote is indented code, and the scanner needs that', () => {
    assert.equal(lineContentOf('>     x').columns, 4);
  });
});
