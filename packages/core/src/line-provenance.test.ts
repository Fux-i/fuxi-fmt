/**
 * GRT-04: a diagnostic names the line the author wrote.
 *
 * The blank-line policy inserts and removes lines, so the text the later passes
 * hold is not the text the author wrote. Every pass that reports a line maps
 * through this, and it is now the only such mapping: it used to be two closures
 * inside format(), with two different give-up rules.
 *
 * Spec references: GRT-04, BLK-01, DET-01.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineProvenance } from './format.ts';
import { splitSourceLines } from './scan.ts';

// 'a'; an invented blank the policy inserted; 'b', which the author wrote on input line 2.
const REBUILT = 'a\n\nb';
const FROM = [0, -1, 2];

describe('GRT-04 where a rebuilt line came from', () => {
  const map = lineProvenance(splitSourceLines(REBUILT), FROM);

  test('a line the policy kept names the input line it came from', () => {
    assert.equal(map.lineAt(0), 0);
    assert.equal(map.lineAt(2), 2);
  });

  test('a line the policy invented has no input line', () => {
    assert.equal(map.lineAt(1), undefined);
  });

  test('a line the map does not cover has no input line', () => {
    assert.equal(map.lineAt(9), undefined);
  });

  test('an offset maps by the line it sits on', () => {
    assert.equal(map.offsetAt(0), 0);
    assert.equal(map.offsetAt(2), undefined);
    assert.equal(map.offsetAt(3), 2);
  });

  test('an offset before the document has no line, and past the end is the last line', () => {
    assert.equal(map.offsetAt(-1), undefined);
    assert.equal(map.offsetAt(99), 2);
  });
});
