import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { offsetToPosition } from './positions.ts';

describe('offset to position', () => {
  test('the start of the document', () => {
    assert.deepEqual(offsetToPosition('abc', 0), { line: 0, character: 0 });
  });
  test('within the first line', () => {
    assert.deepEqual(offsetToPosition('abc\ndef', 2), { line: 0, character: 2 });
  });
  test('the start of the second line', () => {
    assert.deepEqual(offsetToPosition('abc\ndef', 4), { line: 1, character: 0 });
  });
  test('the end of the document', () => {
    assert.deepEqual(offsetToPosition('abc\ndef', 7), { line: 1, character: 3 });
  });
  test('clamps beyond the end', () => {
    assert.deepEqual(offsetToPosition('abc', 99), { line: 0, character: 3 });
  });
  test('counts an empty trailing line', () => {
    assert.deepEqual(offsetToPosition('abc\n', 4), { line: 1, character: 0 });
  });
});
