/**
 * Adapter level edit computation (GRT-06).
 *
 * The core returns a whole document, but handing the editor a single
 * whole-document replacement is what makes format-on-save feel slow: the editor
 * re-diffs, re-tokenises, recomputes folding and outline, and every other
 * provider re-analyses the file. So the adapter works out the smallest
 * character range that actually differs.
 *
 * The reducer is a common prefix plus a common suffix. That is exact and
 * produces one edit for any localised change, which is the overwhelmingly
 * common case. A document edited at both ends collapses into one wide edit;
 * that is a strictly better worst case than replacing everything, and it is
 * recorded here rather than left implicit.
 *
 * Nothing in this module imports 'vscode', so it is testable in plain Node.
 */

import { format, splitSourceLines } from '../../core/src/index.ts';
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

  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before.charAt(prefix) === after.charAt(prefix)
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before.charAt(before.length - 1 - suffix) === after.charAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }

  const start = prefix;
  const end = before.length - suffix;
  const lines = splitSourceLines(before);
  const startLine = lineOf(lines, start);
  const endLine = end <= start ? startLine : lineOf(lines, Math.max(start, end - 1));

  return [{ start, end, newText: after.slice(prefix, after.length - suffix), startLine, endLine }];
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
