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

import type { CharRange } from './ignores.ts';
import { assignParents, scanListItems } from './list-scan.ts';
import { isDelimiterRow, scanTables, tableCells, tableRow } from './tables.ts';
import type { MessageArgs, MessageId } from './messages.ts';
import type { RuleId } from './rules.ts';
import { isEscaped, lineIndexOf, protectedMask, type Region, type SourceLine } from './scan.ts';

const BACKTICK = 96;
const DOLLAR = 36;

export interface Detection {
  readonly ruleId: RuleId;
  /** The catalogue entry (CFG-08). The English is rendered by the caller. */
  readonly messageId: MessageId;
  readonly args: MessageArgs;
  readonly line: number | undefined;
  /** 'info' reports what the formatter did, not a complaint about the document. */
}

/** A block region that reached end of file without its terminator. */
const UNTERMINATED: Readonly<
  Record<string, { readonly ruleId: RuleId; readonly messageId: MessageId }>
> = {
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
  const mask = protectedMask(source, ignore, regions);
  const detections: Detection[] = tomlFrontMatter(lines);
  const toml = tomlFrontMatter(lines).length > 0;
  for (const region of regions) {
    if (region.closed !== false) continue;
    // DET-02 is a YAML rule: an unclosed YAML block would have been formatted and
    // a misreading would have corrupted it. The TOML block is never formatted, so
    // an unclosed one costs the body its formatting and nothing else - FM-06 says
    // so rather than refusing the document.
    if (toml && region.kind === 'frontMatter') continue;
    const rule = UNTERMINATED[region.kind];
    if (rule === undefined) continue;
    detections.push({ ...rule, args: [], line: lineIndexOf(lines, region.start) });
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
 * FM-06: a TOML front matter block, which is preserved rather than formatted.
 *
 * The scanner has already protected it; this is the formatter saying so, because
 * a block that is silently left alone is indistinguishable from one it forgot.
 * TOML is a different document format with its own comments, strings and escapes,
 * and nothing here reads or rewrites it.
 */
function tomlFrontMatter(lines: readonly SourceLine[]): Detection[] {
  const first = lines[0];
  if (first === undefined || first.text.trimEnd() !== '+++') return [];
  return [{ ruleId: 'FM-06', messageId: 'fm.tomlPreserved', args: [], line: 0 }];
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
        line: lineIndexOf(lines, at),
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
    const line = lineIndexOf(lines, i);
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
    });
  }
  for (const line of [...dollarLines].sort((a, b) => a - b)) {
    out.push({
      ruleId: 'DET-07',
      messageId: 'det.dollarUnmatched',
      args: [],
      line,
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
  const scan = (needle: string, closeMark: string, ruleId: RuleId, messageId: MessageId): void => {
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      if (mask[at] === 1) continue;
      const newline = source.indexOf('\n', at);
      const close = source.indexOf(closeMark, at + needle.length);
      if (close !== -1 && (newline === -1 || close < newline)) continue;
      out.push({ ruleId, messageId, args: [], line: lineIndexOf(lines, at) });
    }
  };
  scan('[[', ']]', 'DET-08', 'det.wikilinkUnclosed');
  scan('](', ')', 'DET-09', 'det.linkDestinationUnclosed');
  return out;
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
      });
    }
    i += 2;
  }
  return out;
}

/** A line the classifier reads as a table row: a leading pipe, then some cells. */
const TABLE_ROW_START = /^[ \t]*\|/;

/**
 * DET-13: a table line that belongs to no table.
 *
 * A table is a header row and a delimiter row in the same container, and
 * `scanTables` is the definition of that - the aligner, segmentation and this
 * rule all read the same one, so they cannot disagree about what a table is.
 * This rule is its complement, and a table can be left half-written in two
 * directions:
 *
 * - a **delimiter row** the scan did not claim: the author declared a table and
 *   wrote no header for it. That is what a table straddling two containers looks
 *   like from inside either of them - at least one side is missing its half.
 * - a **row** the scan did not claim: the line reads as a table row, and no
 *   table holds it - the shape of a table that a blank line cut in two, or of a
 *   header whose delimiter row was never written.
 *
 * Neither can be aligned and neither can be joined, so the document is refused
 * rather than guessed at. A bare pipe has no cells and stays prose.
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
    const text = texts[i] ?? '';
    if (isDelimiterRow(text)) {
      out.push({
        ruleId: 'DET-13',
        messageId: 'det.tableIncomplete',
        args: [],
        line: i,
      });
      continue;
    }
    if (!TABLE_ROW_START.test(text) || tableRow(text) === null) continue;
    out.push({
      ruleId: 'DET-13',
      messageId: 'det.tableRowOrphan',
      args: [],
      line: i,
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
    });
  }
  return out;
}