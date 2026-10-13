/**
 * The per-line normalisation, before anything is segmented.
 *
 * BLK-11 expands the hard tabs, BLK-04/05/07/09 write the markers, BLK-06
 * renumbers the ordered ones and BLK-10 sets the fence character and length. All
 * of them keep the line count, which is exactly why they may run on the line array
 * here: the ranges the segmenter and the fence pass hold are line indices.
 *
 * Spec references: BLK-04, BLK-05, BLK-06, BLK-07, BLK-09, BLK-10, BLK-11.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLines } from './format.ts';
import { resolveOptions } from './options.ts';
import { splitSourceLines } from './scan.ts';

const linesOf = (text: string) => splitSourceLines(text).map((line) => line.text);
const protectNone = (text: string): boolean[] => linesOf(text).map(() => false);

describe('BLK-11/BLK-07 the per-line normalisation', () => {
  test('a hard tab is expanded to the configured width', () => {
    const source = '- a\tb';
    const options = resolveOptions({ list: { tabWidth: 4 } });
    assert.deepEqual(normalizeLines(splitSourceLines(source), protectNone(source), options, []), ['- a    b']);
  });

  test('an unordered marker is normalised to the configured one', () => {
    const source = '* item';
    const options = resolveOptions();
    assert.deepEqual(normalizeLines(splitSourceLines(source), protectNone(source), options, []), ['- item']);
  });

  test('a protected line is copied byte for byte', () => {
    const source = '*  keep\tme';
    const options = resolveOptions();
    assert.deepEqual(normalizeLines(splitSourceLines(source), [true], options, []), ['*  keep\tme']);
  });

  test('a lazy all-ones ordered list is left as written by default', () => {
    // BLK-06: keep-all-ones is the default, so a list the author wrote with lazy
    // markers keeps them - renumbering it would be a diff for nothing.
    const source = '1. a\n1. b\n1. c';
    const options = resolveOptions();
    assert.deepEqual(normalizeLines(splitSourceLines(source), protectNone(source), options, []), [
      '1. a',
      '1. b',
      '1. c',
    ]);
  });

  test('renumber counts the list sequentially when asked', () => {
    const source = '1. a\n1. b\n1. c';
    const options = resolveOptions({ list: { orderedStyle: 'renumber' } });
    assert.deepEqual(normalizeLines(splitSourceLines(source), protectNone(source), options, []), [
      '1. a',
      '2. b',
      '3. c',
    ]);
  });
});
