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
import { isEscaped, type Region, type SourceLine } from './scan.ts';

const BACKTICK = 96;
const DOLLAR = 36;
const PIPE = 124;

export interface Detection {
  readonly ruleId: string;
  readonly message: string;
  readonly line: number | undefined;
  readonly severity: 'error' | 'warning';
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
const UNTERMINATED: Readonly<Record<string, { readonly ruleId: string; readonly message: string }>> = {
  frontMatter: {
    ruleId: 'DET-02',
    message:
      'unterminated front matter: the opening line is never closed, so the whole document was read as YAML and none of it was formatted',
  },
  mathBlock: {
    ruleId: 'DET-04',
    message:
      'unterminated math block: no closing line of dollar signs was found, so everything after it is display math and none of it was formatted',
  },
  fencedCode: {
    ruleId: 'DET-01',
    message:
      'unterminated code fence: no closing fence was found, so everything after it is code and none of it was formatted',
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
    detections.push({ ...rule, line: lineOfOffset(lines, region.start), severity: 'error' });
  }
  detections.push(...unterminatedComments(source, lines, mask));
  detections.push(...unmatchedDelimiters(source, lines, mask));
  detections.push(...unclosedInline(source, lines, mask));
  detections.push(...raggedTables(lines, mask));
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
        message:
          'unterminated HTML comment: nothing closes it, so everything after it is a comment and none of it was formatted',
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
      message:
        'unmatched backtick: nothing closes it, so it stays literal text - if a code span was meant, a backtick is missing',
      line,
      severity: 'warning',
    });
  }
  for (const line of [...dollarLines].sort((a, b) => a - b)) {
    out.push({
      ruleId: 'DET-07',
      message:
        'unmatched dollar sign: nothing closes it, so it stays literal text - a price and an unclosed formula look the same here',
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
  const scan = (needle: string, closeMark: string, ruleId: string, message: string): void => {
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      if (mask[at] === 1) continue;
      const newline = source.indexOf('\n', at);
      const close = source.indexOf(closeMark, at + needle.length);
      if (close !== -1 && (newline === -1 || close < newline)) continue;
      out.push({ ruleId, message, line: lineOfOffset(lines, at), severity: 'warning' });
    }
  };
  scan('[[', ']]', 'DET-08', 'unclosed wikilink: nothing closes it on the line, so it stays literal text');
  scan('](', ')', 'DET-09', 'unclosed link destination: the opening parenthesis is never closed, so this is not a link');
  return out;
}

/** Cells in a table row: outer pipes stripped, escaped pipes not separators. */
function cellCount(row: string): number {
  const body = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  let cells = 1;
  for (let i = 0; i < body.length; i++) {
    if (body.charCodeAt(i) === PIPE && !isEscaped(body, i)) cells++;
  }
  return cells;
}

const TABLE_ROW = /^\s{0,3}\|/;
const TABLE_DELIMITER = /^\s{0,3}\|[-\s:|]+\|\s*$/;

/** DET-10: a row with a different number of cells from the header. */
function raggedTables(lines: readonly SourceLine[], mask: Uint8Array): Detection[] {
  const out: Detection[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const header = lines[i];
    if (header === undefined || !TABLE_ROW.test(header.text)) continue;
    if (!TABLE_DELIMITER.test(lines[i + 1]?.text ?? '')) continue;
    if (mask[header.start] === 1) continue;
    const cells = cellCount(header.text);
    for (let j = i + 2; j < lines.length; j++) {
      const row = lines[j];
      if (row === undefined || !TABLE_ROW.test(row.text)) break;
      const count = cellCount(row.text);
      if (count === cells) continue;
      out.push({
        ruleId: 'DET-10',
        message:
          'table row has ' + String(count) + ' cells where the header has ' + String(cells) +
          ': the row does not render in the columns above it',
        line: j,
        severity: 'warning',
      });
    }
    i += 2;
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
  const items = scanListItems(lines.map((line) => line.text));
  const brokeOut: boolean[] = [];
  const parents = assignParents(items, brokeOut);
  const out: Detection[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined || brokeOut[i] !== true || parents[i] !== -1) continue;
    if (mask[lines[item.line]?.start ?? 0] === 1) continue;
    out.push({
      ruleId: 'DET-11',
      message:
        'list item is indented as if nested but belongs to no parent: the indentation reads as a nested list that never becomes one',
      line: item.line,
      severity: 'warning',
    });
  }
  return out;
}

