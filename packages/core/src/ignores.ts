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

/**
 * Per-line flags, for the structural pass.
 *
 * Three directives, one pass: a range opened by start and closed by end, and a
 * one-off directive that covers the next block - the following non-blank lines,
 * ending at the first blank one. The one-off exists because a false positive is
 * usually one paragraph, not one file.
 */
export function ignoreLines(source: string, options: IgnoreOptions): boolean[] {
  // A directive is an HTML comment, so a document containing none has none. This
  // guard is worth its four lines: ignoreRanges runs before every pass in the
  // pipeline, and on a 10k-line document the scans it skips measure 18.6 ms of
  // 266.8 ms format time - 7%. At 238 lines the same guard saves about 1%, which
  // is why it was measured at the size the specification's benchmark quotes.
  if (!source.includes('<!--')) return [];

  const flags: boolean[] = [];
  let open = false;
  let pending = false;
  let inBlock = false;

  for (const line of splitSourceLines(source)) {
    const body = commentBody(line.text);
    const blank = line.text.trim().length === 0;
    let flag = open;

    if (body === options.start) {
      open = true;
      flag = true;
    } else if (body === options.end) {
      flag = true;
      open = false;
    } else if (body === options.line) {
      pending = true;
      inBlock = false;
      flag = true;
    } else if (pending) {
      if (!blank) {
        pending = false;
        inBlock = true;
        flag = true;
      }
    } else if (inBlock) {
      if (blank) {
        inBlock = false;
      } else {
        flag = true;
      }
    }

    flags.push(flag);
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
  if (!source.includes('<!--')) return [];

  const lines = splitSourceLines(source);
  const flags = ignoreLines(source, options);
  const ranges: CharRange[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const on = flags[i] === true;
    if (on && start === -1) start = lines[i]?.start ?? 0;
    if (!on && start !== -1) {
      ranges.push({ start, end: lines[i - 1]?.end ?? start });
      start = -1;
    }
  }
  if (start !== -1) ranges.push({ start, end: source.length });
  return ranges;
}
