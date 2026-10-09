/**
 * Detection: what the formatter had to guess.
 *
 * fuxi-fmt protects a region by parsing the document, and every rule here reports
 * a place where that parse was a guess rather than a reading. This is not a linter
 * (NG-12): nothing here holds an opinion about the prose. It is the formatter
 * admitting where it may have done less than the author asked for.
 *
 * One rule decides the severity. A region that never terminated swallowed the
 * rest of the document, so the file is refused and the author is told: formatting
 * the remainder of a document we already know we misread is guessing twice. A
 * suspicion that did terminate is a warning, and the document formats.
 *
 * Spec references: DET-01, DET-03, GRT-04.
 */

import { contentStartOf } from './blocks.ts';

const BACKSLASH = 92;
import type { CharRange } from './ignores.ts';
import { assignParents, scanListItems } from './list-scan.ts';
import { isDelimiterRow as isTableDelimiterRow, scanTables } from './tables.ts';
import type { MessageArgs, MessageId } from './messages.ts';
import { isEscaped, type Region, type SourceLine } from './scan.ts';

const BACKTICK = 96;
const DOLLAR = 36;
const PIPE = 124;

export interface Detection {
  readonly ruleId: string;
  /** The catalogue entry (CFG-08). The English is rendered by the caller. */
  readonly messageId: MessageId;
  readonly args: MessageArgs;
  readonly line: number | undefined;
  /** 'info' reports what the formatter did, not a complaint about the document. */
  readonly severity: 'error' | 'warning' | 'info';
}

/** 0-based line containing an offset, by binary search over the line starts. */
function lineOfOffset(lines: readonly SourceLine[], offset: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    if (line === undefined) break;
    if (line.start <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Every protected character, plus anything the author told us to ignore.
 *
 * Built from the regions the scanner already found rather than by scanning again:
 * two scans can disagree, and then a rule fires inside a code block.
 */
function claimedMask(
  source: string,
  regions: readonly Region[],
  extra: readonly CharRange[],
): Uint8Array {
  const mask = new Uint8Array(source.length);
  for (const range of [...regions, ...extra]) {
    const from = Math.max(0, range.start);
    const to = Math.min(mask.length, range.end);
    for (let i = from; i < to; i++) mask[i] = 1;
  }
  return mask;
}

/** A block region that reached end of file without its terminator. */
const UNTERMINATED: Readonly<Record<string, { readonly ruleId: string; readonly messageId: MessageId }>> = {
  frontMatter: {
    ruleId: 'DET-02',
    messageId: 'det.frontMatterUnterminated',
  },
  mathBlock: {
    ruleId: 'DET-04',
    messageId: 'det.mathUnterminated',
  },
  fencedCode: {
    ruleId: 'DET-01',
    messageId: 'det.fenceUnterminated',
  },
};

export function detect(
  source: string,
  lines: readonly SourceLine[],
  regions: readonly Region[],
  ignore: readonly CharRange[] = [],
): Detection[] {
  const mask = claimedMask(source, regions, ignore);
  const detections: Detection[] = [];
  for (const region of regions) {
    if (region.closed !== false) continue;
    const rule = UNTERMINATED[region.kind];
    if (rule === undefined) continue;
    detections.push({ ...rule, args: [], line: lineOfOffset(lines, region.start), severity: 'error' });
  }
  detections.push(...unterminatedComments(source, lines, mask));
  detections.push(...unmatchedDelimiters(source, lines, mask));
  detections.push(...unclosedInline(source, lines, mask));
  detections.push(...raggedTables(lines, mask));
  detections.push(...incompleteTables(lines, mask));
  detections.push(...listJumps(lines, mask));
  return detections;
}

/**
 * A comment that is opened and never closed.
 *
 * The scanner's pattern needs its closing marker, so this is the case the pattern
 * cannot see. A comment start inside a protected region is text, not a comment.
 */
function unterminatedComments(
  source: string,
  lines: readonly SourceLine[],
  mask: Uint8Array,
): Detection[] {
  for (let at = source.indexOf('<!--'); at !== -1; at = source.indexOf('<!--', at + 1)) {
    if (mask[at] === 1) continue;
    if (source.indexOf('-->', at + 4) !== -1) continue;
    return [
      {
        ruleId: 'DET-03',
        messageId: 'det.commentUnterminated',
        args: [],
        line: lineOfOffset(lines, at),
        severity: 'error',
      },
    ];
  }
  return [];
}

/**
 * A delimiter with no partner.
 *
 * CommonMark says an unmatched backtick or dollar is literal text, and the
 * scanner agrees - which is exactly why nobody notices: the character is one
 * keystroke away from a span, and the file looks no different either way.
 */
function unmatchedDelimiters(
  source: string,
  lines: readonly SourceLine[],
  mask: Uint8Array,
): Detection[] {
  const backtickLines = new Set<number>();
  const dollarLines = new Set<number>();
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code !== BACKTICK && code !== DOLLAR) continue;
    if (mask[i] === 1 || isEscaped(source, i)) continue;
    const line = lineOfOffset(lines, i);
    if (code === BACKTICK) backtickLines.add(line);
    else dollarLines.add(line);
  }
  const out: Detection[] = [];
  for (const line of [...backtickLines].sort((a, b) => a - b)) {
    out.push({
      ruleId: 'DET-06',
      messageId: 'det.backtickUnmatched',
      args: [],
      line,
      severity: 'warning',
    });
  }
  for (const line of [...dollarLines].sort((a, b) => a - b)) {
    out.push({
      ruleId: 'DET-07',
      messageId: 'det.dollarUnmatched',
      args: [],
      line,
      severity: 'warning',
    });
  }
  return out;
}

/** DET-08 and DET-09: an opener whose closer is not on the same line. */
function unclosedInline(
  source: string,
  lines: readonly SourceLine[],
  mask: Uint8Array,
): Detection[] {
  const out: Detection[] = [];
  const scan = (needle: string, closeMark: string, ruleId: string, messageId: MessageId): void => {
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      if (mask[at] === 1) continue;
      const newline = source.indexOf('\n', at);
      const close = source.indexOf(closeMark, at + needle.length);
      if (close !== -1 && (newline === -1 || close < newline)) continue;
      out.push({ ruleId, messageId, args: [], line: lineOfOffset(lines, at), severity: 'warning' });
    }
  };
  scan('[[', ']]', 'DET-08', 'det.wikilinkUnclosed');
  scan('](', ')', 'DET-09', 'det.linkDestinationUnclosed');
  return out;
}

/**
 * The cells of a table row, or null when the line is not a row at all.
 *
 * Outer pipes are stripped, `\|` is content rather than a separator, and a row
 * without a leading pipe still counts: GFM's pipes are optional on the outside,
 * and a formatter that only sees `| a | b |` cannot report anything about
 * `a | b`. A pipe inside a code span *is* a separator here, which is what GFM does
 * with it.
 */
function tableCells(text: string): string[] | null {
  const body = text.slice(contentStartOf(text));
  if (!body.includes('|')) return null;
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i);
    if (code === BACKSLASH && body.charCodeAt(i + 1) === PIPE) {
      cell += '\\|';
      i++;
      continue;
    }
    if (code === PIPE) {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += body.charAt(i);
  }
  cells.push(cell);
  if ((cells[0] ?? '').trim().length === 0) cells.shift();
  if (cells.length > 0 && (cells[cells.length - 1] ?? '').trim().length === 0) cells.pop();
  return cells;
}

const TABLE_DELIMITER_CELL = /^\s*:?-+:?\s*$/;

function isDelimiterRow(text: string): boolean {
  const cells = tableCells(text);
  return cells !== null && cells.length > 0 && cells.every((cell) => TABLE_DELIMITER_CELL.test(cell));
}

/** DET-10: a row, or the delimiter row, with a different cell count from the header. */
function raggedTables(lines: readonly SourceLine[], mask: Uint8Array): Detection[] {
  const out: Detection[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const header = lines[i];
    if (header === undefined || mask[header.start] === 1) continue;
    const headerCells = tableCells(header.text);
    if (headerCells === null || isDelimiterRow(header.text)) continue;
    if (!isDelimiterRow(lines[i + 1]?.text ?? '')) continue;

    // The delimiter row is the one row that has to agree with the header: the
    // columns it declares are the columns the table has, so a separator with the
    // wrong count is a table nothing can align. Nothing else reports it - the row
    // checks below start after it.
    const declared = tableCells(lines[i + 1]?.text ?? '') ?? [];
    if (declared.length !== headerCells.length) {
      out.push({
        ruleId: 'DET-10',
        messageId: 'det.tableHeaderRagged',
        args: [declared.length, headerCells.length],
        line: i + 1,
        severity: 'warning',
      });
    }

    for (let j = i + 2; j < lines.length; j++) {
      const row = lines[j];
      if (row === undefined) break;
      const cells = tableCells(row.text);
      if (cells === null) break;
      if (cells.length === headerCells.length) continue;
      out.push({
        ruleId: 'DET-10',
        messageId: 'det.tableRowRagged',
        args: [cells.length, headerCells.length],
        line: j,
        severity: 'warning',
      });
    }
    i += 2;
  }
  return out;
}

/**
 * DET-13: a delimiter row that belongs to no table.
 *
 * A table is a header row and a delimiter row in the same container, and
 * `scanTables` is the definition of that - the aligner, segmentation and this
 * rule all read the same one, so they cannot disagree about what a table is.
 * This rule is its complement: a delimiter row the scan did not claim is a table
 * that was never completed. That is what a table straddling two containers looks
 * like from inside either of them - at least one side is missing its half - and
 * it is also what a stray delimiter row is. Nothing can align it and nothing can
 * join it, so the document is refused rather than guessed at.
 */
function incompleteTables(lines: readonly SourceLine[], mask: Uint8Array): Detection[] {
  const texts = lines.map((line) => line.text);
  const isProtected = (index: number): boolean => mask[lines[index]?.start ?? 0] === 1;
  const claimed = new Set<number>();
  for (const table of scanTables(texts, isProtected)) {
    claimed.add(table.header);
    claimed.add(table.delimiter);
    for (const line of table.rows) claimed.add(line);
    for (const line of table.blanks) claimed.add(line);
  }
  const out: Detection[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (claimed.has(i) || isProtected(i)) continue;
    if (!isTableDelimiterRow(texts[i] ?? '')) continue;
    out.push({
      ruleId: 'DET-13',
      messageId: 'det.tableIncomplete',
      args: [],
      line: i,
      severity: 'error',
    });
  }
  return out;
}

/**
 * DET-11: an item indented as if nested, that ended up outside the list.
 *
 * The indentation says one thing and the structure says another. BLK-08 repairs
 * it - dedenting the item to the level it actually occupies - and the repair is
 * invisible in the source, which is why the author is told.
 */
function listJumps(lines: readonly SourceLine[], mask: Uint8Array): Detection[] {
  const items = scanListItems(
    lines.map((line) => line.text),
    (index) => mask[lines[index]?.start ?? 0] === 1,
  );
  const brokeOut: boolean[] = [];
  const parents = assignParents(items, brokeOut);
  const out: Detection[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined || brokeOut[i] !== true || parents[i] !== -1) continue;
    if (mask[lines[item.line]?.start ?? 0] === 1) continue;
    out.push({
      ruleId: 'DET-11',
      messageId: 'det.listItemOrphan',
      args: [],
      line: item.line,
      severity: 'warning',
    });
  }
  return out;
}

