/**
 * TYPO-12: one delimiter per emphasis kind.
 *
 * Markdown spells bold two ways (`**x**`, `__x__`), italics two ways (`*x*`,
 * `_x_`), and strikethrough with one tilde in the dialects that accept it as well
 * as two. The node is the same in each pair; the spelling is a house style, and
 * this rule rewrites the spelling and nothing else.
 *
 * What it will not do is decide a delimiter is emphasis when CommonMark would not.
 * `_` is the character that carries that risk - `snake_case_name` is not emphasis,
 * and neither is `中文_斜体_中文`, because an underscore inside a word cannot open
 * one - so the flanking tests below are CommonMark's own rules for that decision,
 * and a rewrite only ever lands on a pair the parser would pair. The target is
 * tested with the same rules before it is written: turning an intraword `**` into
 * `__` would delete the emphasis the author had.
 *
 * Only one line at a time, and only runs of one or two characters: `***x***` is
 * two nodes sharing one run, and telling those apart is a parser's job rather than
 * a formatter's. A run that is left alone is not a bug; it is the conservative
 * answer to a question this rule cannot answer.
 *
 * Spec references: TYPO-12.
 */

import { isFullPunct } from './chars.ts';
import type { EmphasisOptions } from './options.ts';
import { splitSourceLines } from './scan.ts';

const EMPHASIS_CHARS = new Set(['*', '_', '~']);

/** CommonMark's whitespace for the flanking tests: absent is a boundary too. */
function isSpace(ch: string): boolean {
  return ch === '' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** CommonMark's punctuation, as far as this rule needs to recognise it. */
function isPunct(ch: string): boolean {
  if (ch === '') return false;
  const code = ch.charCodeAt(0);
  const ascii =
    (code >= 33 && code <= 47) ||
    (code >= 58 && code <= 64) ||
    (code >= 91 && code <= 96) ||
    (code >= 123 && code <= 126);
  return ascii || isFullPunct(ch);
}

interface Flanking {
  readonly canOpen: boolean;
  readonly canClose: boolean;
}

/**
 * Whether a delimiter run can open, close, or both.
 *
 * `*` and `~` only have to face the right way. `_` additionally refuses to do its
 * work inside a word, which is the whole difference between `snake_case` and
 * `_emphasis_`.
 */
function flanking(before: string, after: string, char: string): Flanking {
  const left = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
  const right = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
  if (char !== '_') return { canOpen: left, canClose: right };
  return {
    canOpen: left && (!right || isPunct(before)),
    canClose: right && (!left || isPunct(after)),
  };
}

/** A maximal run of one emphasis character. */
interface Run {
  readonly char: string;
  readonly length: number;
  readonly start: number;
}

function scanRuns(line: string): Run[] {
  const runs: Run[] = [];
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    if (!EMPHASIS_CHARS.has(char)) continue;
    let end = i;
    while (end < line.length && line.charAt(end) === char) end++;
    runs.push({ char, length: end - i, start: i });
    i = end - 1;
  }
  return runs;
}

type Kind = 'strong' | 'em' | 'strike';

/** The node a run of this length and character spells, or null if it spells none. */
function kindOf(run: Run): Kind | null {
  if (run.length === 2) return run.char === '~' ? 'strike' : 'strong';
  if (run.length === 1) return run.char === '~' ? 'strike' : 'em';
  return null;
}

/** The delimiter the options ask for, or null when the run is already right. */
function wanted(kind: Kind, options: EmphasisOptions): string | null {
  if (kind === 'strong') {
    if (options.strong === 'preserve') return null;
    return options.strong === 'asterisks' ? '**' : '__';
  }
  if (kind === 'em') {
    if (options.em === 'preserve') return null;
    return options.em === 'asterisk' ? '*' : '_';
  }
  if (options.strikethrough === 'preserve') return null;
  return options.strikethrough === 'double' ? '~~' : '~';
}

/** Whether the target character would still open and close where the run sits. */
function targetFits(line: string, run: Run, target: string): boolean {
  if (target.charAt(0) !== '_') return true;
  const before = run.start > 0 ? line.charAt(run.start - 1) : '';
  const after = run.start + run.length < line.length ? line.charAt(run.start + run.length) : '';
  return flanking(before, after, '_').canOpen;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function rewriteLine(line: string, options: EmphasisOptions, masked: (offset: number) => boolean): string {
  const runs = scanRuns(line);
  const open: Run[] = [];
  const edits: Edit[] = [];

  for (const run of runs) {
    const kind = kindOf(run);
    if (kind === null) continue;
    const before = run.start > 0 ? line.charAt(run.start - 1) : '';
    const after = run.start + run.length < line.length ? line.charAt(run.start + run.length) : '';
    const flank = flanking(before, after, run.char);
    let paired = -1;
    if (flank.canClose) {
      for (let k = open.length - 1; k >= 0; k--) {
        const candidate = open[k];
        if (candidate === undefined) continue;
        if (candidate.char !== run.char || candidate.length !== run.length) continue;
        paired = k;
        break;
      }
    }
    if (paired < 0) {
      if (flank.canOpen) open.push(run);
      continue;
    }
    const opener = open[paired];
    open.splice(paired, 1);
    if (opener === undefined) continue;
    const target = wanted(kind, options);
    if (target === null || target === line.slice(opener.start, opener.start + opener.length)) continue;
    if (masked(opener.start) || masked(run.start)) continue;
    if (!targetFits(line, opener, target)) continue;
    // The closing delimiter faces the other way, so its test is mirrored.
    const closeAfter = run.start + run.length < line.length ? line.charAt(run.start + run.length) : '';
    const closeBefore = run.start > 0 ? line.charAt(run.start - 1) : '';
    if (
      target.charAt(0) === '_' &&
      !flanking(closeBefore, closeAfter, '_').canClose
    ) {
      continue;
    }
    edits.push({ start: opener.start, end: opener.start + opener.length, text: target });
    edits.push({ start: run.start, end: run.start + run.length, text: target });
  }

  if (edits.length === 0) return line;
  let out = line;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

export function normalizeEmphasis(text: string, options: EmphasisOptions, mask: Uint8Array): string {
  if (
    options.strong === 'preserve' &&
    options.em === 'preserve' &&
    options.strikethrough === 'preserve'
  ) {
    return text;
  }
  const lines = splitSourceLines(text);
  let out = '';
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) continue;
    const next = lines[index + 1];
    const newline = text.slice(line.end, next === undefined ? text.length : next.start);
    const masked = (offset: number): boolean => mask[line.start + offset] === 1;
    out += rewriteLine(text.slice(line.start, line.end), options, masked) + newline;
  }
  return out;
}
