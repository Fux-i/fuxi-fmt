import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('BLK-07 unordered list marker normalisation', () => {
  test('converts asterisk and plus markers to dashes by default', () => {
    assert.equal(out('* item\n'), '- item\n');
    assert.equal(out('+ item\n'), '- item\n');
  });
  test('preserves nesting indentation', () => {
    assert.equal(out('  *   nested\n'), '  - nested\n');
  });
  test('can switch to asterisks', () => {
    assert.equal(out('- item\n', { list: { unorderedMarker: 'asterisks' } }), '* item\n');
  });
  test('can preserve the author marker', () => {
    assert.equal(out('+ item\n', { list: { unorderedMarker: 'preserve' } }), '+ item\n');
  });
  test('does not touch a thematic break', () => {
    assert.equal(out('* * *\n'), '* * *\n');
  });
  test('does not touch emphasis', () => {
    assert.equal(out('*emphasis* text\n'), '*emphasis* text\n');
  });
  test('never touches a fence', () => {
    const src = '```\n* item\n```\n';
    assert.equal(out(src), src);
  });
});

describe('BLK-10 code fence delimiter normalisation', () => {
  test('converts a tilde fence to backticks', () => {
    assert.equal(out('~~~js\ncode\n~~~\n'), '```js\ncode\n```\n');
  });
  test('leaves a backtick fence alone', () => {
    assert.equal(out('```js\ncode\n```\n'), '```js\ncode\n```\n');
  });
  test('can convert to tildes', () => {
    assert.equal(
      out('```js\ncode\n```\n', { codeBlock: { fenceChar: 'tildes' } }),
      '~~~js\ncode\n~~~\n',
    );
  });
  test('can preserve the fence character', () => {
    assert.equal(
      out('~~~js\ncode\n~~~\n', { codeBlock: { fenceChar: 'preserve' } }),
      '~~~js\ncode\n~~~\n',
    );
  });
  test('keeps the info string and its spacing verbatim', () => {
    assert.equal(out('~~~ c {3, 4}\nx\n~~~\n'), '``` c {3, 4}\nx\n```\n');
  });
  test('lengthens the fence past the longest run in the body', () => {
    assert.equal(out('```\na ``` b\n```\n'), '````\na ``` b\n````\n');
  });
  test('preserves the delimiter indentation', () => {
    assert.equal(out('  ~~~js\n  x\n  ~~~\n'), '  ```js\n  x\n  ```\n');
  });
  test('keeps the original length when length normalisation is off', () => {
    assert.equal(
      out('~~~js\nx\n~~~\n', { codeBlock: { fenceChar: 'backticks', normalizeLength: false } }),
      '```js\nx\n```\n',
    );
  });
  test('leaves an unterminated fence alone', () => {
    const src = '~~~js\nnever closed\n';
    assert.equal(out(src), src);
  });
  // A closing fence indented more than three columns past the opener is not a
  // closer to the scanner (scan.ts), so this pass must not treat it as one. The
  // two disagreed: the rewrite tripped SAFE-01, and a guard failure refuses the
  // whole document, so one malformed fence silently unformatted every other
  // block around it. Adding a blank line after the same line removed the
  // rewrite entirely. Same input, two outcomes, neither of them the right one.
  test('does not treat an over-indented line as a closing fence', () => {
    const src = '```js\na ``` b\n    ```\n';
    const result = format(src);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics, []);
  });
  // An unterminated fence swallows every line after it, so what the guard
  // failure damaged was the content BEFORE it: a heading with no connection to
  // the fence came out unformatted because the refusal is document-wide.
  test('an over-indented closer does not suppress the rest of the document', () => {
    assert.equal(
      out('#  heading\n\n```js\na ``` b\n    ```\n'),
      '# heading\n\n```js\na ``` b\n    ```\n',
    );
  });
  test('a trailing blank line does not change the outcome', () => {
    const src = '```js\na ``` b\n    ```\n\n';
    const result = format(src);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics, []);
  });
});
