import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines } from './run.ts';

/** Changed lines only. The '--- file' header starts with '-' too. */
const changes = (diff: string): string[] =>
  diff
    .split('\n')
    .filter((line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('--- '));

describe('the CLI diff', () => {
  test('an inserted blank line does not report the rest of the file as rewritten', () => {
    const diff = diffLines('x.md', 'a\n\nb\n\nc\n', 'a\n\n\nb\n\nc\n');
    assert.ok(!diff.includes('-b'), 'unchanged text reported as removed:\n' + diff);
    assert.ok(!diff.includes('+b'), 'unchanged text reported as added:\n' + diff);
    assert.equal(changes(diff).length, 1, 'one insertion should be one change:\n' + diff);
  });

  test('a changed line is reported both ways', () => {
    const diff = diffLines('x.md', '#标题\n', '# 标题\n');
    assert.ok(diff.includes('-#标题'));
    assert.ok(diff.includes('+# 标题'));
  });

  test('an identical document produces only the header', () => {
    assert.equal(diffLines('x.md', 'a\n', 'a\n'), '--- x.md\n');
  });

  test('an appended line is one change', () => {
    assert.deepEqual(changes(diffLines('x.md', 'a\n', 'a\nb\n')), ['+b']);
  });
});
