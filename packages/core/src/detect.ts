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
import type { Region, SourceLine } from './scan.ts';

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
  const detections: Detection[] = [];
  for (const region of regions) {
    if (region.closed !== false) continue;
    const rule = UNTERMINATED[region.kind];
    if (rule === undefined) continue;
    detections.push({ ...rule, line: lineOfOffset(lines, region.start), severity: 'error' });
  }
  detections.push(...unterminatedComments(source, lines, regions, ignore));
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
  regions: readonly Region[],
  ignore: readonly CharRange[],
): Detection[] {
  const mask = claimedMask(source, regions, ignore);
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
