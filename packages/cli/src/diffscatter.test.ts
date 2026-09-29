import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines } from './run.ts';

/** Changed lines only. The '--- file' header starts with '-' too. */
const changes = (diff: string): string[] =>
  diff
    .split('\n')
    .filter((line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('--- '));

describe('the CLI diff resynchronises', () => {
  test('edits scattered through a document report only the edits', () => {
    const before = 'a\nb\nc\nd\ne\nf\n';
    const after = 'a\nB\nc\nd\nE\nf\n';
    assert.deepEqual(changes(diffLines('x.md', before, after)), ['-b', '+B', '-e', '+E']);
  });

  test('an insertion in the middle does not disturb what follows', () => {
    const before = 'a\nb\nc\n';
    const after = 'a\nb\nnew\nc\n';
    assert.deepEqual(changes(diffLines('x.md', before, after)), ['+new']);
  });

  test('a deletion in the middle does not disturb what follows', () => {
    const before = 'a\nb\nnew\nc\n';
    const after = 'a\nb\nc\n';
    assert.deepEqual(changes(diffLines('x.md', before, after)), ['-new']);
  });
});
