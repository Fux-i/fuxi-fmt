/**
 * TBL-01: table alignment and cell padding.
 *
 * A GFM table is the one block where the source layout *is* the presentation: the
 * columns only line up if the spaces line up, and nothing else in Markdown has
 * that property. So padding is off by default (`table.mode: "preserve"`) and on
 * when asked for.
 *
 * Three decisions are worth stating rather than discovering:
 *
 * - **Width is display width, not code points.** A column of Han characters is
 *   only aligned if each of them counts as two columns, which is what a
 *   fixed-pitch font does with East Asian Wide and Fullwidth characters. It is a
 *   convention rather than a law - a proportional font, or one whose CJK glyphs
 *   are not exactly two Latin advances, will still look ragged - so `table.cjkWidth`
 *   makes it the reader's choice rather than the formatter's assumption. Unicode's
 *   East Asian *Ambiguous* class (Greek, `°`, `±`, box drawing) counts as one
 *   column, which is what editor fonts do.
 * - **Alignment is read, never invented.** The delimiter row's colons are the
 *   author's declaration; this rule reproduces them and pads the dashes to the
 *   column width. A column with no colon stays left-aligned without gaining one.
 * - **A row that would exceed `table.maxWidth` is left byte-identical.** That is
 *   the whole point of the cap: one long row should not make every other row long
 *   as well, and wrapping a cell is not something GFM can do - a row is one line,
 *   and `<br>` would be adding content rather than laying it out.
 *
 * Spec references: TBL-01, SAFE-07, NG-02.
 */

import { contentStartOf, quotePrefix } from './blocks.ts';
import type { TableOptions } from './options.ts';

/** Cell contents that differ from the header's are DET-10's business, not this rule's. */
export interface TableRow {
  /** Everything before the first cell: indentation, block quote markers. */
  readonly prefix: string;
  readonly cells: readonly string[];
  /** Whether the row was written with an outer pipe on each side. */
  readonly leadingPipe: boolean;
  readonly trailingPipe: boolean;
}

const DELIMITER_CELL = /^\s*:?-+:?\s*$/;

/** Split a row into cells, where `\|` is content rather than a separator. */
function splitCells(content: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < content.length; i++) {
    const ch = content.charAt(i);
    if (ch === '\\' && content.charAt(i + 1) === '|') {
      cell += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += ch;
  }
  cells.push(cell);
  return cells;
}

function group(content: string): { cells: string[]; leading: boolean; trailing: boolean } {
  const parts = splitCells(content);
  let leading = false;
  let trailing = false;
  if (parts.length > 0 && (parts[0] ?? '').trim().length === 0) {
    leading = true;
    parts.shift();
  }
  if (parts.length > 0 && (parts[parts.length - 1] ?? '').trim().length === 0) {
    trailing = true;
    parts.pop();
  }
  return { cells: parts, leading, trailing };
}

/** A row of a table, or null when the line is not one (no pipe at all). */
export function tableRow(line: string): TableRow | null {
  const at = contentStartOf(line);
  const content = line.slice(at);
  if (!content.includes('|')) return null;
  const grouped = group(content);
  if (grouped.cells.length === 0) return null;
  return {
    prefix: line.slice(0, at),
    cells: grouped.cells,
    leadingPipe: grouped.leading,
    trailingPipe: grouped.trailing,
  };
}

/** The delimiter row's cells, or null when the line is not a delimiter row. */
function delimiterCells(line: string): string[] | null {
  const row = tableRow(line);
  if (row === null) return null;
  if (row.cells.length === 0) return null;
  for (const cell of row.cells) if (!DELIMITER_CELL.test(cell)) return null;
  return [...row.cells];
}

/** True when the line declares the column alignment of the table above it. */
export function isDelimiterRow(line: string): boolean {
  return delimiterCells(line) !== null;
}

/**
 * Display width in columns.
 *
 * Wide and fullwidth characters are `cjkWidth` columns, combining marks and
 * joiners are none, everything else is one. Surrogate pairs are read as one code
 * point, so an emoji is two columns rather than four.
 */
export function displayWidth(text: string, cjkWidth: 1 | 2): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i) ?? 0;
    if (code > 0xffff) i++;
    width += charWidth(code, cjkWidth);
  }
  return width;
}

function charWidth(code: number, cjkWidth: 1 | 2): number {
  // Combining marks and variation selectors take no column of their own.
  if ((code >= 0x0300 && code <= 0x036f) || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  if (code === 0x200b || code === 0x200d || code === 0xfeff) return 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  ) {
    return cjkWidth;
  }
  return 1;
}

type Align = 'none' | 'left' | 'right' | 'center';

function alignmentOf(cell: string): Align {
  const text = cell.trim();
  const left = text.startsWith(':');
  const right = text.endsWith(':');
  if (left && right) return 'center';
  if (left) return 'left';
  if (right) return 'right';
  return 'none';
}

/** A column is at least three wide so the delimiter row can carry its colons. */
const MIN_COLUMN = 3;

function renderCell(text: string, width: number, align: Align, cjkWidth: 1 | 2): string {
  const content = text.trim();
  const space = width - displayWidth(content, cjkWidth);
  if (space <= 0) return content;
  if (align === 'right') return ' '.repeat(space) + content;
  if (align === 'center') {
    const before = Math.floor(space / 2);
    return ' '.repeat(before) + content + ' '.repeat(space - before);
  }
  return content + ' '.repeat(space);
}

function renderDelimiter(align: Align, width: number): string {
  const colons = (align === 'left' || align === 'right' ? 1 : 0) + (align === 'center' ? 2 : 0);
  const dashes = Math.max(1, width - colons);
  const run = '-'.repeat(dashes);
  if (align === 'left') return ':' + run;
  if (align === 'right') return run + ':';
  if (align === 'center') return ':' + run + ':';
  return run;
}

/**
 * Render one row.
 *
 * `outer` is the table's own convention - pipes on the outside or not - taken from
 * the header row. It is not decoration: a pipe-less table classifies as a
 * paragraph, and adding the pipes would change what the line *is* for every pass
 * that reads the classification. GFM reads both forms the same way; this formatter
 * has one classifier, so the author's form is kept.
 */
/**
 * The prefix a row is rendered with.
 *
 * A table only lines up if every row starts its content at the same column, and
 * the header row is the anchor: it is the table's first line and it may carry a
 * list marker or a quote chain that cannot move. So a row whose prefix is its
 * chain plus whitespace gets that whitespace rewritten to reach the header's
 * column. Two rows keep what they have: one whose prefix carries a block marker
 * of its own (a table that starts a list item), and one whose chain already
 * reaches the column - eating the separator would leave '>| a |', which BLK-09
 * would put back on the next pass.
 */
function normalizePrefix(row: TableRow, contentColumn: number): string {
  const chainEnd = quotePrefix(row.prefix).end;
  // A prefix that carries a block marker of its own is the row's structure, not
  // its layout: '- | a | b |' opens the list item this table lives in.
  if (row.prefix.slice(chainEnd).trim().length > 0) return row.prefix;
  // The chain keeps its separator: '>| a |' is not what BLK-09 leaves behind, and
  // a chain that already reaches past the column cannot be aligned without it.
  const minimum = chainEnd === 0 ? 0 : 1;
  return row.prefix.slice(0, chainEnd) + ' '.repeat(Math.max(minimum, contentColumn - chainEnd));
}

function renderRow(
  row: TableRow,
  widths: readonly number[],
  aligns: readonly Align[],
  cjkWidth: 1 | 2,
  outer: boolean,
  contentColumn: number,
): string {
  const last = row.cells.length - 1;
  const cells = row.cells.map((cell, index) => {
    // A pipe-less row has no outer pipes to hold the padding in. Trailing
    // whitespace at the end of the line would be trimmed away - and exactly two
    // trailing spaces are a Markdown hard break, so padding there could *invent*
    // one. Leading padding is worse still: four columns of it is an indented code
    // block. Both edges therefore stay where the author put them, and the colons
    // in the delimiter row still declare the alignment.
    if (!outer && index === 0) return cell.trim() + ' '.repeat(Math.max(0, (widths[index] ?? MIN_COLUMN) - displayWidth(cell.trim(), cjkWidth)));
    if (!outer && index === last) return cell.trim();
    return renderCell(cell, widths[index] ?? MIN_COLUMN, aligns[index] ?? 'none', cjkWidth);
  });
  return normalizePrefix(row, contentColumn) + (outer ? '| ' + cells.join(' | ') + ' |' : cells.join(' | '));
}

/**
 * Pad every table in the line array.
 *
 * Lines are changed but never added or removed, so every pass that indexes by line
 * still sees the document it was built for.
 */
export function normalizeTables(
  texts: readonly string[],
  options: TableOptions,
  isProtected: (index: number) => boolean,
): string[] {
  const out = texts.slice();
  if (options.mode === 'preserve') return out;

  let i = 0;
  while (i + 1 < texts.length) {
    const header = tableRow(texts[i] ?? '');
    const delimiters = header === null ? null : delimiterCells(texts[i + 1] ?? '');
    if (header === null || delimiters === null || isProtected(i) || isProtected(i + 1)) {
      i++;
      continue;
    }

    const rows: TableRow[] = [];
    let end = i + 2;
    while (end < texts.length) {
      const row = tableRow(texts[end] ?? '');
      if (row === null || isProtected(end)) break;
      rows.push(row);
      end++;
    }

    // A ragged table cannot be padded - a missing cell is a content error that
    // padding would hide - and neither can one whose delimiter row disagrees with
    // its header. DET-10 reports both; this rule steps around them.
    const columns = header.cells.length;
    const complete =
      delimiters.length === columns && rows.every((row) => row.cells.length === columns);
    if (!complete) {
      i = end;
      continue;
    }

    const aligns = delimiters.map(alignmentOf);
    const outer = header.leadingPipe;
    // The anchor every row is measured against: where the header's content starts.
    const contentColumn = header.prefix.length;
    const all = [header, ...rows];
    const natural = (subset: readonly TableRow[]): number[] =>
      Array.from({ length: columns }, (_, column) =>
        Math.max(
          MIN_COLUMN,
          ...subset.map((row) => displayWidth((row.cells[column] ?? '').trim(), options.cjkWidth)),
        ),
      );

    const limit = options.maxWidth;
    let widths = natural(all);
    const skipped = new Set<TableRow>();
    if (limit !== null) {
      for (const row of all) {
        if (displayWidth(renderRow(row, widths, aligns, options.cjkWidth, outer, contentColumn), options.cjkWidth) > limit) {
          skipped.add(row);
        }
      }
      if (skipped.size > 0) {
        // Widths are recomputed without the long rows, so one wide cell cannot
        // stretch every other row to its size. Rows already marked stay marked:
        // the set has to settle, or the same table would pad differently depending
        // on where the pass started.
        const kept = all.filter((row) => !skipped.has(row));
        if (kept.length === 0) {
          i = end;
          continue;
        }
        widths = natural(kept);
      }
    }

    if (!skipped.has(header)) {
      out[i] = renderRow(header, widths, aligns, options.cjkWidth, outer, contentColumn);
    }
    const delimiterRow = tableRow(texts[i + 1] ?? '');
    if (delimiterRow !== null && !skipped.has(delimiterRow)) {
      const rendered = delimiters
        .map((cell, column) => renderDelimiter(alignmentOf(cell), widths[column] ?? MIN_COLUMN))
        .join(' | ');
      out[i + 1] = normalizePrefix(delimiterRow, contentColumn) + (outer ? '| ' + rendered + ' |' : rendered);
    }
    for (let offset = 0; offset < rows.length; offset++) {
      const row = rows[offset];
      if (row === undefined || skipped.has(row)) continue;
      out[i + 2 + offset] = renderRow(row, widths, aligns, options.cjkWidth, outer, contentColumn);
    }

    i = end;
  }

  return out;
}
