import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits, diffEdits } from './diff.ts';

describe('minimal edits', () => {
  test('identical text has no edits', () => {
    assert.deepEqual(diffEdits('a\nb\n', 'a\nb\n'), []);
  });

  test('a changed line is one edit', () => {
    const edits = diffEdits('a\nb\nc\n', 'a\nB\nc\n');
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.text, 'B\n');
  });

  test('an inserted line is one edit with an empty region', () => {
    const edits = diffEdits('a\nc\n', 'a\nb\nc\n');
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.start, edits[0]?.end);
    assert.equal(edits[0]?.text, 'b\n');
  });

  test('a deleted line is one edit with no replacement', () => {
    const edits = diffEdits('a\nb\nc\n', 'a\nc\n');
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.text, '');
  });

  test('scattered edits produce scattered edits, not one wide one', () => {
    const edits = diffEdits('a\nb\nc\nd\ne\n', 'a\nB\nc\nd\nE\n');
    assert.equal(edits.length, 2, JSON.stringify(edits));
  });

  test('applying the edits reproduces the target', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['#标题\n', '# 标题\n'],
      ['a\nc\n', 'a\nb\nc\n'],
      ['a\nb\nc\n', 'a\nc\n'],
      ['a\nb\nc\nd\ne\n', 'a\nB\nc\nd\nE\n'],
      ['#标题\n\n中文abc,中文\n', '# 标题\n\n中文 abc，中文\n'],
      ['', 'a\n'],
      ['a\n', ''],
      ['no trailing newline', 'still none'],
    ];
    for (const [before, after] of cases) {
      assert.equal(applyEdits(before, diffEdits(before, after)), after, JSON.stringify({ before, after }));
    }
  });

  test('applying the edits to identical text is a no-op', () => {
    assert.equal(applyEdits('a\n', diffEdits('a\n', 'a\n')), 'a\n');
  });
});
