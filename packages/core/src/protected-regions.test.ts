/**
 * SAFE-01 at line level, answered once.
 *
 * The formatter must not touch the lines a protected region covers. That
 * reading used to live privately in format.ts and was copied, line for line,
 * into the corpus test - so the test that existed to check it could not detect
 * a change to it. This is the one owner.
 *
 * Every input below ends without a newline, so the line array is exactly the
 * lines named in the expectation: splitSourceLines would otherwise add the
 * empty line a trailing newline produces.
 *
 * Spec references: SAFE-01, SAFE-02, SAFE-03, SAFE-04, FM-01.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import { protectedLines, scanRegions, splitSourceLines } from './scan.ts';

const linesOf = (text: string): boolean[] =>
  protectedLines(text, splitSourceLines(text), scanRegions(text));

describe('SAFE-01 the lines a protected region covers', () => {
  test('a fence protects every line it occupies, and not the one after', () => {
    assert.deepEqual(linesOf('```\ncode\n```\ndone'), [true, true, true, false]);
  });

  test('front matter is protected to its closing line', () => {
    assert.deepEqual(linesOf('---\na: 1\n---\nbody'), [true, true, true, false]);
  });

  test('an indented code block is protected', () => {
    assert.deepEqual(linesOf('    x\ny'), [true, false]);
  });

  test('a single-line inline span does not protect its line', () => {
    // A code span is byte-verbatim, but its line is still prose the rules own.
    assert.deepEqual(linesOf('a `x` b'), [false]);
  });

  test('an inline region that contains a line ending protects both lines', () => {
    assert.deepEqual(linesOf('a <!-- c\nd --> b'), [true, true]);
  });
});

describe('SAFE-01 a fence nested in a list keeps its body', () => {
  // The body used to be prose: the fence was read at column 4 against the left
  // margin, so TYPO-01 inserted spaces into code and the hygiene pass trimmed a
  // trailing space inside it - with no diagnostic in either case.
  test('CJK next to Latin in the body is not spaced out', () => {
    const src = '- a\n  - b\n    ```c\n    中文abc混排\n\n    第二段\n    ```\n';
    const result = format(src);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), []);
  });

  test('a trailing space in the body survives', () => {
    const src = '- a\n  - b\n    ```c\n    中文abc \n    ```\n';
    const result = format(src);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), []);
  });
});

describe('SAFE-01 a fence that is the item own content', () => {
  test('the body is left alone and the document is not refused', () => {
    const src = '- ```c\n  中文abc混排\n  ```\n';
    const result = format(src);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, src);
  });
});

describe('SAFE-01 a fence inside a tab-indented list', () => {
  test('the list keeps its tab, so the fence does not move out of it', () => {
    // Expanding the tab above the fence but not inside it would move the fence
    // out of its container, and the guard refused the document for it.
    const src = '- a\n\t- b\n\t\t```\n\t\tx\n\t\t```\n';
    const result = format(src);
    assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), []);
    assert.equal(result.output, src);
  });
});

describe('SAFE-03 a code span between two fences', () => {
  test('the span keeps its bytes and the prose around it is spaced', () => {
    const src = '```\na\n\nb\n```\n把`x中文`写好看\n```\nc\n```\n';
    const result = format(src);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, '```\na\n\nb\n```\n\n把 `x中文` 写好看\n\n```\nc\n```\n');
  });
});
