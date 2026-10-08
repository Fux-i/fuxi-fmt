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
  test('does not turn a thematic break into a list item', () => {
    // What this test guards is BLK-07: a break is not a list, whatever character
    // it is written with. BLK-13 then rewrites the character, which is its job.
    assert.equal(out('* * *\n', { thematicBreak: 'preserve' }), '* * *\n');
    assert.equal(out('* * *\n'), '---\n');
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
      out('~~~js\nx\n~~~\n', { codeBlock: { fenceChar: 'backticks', fenceLength: false } }),
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
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-01');
    assert.equal(result.diagnostics[0]?.line, 0);
  });
  // An unterminated fence swallows every line after it, so what a refusal damages
  // is the content BEFORE it: a heading with no connection to the fence comes out
  // unformatted. That is still true, and still deliberate - an unterminated block
  // is an error. What is no longer true is that it happens in silence: DET-01
  // names the fence, so the author knows which line to fix instead of wondering
  // why half their document stopped responding.
  test('an over-indented closer refuses the document instead of half-formatting it', () => {
    const result = format('#  heading\n\n```js\na ``` b\n    ```\n');
    assert.equal(result.output, '#  heading\n\n```js\na ``` b\n    ```\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-01');
    assert.equal(result.diagnostics[0]?.line, 2);
  });
  test('a trailing blank line does not change the outcome', () => {
    const src = '```js\na ``` b\n    ```\n\n';
    const result = format(src);
    assert.equal(result.output, src);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-01');
  });
});

describe('BLK-13 thematic break character', () => {
  test('normalises every form to three dashes by default', () => {
    for (const src of ['***', '___', '-----', '* * *', '_ _ _', '- - -']) {
      assert.equal(out(src + '\n'), '---\n');
    }
  });
  test('keeps the indentation the author wrote', () => {
    assert.equal(out('  ***\n'), '  ---\n');
  });
  test('can use asterisks, underscores, or preserve', () => {
    assert.equal(out('---\n', { thematicBreak: 'asterisks' }), '***\n');
    assert.equal(out('---\n', { thematicBreak: 'underscores' }), '___\n');
    assert.equal(out('*****\n', { thematicBreak: 'preserve' }), '*****\n');
  });
  test('leaves a setext heading underline alone', () => {
    // 'text' + '---' is an H2, and the two lines are one block so that nothing
    // inserts a blank line between them and rewrites the heading.
    assert.equal(out('text\n---\n'), 'text\n---\n');
    assert.equal(out('标题\n---\n'), '标题\n---\n');
  });
  test('normalises a break that the blank-line policy has separated', () => {
    // Separate blocks, so a blank line comes first and the dashes are then safe.
    assert.equal(out('text\n***\n'), 'text\n\n---\n');
    assert.equal(out('text\n\n* * *\n'), 'text\n\n---\n');
  });
  test('does not turn the first line into front matter', () => {
    assert.equal(out('***\ntitle: x\n\nbody\n'), '***\n\ntitle: x\n\nbody\n');
  });
  test('normalises a break inside a block quote, and stops where it would not be one', () => {
    assert.equal(out('> ***\n'), '> ---\n');
    assert.equal(out('> > ***\n'), '> > ---\n');
    // Inside a quote the blank is a '>' line, so the break is separated from the
    // paragraph and the dashes are safe - the same answer the top level gets.
    assert.equal(out('> text\n> ***\n'), '> text\n>\n> ---\n');
  });
  test('settles in one pass', () => {
    const src = '***\n\ntext\n\n* * *\n\n> ___\n\n标题\n---\n';
    const once = out(src);
    assert.equal(out(once), once);
  });
});
