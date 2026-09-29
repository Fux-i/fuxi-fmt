/**
 * Ignore directives (CFG-03).
 *
 * A directive is the whole body of an HTML comment on its own line, so a
 * document that merely mentions one - the specification does - is unaffected.
 *
 * An unterminated range runs to the end of the document, because an ignore
 * should fail safe: leaving too much alone is recoverable, formatting what the
 * author asked to be left alone is not.
 */

import type { IgnoreOptions } from './options.ts';
import { splitSourceLines } from './scan.ts';

export interface CharRange {
  readonly start: number;
  readonly end: number;
}

/** The body of an HTML comment occupying a whole line, or null. */
export function commentBody(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 7 || !trimmed.startsWith('<!--') || !trimmed.endsWith('-->')) return null;
  return trimmed.slice(4, trimmed.length - 3).trim();
}

export function hasIgnoreFile(source: string, name: string): boolean {
  for (const line of splitSourceLines(source)) {
    if (commentBody(line.text) === name) return true;
  }
  return false;
}

/** Per-line flags, for the structural pass. */
export function ignoreLines(source: string, options: IgnoreOptions): boolean[] {
  const flags: boolean[] = [];
  let open = false;
  for (const line of splitSourceLines(source)) {
    const body = commentBody(line.text);
    if (body === options.start) open = true;
    flags.push(open);
    if (body === options.end) open = false;
  }
  return flags;
}

/**
 * Character ranges, for the passes that work on text rather than lines.
 *
 * Callers must recompute these from the text they are about to pass, not once
 * from the source: every pass can change a length before the next one runs,
 * while the ignored regions stay verbatim and therefore findable.
 */
export function ignoreRanges(source: string, options: IgnoreOptions): CharRange[] {
  const ranges: CharRange[] = [];
  let start = -1;
  let open = false;
  for (const line of splitSourceLines(source)) {
    const body = commentBody(line.text);
    if (body === options.start && !open) {
      open = true;
      start = line.start;
    }
    if (body === options.end && open) {
      ranges.push({ start, end: line.end });
      open = false;
      start = -1;
    }
  }
  if (open) ranges.push({ start, end: source.length });
  return ranges;
}
