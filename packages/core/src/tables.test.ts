/**
 * TBL-01, the table surface.
 *
 * Padding is on by default, so most of these tests compare bytes; the ones that
 * matter most are the refusals - a ragged table, a delimiter row that disagrees
 * with its header, a row past the cap - because a table is the one block where
 * "less than asked" is invisible in the source.
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
  test('a body row after a blank line is not joined, and DET-13 refuses it', () => {
    // Only the header-to-delimiter gap is closed. A row after a blank line is
    // not joined, and because it still reads as a table row that belongs to no
    // table, DET-13 refuses the document rather than half-formatting it.
    const src = '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n| 3 | 4 |\n';
    const result = format(src, NORMALIZE);
    assert.equal(result.output, src);
    assert.deepEqual(
      result.diagnostics.map(({ ruleId, severity, line }) => ({ ruleId, severity, line })),
      [{ ruleId: 'DET-13', severity: 'error', line: 4 }],
    );
  });
  test('preserve sees two paragraphs and leaves them alone', () => {
    // The join is part of normalize, not a structural rule: under preserve the
    // blank line means these lines are not a table at all, so there is nothing to
    // hand back to the author unchanged.
    const src = '| a | b |\n\n| --- | --- |\n';
    assert.equal(out(src, { table: { mode: 'preserve' } }), src);
  });
});

describe('TBL-01 the cap is on by default', () => {
  const wide =
    '| a very long cell that goes past eighty columns on its own without any doubt | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n';

  test('a table wider than 80 columns is capped without being asked', () => {
    // A table is the one block whose source layout is its presentation, and 80
    // columns is where a terminal line ends; a cap nobody sets is a cap nobody has.
    assert.deepEqual(
      format(wide).diagnostics.map(({ severity, messageId }) => ({ severity, messageId })),
      [{ severity: 'info', messageId: 'tbl.rowsOverCap' }],
    );
  });

  test('and 80 is where it ends, not 79', () => {
    const exactly80 = '| a cell that makes this row exactly eighty columns wide, no more | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n';
    assert.deepEqual(format(exactly80).diagnostics, []);
  });
});

describe('TBL-01 maxWidth leaves a row out of the widths rather than out of the table', () => {
  const table = '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n';
  const CAPPED: FormatOptionsInput = { table: { mode: 'normalize', maxWidth: 30 } };

  test('a row past the cap does not set the column widths', () => {
    assert.equal(
      out(table, CAPPED),
      '| a very long cell indeed | b   |\n| --- | --- |\n| 1   | 2   |\n| x   | y   |\n',
    );
  });

  test('the rows past the cap are reported once, at the header, as info', () => {
    // One notice for the table, not one per row: the editor draws a squiggle per
    // diagnostic, and a wide table used to produce a column of them.
    const result = format(table, CAPPED);
    assert.deepEqual(
      result.diagnostics.map(({ ruleId, severity, line, messageId, args }) => ({
        ruleId,
        severity,
        line,
        messageId,
        args,
      })),
      [
        {
          ruleId: 'TBL-01',
          severity: 'info',
          line: 0,
          messageId: 'tbl.rowsOverCap',
          args: [1, 3, 30],
        },
      ],
    );
  });

  test('without a cap the long row sets the width for every row', () => {
    const uncapped = out(table);
    assert.match(uncapped, /^\| a very long cell indeed \| b   \|\n/);
    assert.match(uncapped, /\| 1 +\| 2 +\|\n/);
  });

  test('most rows past the cap do not stop the cap: the rows that fit set the columns', () => {
    // The old rule let the cap stand down whenever the rows past it were at least
    // half the table, which padded every short row out to the longest one. A row
    // past the cap is left out of the widths, full stop; it is not a reason to
    // stop normalising the table.
    const LONG = 'x'.repeat(90);
    const src =
      '| short | v |\n| --- | --- |\n| ' + LONG + ' | a |\n| ' + LONG + ' | b |\n| ' + LONG + ' | c |\n| d | e |\n';
    const result = format(src, CAPPED);
    assert.equal(
      result.output,
      '| short | v   |\n| ----- | --- |\n| ' + LONG + ' | a   |\n| ' + LONG + ' | b   |\n| ' + LONG + ' | c   |\n| d     | e   |\n',
    );
    assert.deepEqual(
      result.diagnostics.map(({ severity, line, messageId, args }) => ({
        severity,
        line,
        messageId,
        args,
      })),
      [{ severity: 'info', line: 0, messageId: 'tbl.rowsOverCap', args: [3, 5, 30] }],
    );
  });

  test('when no row is within the cap there is no width to normalise with, and the table is left alone', () => {
    // Not a branch about "every row is over": it is what an empty reference set
    // means. Nothing informs the columns, so nothing is rewritten.
    const LONG = 'x'.repeat(90);
    const src = '| ' + LONG + ' | v |\n| --- | --- |\n| ' + LONG + ' | a |\n| ' + LONG + ' | b |\n';
    const result = format(src, CAPPED);
    assert.equal(result.output, src);
    assert.deepEqual(
      result.diagnostics.map(({ severity, line, messageId, args }) => ({
        severity,
        line,
        messageId,
        args,
      })),
      [{ severity: 'info', line: 0, messageId: 'tbl.rowsOverCap', args: [3, 3, 30] }],
    );
  });

  test('a document with no cap has nothing to report', () => {
    assert.deepEqual(format(table, NORMALIZE).diagnostics, []);
  });

  test('the line it names is the line the author wrote, past a fence whose blank edges went away', () => {
    // BLK-12 removes lines, so a notice reported from the text it left behind has
    // to be mapped back: a rule that names the line it moved a problem to is the
    // bug this repository already paid for once.
    const src =
      '```\ncode\n\n\n```\n\n| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n';
    assert.deepEqual(
      format(src, CAPPED).diagnostics.map((diagnostic) => diagnostic.line),
      [6],
    );
  });
});
