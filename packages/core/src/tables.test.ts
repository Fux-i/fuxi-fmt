/**
 * TBL-01, the table surface.
 *
 * Padding is off by default, so most of these tests turn it on and compare bytes;
 * the ones that matter most are the refusals - a ragged table, a delimiter row
 * that disagrees with its header, a row past the cap - because a table is the one
 * block where "less than asked" is invisible in the source.
 *
 * Spec references: TBL-01, DET-10, SAFE-07.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import { displayWidth } from './tables.ts';
import type { FormatOptionsInput } from './options.ts';

const NORMALIZE: FormatOptionsInput = { table: { mode: 'normalize' } };
const out = (src: string, options: FormatOptionsInput = NORMALIZE): string => format(src, options).output;

describe('TBL-01 display width', () => {
  test('counts wide characters as two columns and combining marks as none', () => {
    assert.equal(displayWidth('abc', 2), 3);
    assert.equal(displayWidth('中文', 2), 4);
    assert.equal(displayWidth('中文', 1), 2);
    assert.equal(displayWidth('a\u0301', 2), 1);
    assert.equal(displayWidth('\u{1f600}', 2), 2);
  });
});

describe('TBL-01 padding and alignment', () => {
  test('pads cells to the column width and the delimiter row with them', () => {
    const src = '| a | bbbb |\n| --- | --- |\n| 111 | 2 |\n';
    assert.equal(out(src), '| a   | bbbb |\n| --- | ---- |\n| 111 | 2    |\n');
  });
  test('measures a column of Han characters as two columns each', () => {
    const src = '| 中文 | b |\n| --- | --- |\n| 1 | 2 |\n';
    assert.equal(out(src), '| 中文 | b   |\n| ---- | --- |\n| 1    | 2   |\n');
    assert.equal(
      out(src, { table: { mode: 'normalize', cjkWidth: 1 } }),
      '| 中文  | b   |\n| --- | --- |\n| 1   | 2   |\n',
    );
  });
  test('reproduces the declared alignment instead of inventing one', () => {
    const src = '| a | b | c |\n| :--- | ---: | :-: |\n| 1 | 2 | 3 |\n';
    assert.equal(out(src), '| a   |   b |  c  |\n| :-- | --: | :-: |\n| 1   |   2 |  3  |\n');
  });
  test('pads by default, because normalize is the default', () => {
    const src = '| a | bbbb |\n| --- | --- |\n| 111 | 2 |\n';
    assert.equal(out(src, {}), '| a   | bbbb |\n| --- | ---- |\n| 111 | 2    |\n');
  });
  test('preserve still leaves the author layout alone', () => {
    const src = '| a | bbbb |\n| --- | --- |\n| 111 | 2 |\n';
    assert.equal(out(src, { table: { mode: 'preserve' } }), src);
  });
  test('pads a table inside a block quote, marker chain included', () => {
    const src = '> | a | b |\n> | --- | --- |\n> | 1 | 2 |\n';
    assert.equal(out(src), '> | a   | b   |\n> | --- | --- |\n> | 1   | 2   |\n');
  });
  test('never reaches inside a fence', () => {
    const src = '```\n| a | bbbb |\n| --- | --- |\n| 111 | 2 |\n```\n';
    assert.equal(out(src), src);
  });
  test('escaped pipes are cell content, so they make no extra column', () => {
    const src = '| a \\| b | c |\n| --- | --- |\n| 1 | 2 |\n';
    assert.equal(out(src), '| a \\| b | c   |\n| ------ | --- |\n| 1      | 2   |\n');
  });
  test('settles in one pass', () => {
    const src = '| a | bbbb |\n| --- | --- |\n| 111 | 2 |\n';
    const once = out(src);
    assert.equal(out(once), once);
  });
});

describe('TBL-01 what padding refuses to touch', () => {
  test('a ragged table is left alone, and DET-10 says why', () => {
    const src = '| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n';
    const result = format(src, NORMALIZE);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics.map((d) => d.ruleId), ['DET-10']);
    assert.equal(result.diagnostics[0]?.line, 2);
  });
  test('a delimiter row that disagrees with its header is reported and not repaired', () => {
    const src = '| a | b |\n| --- |\n| 1 | 2 |\n';
    const result = format(src, NORMALIZE);
    assert.equal(result.output, src);
    assert.deepEqual(result.diagnostics.map((d) => d.ruleId), ['DET-10']);
    assert.equal(result.diagnostics[0]?.line, 1);
  });
  test('a pipe-less table stays pipe-less, so it stays a paragraph', () => {
    const src = 'a | bbbb\n--- | ---\n11 | 2\n';
    const result = format(src, NORMALIZE);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, 'a   | bbbb\n--- | ----\n11  | 2\n');
  });
});

describe('TBL-01 the header row decides the content column', () => {
  test('a delimiter row written with extra indentation joins its table', () => {
    const src = '| A   | b     |\n  | --- | ----- |\n| 1   | 2 333 |\n';
    assert.equal(out(src), '| A   | b     |\n| --- | ----- |\n| 1   | 2 333 |\n');
  });
  test('an indented body row is dedented to the header', () => {
    assert.equal(
      out('| a | b |\n| --- | --- |\n  | 1 | 2 |\n'),
      '| a   | b   |\n| --- | --- |\n| 1   | 2   |\n',
    );
  });
  test('an indented header moves the whole table to its column', () => {
    assert.equal(
      out('  | a | b |\n| --- | --- |\n| 1 | 2 |\n'),
      '  | a   | b   |\n  | --- | --- |\n  | 1   | 2   |\n',
    );
  });
  test('the quote chain is kept and only the whitespace after it is rewritten', () => {
    assert.equal(
      out('> | a | b |\n>   | --- | --- |\n> | 1 | 2 |\n'),
      '> | a   | b   |\n> | --- | --- |\n> | 1   | 2   |\n',
    );
  });
  test('a nested quote table aligns inside its own chain', () => {
    assert.equal(
      out('> > | a | b |\n> > | --- | --- |\n> >   | 1 | 2 |\n'),
      '> > | a   | b   |\n> > | --- | --- |\n> > | 1   | 2   |\n',
    );
  });
  test('a table that starts a list item is never split by a blank line', () => {
    const src = '- | a | b |\n  | --- | --- |\n  | 1 | 2 |\n';
    assert.equal(out(src), '- | a   | b   |\n  | --- | --- |\n  | 1   | 2   |\n');
  });
  test('a quoted table is never split by a blank line either', () => {
    const src = '> | a | b |\n> | --- | --- |\n> | 1 | 2 |\n';
    assert.equal(out(src), '> | a   | b   |\n> | --- | --- |\n> | 1   | 2   |\n');
  });
  test('settles in one pass from an indented delimiter row', () => {
    const once = out('| A   | b     |\n  | --- | ----- |\n| 1   | 2 333 |\n');
    assert.equal(out(once), once);
  });
});
describe('TBL-01 a header and its delimiter row are joined', () => {
  test('a blank line between them is closed, and the table pads', () => {
    assert.equal(out('| a | b |\n\n| --- | --- |\n'), '| a   | b   |\n| --- | --- |\n');
  });
  test('the same inside a block quote, marker chain included', () => {
    assert.equal(out('> | a | b |\n>\n> | --- | --- |\n'), '> | a   | b   |\n> | --- | --- |\n');
  });
  test('two blank lines are closed too', () => {
    assert.equal(out('| a | b |\n\n\n| --- | --- |\n'), '| a   | b   |\n| --- | --- |\n');
  });
  test('a body row after a blank line is not joined', () => {
    // Only the header-to-delimiter gap is closed. A row after a blank line has
    // nothing above it announcing a table, so it stays the paragraph it is.
    const src = '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n| 3 | 4 |\n';
    assert.equal(out(src), '| a   | b   |\n| --- | --- |\n| 1   | 2   |\n\n| 3 | 4 |\n');
  });
  test('preserve sees two paragraphs and leaves them alone', () => {
    // The join is part of normalize, not a structural rule: under preserve the
    // blank line means these lines are not a table at all, so there is nothing to
    // hand back to the author unchanged.
    const src = '| a | b |\n\n| --- | --- |\n';
    assert.equal(out(src, { table: { mode: 'preserve' } }), src);
  });
});

describe('TBL-01 maxWidth skips a line rather than the table', () => {
  const table = '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n';
  test('a row past the cap keeps its bytes and the others pad narrow', () => {
    const capped = out(table, { table: { mode: 'normalize', maxWidth: 30 } });
    assert.equal(
      capped,
      '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n',
    );
  });
  test('without a cap the long row sets the width for every row', () => {
    const uncapped = out(table);
    assert.match(uncapped, /^\| a very long cell indeed \| b   \|\n/);
    assert.match(uncapped, /\| 1 +\| 2 +\|\n/);
  });
});
