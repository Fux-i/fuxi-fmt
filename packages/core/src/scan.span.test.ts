import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanRegions } from './scan.ts';

const slices = (src: string) =>
  scanRegions(src).map((region) => [region.kind, src.slice(region.start, region.end)] as const);

describe('scan: inline code span boundaries', () => {
  test('never pairs backticks across a blank line', () => {
    const src = 'an unmatched ` tick\n\nmore text and a closing ` tick\n';
    assert.deepEqual(slices(src), []);
  });
  test('still pairs across a single line break', () => {
    const src = 'a `spans\ntwo lines` b\n';
    assert.deepEqual(slices(src), [['inlineCode', '`spans\ntwo lines`']]);
  });
});
