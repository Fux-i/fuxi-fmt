/**
 * Minimal edits between two documents, aligned line by line.
 *
 * Both the CLI's textual diff and the adapter's editor edits need to answer
 * "what changed", and answering it twice is how two answers drift apart. This
 * is the single implementation.
 *
 * The alignment is greedy rather than LCS or Myers: after trimming the common
 * prefix and suffix, the middle is walked with a one-line resync. That is exact
 * for the insertions, deletions and one-for-one replacements this formatter
 * produces, and it can mis-align a document full of repeated lines, which is
 * the trade this makes deliberately.
 *
 * Edits are returned in ascending order and do not overlap. Applying them -
 * copying the gaps and the replacements in turn - reproduces the target.
 */

import { splitSourceLines, type SourceLine } from './scan.ts';

export interface TextEdit {
  /** Offset in the original text where the replaced region begins. */
  readonly start: number;
  /** Offset in the original text where it ends. Equal to start for an insertion. */
  readonly end: number;
  /** What replaces that region. Empty for a deletion. */
  readonly text: string;
}

function offsetOf(lines: readonly SourceLine[], index: number, source: string): number {
  if (index >= lines.length) return source.length;
  return lines[index]?.start ?? source.length;
}

/**
 * The text of lines [from, to). The end is the next line's start, not the last
 * line's end: SourceLine.end stops at the line ending, and a replacement run has
 * to carry its own newline or the result loses a line break.
 */
function runText(lines: readonly SourceLine[], from: number, to: number, source: string): string {
  if (to <= from) return '';
  return source.slice(offsetOf(lines, from, source), offsetOf(lines, to, source));
}

export function diffEdits(before: string, after: string): TextEdit[] {
  const left = splitSourceLines(before);
  const right = splitSourceLines(after);
  const lt = left.map((line) => line.text);
  const rt = right.map((line) => line.text);

  let head = 0;
  while (head < lt.length && head < rt.length && lt[head] === rt[head]) head++;

  let tail = 0;
  while (
    tail < lt.length - head &&
    tail < rt.length - head &&
    lt[lt.length - 1 - tail] === rt[rt.length - 1 - tail]
  ) {
    tail++;
  }

  const endL = lt.length - tail;
  const endR = rt.length - tail;
  const edits: TextEdit[] = [];
  let i = head;
  let j = head;

  const flush = (remove: number, add: number): void => {
    const start = offsetOf(left, i, before);
    const end = offsetOf(left, i + remove, before);
    edits.push({ start, end, text: runText(right, j, j + add, after) });
    i += remove;
    j += add;
  };

  while (i < endL || j < endR) {
    if (i < endL && j < endR && lt[i] === rt[j]) {
      i++;
      j++;
      continue;
    }
    if (i < endL && j < endR && lt[i] === rt[j + 1]) {
      flush(1, 0);
      continue;
    }
    if (i < endL && j < endR && lt[i + 1] === rt[j]) {
      flush(0, 1);
      continue;
    }
    if (i < endL && j < endR) {
      flush(1, 1);
      continue;
    }
    if (i < endL) {
      flush(1, 0);
      continue;
    }
    flush(0, 1);
  }

  return edits;
}

/** Apply edits to the original text. Exists so tests can assert the round trip. */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  let out = '';
  let cursor = 0;
  for (const edit of edits) {
    out += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return out + source.slice(cursor);
}
