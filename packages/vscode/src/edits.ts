/**
 * Adapter level edit computation (GRT-06).
 *
 * The core returns a whole document, but handing the editor a single
 * whole-document replacement is what makes format-on-save feel slow: the editor
 * re-diffs, re-tokenises, recomputes folding and outline, and every other
 * provider re-analyses the file. So the adapter works out the smallest
 * character range that actually differs.
 *
 * The reducer is the core's line-aligned diff (core/diff.ts), tightened within
 * each region. The line diff decides *where* the changed regions are, so a
 * document edited in several places yields several small edits rather than one
 * wide one - which matters for range formatting, where a single document-wide
 * edit lies outside any selection and editsInRange would discard it, leaving
 * "format selection" silently doing nothing.
 *
 * The tightening decides *how much* of each region to replace: without it,
 * inserting one space would replace the whole line.
 *
 * Nothing in this module imports 'vscode', so it is testable in plain Node.
 */

import { diffEdits, format, splitSourceLines } from '../../core/src/index.ts';
import type { FormatOptionsInput, SourceLine } from '../../core/src/index.ts';

export interface Edit {
  /** Inclusive character offset in the original document. */
  readonly start: number;
  /** Exclusive character offset in the original document. */
  readonly end: number;
  readonly newText: string;
  /** Inclusive line index, for range formatting. */
  readonly startLine: number;
  /** Inclusive line index, for range formatting. */
  readonly endLine: number;
}

function lineOf(lines: readonly SourceLine[], offset: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];
    if (line === undefined) break;
    if (line.start <= offset) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export function computeEdits(before: string, after: string): Edit[] {
  if (before === after) return [];

  const lines = splitSourceLines(before);
  return diffEdits(before, after).map((region) => {
    let start = region.start;
    let end = region.end;
    let text = region.text;

    let head = 0;
    while (head < end - start && head < text.length && before.charAt(start + head) === text.charAt(head)) {
      head++;
    }
    start += head;
    text = text.slice(head);

    let tail = 0;
    while (
      tail < end - start &&
      tail < text.length &&
      before.charAt(end - 1 - tail) === text.charAt(text.length - 1 - tail)
    ) {
      tail++;
    }
    end -= tail;
    text = text.slice(0, text.length - tail);

    const startLine = lineOf(lines, start);
    const endLine = end <= start ? startLine : lineOf(lines, Math.max(start, end - 1));
    return { start, end, newText: text, startLine, endLine };
  });
}

export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = '';
  let cursor = 0;
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    out += text.slice(cursor, edit.start) + edit.newText;
    cursor = edit.end;
  }
  return out + text.slice(cursor);
}

/** The edits to apply for a whole document, or none if the guard withheld one. */
export function documentEdits(text: string, options: FormatOptionsInput): Edit[] {
  const result = format(text, options);
  if (result.diagnostics.length > 0) return [];
  return computeEdits(text, result.output);
}

/** Keep only the edits that fall inside a selection, by line. */
export function editsInRange(
  edits: readonly Edit[],
  startLine: number,
  endLine: number,
): Edit[] {
  return edits.filter((edit) => edit.startLine <= endLine && edit.endLine >= startLine);
}
