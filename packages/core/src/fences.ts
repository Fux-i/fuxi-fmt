/**
 * Code fence delimiter normalisation (BLK-10).
 *
 * Only the fence character and its length may change. The delimiter's
 * indentation, the spacing before the info string and the info string itself
 * are handed back byte-for-byte (SAFE-02), and the body is never read except to
 * measure it.
 */

import type { AtomicRange } from './blocks.ts';
import type { CodeBlockOptions } from './options.ts';

const FENCE = /^([ \t]*)([`~]{3,})([\s\S]*)$/;

/** Tab counts as up to four columns, as in CommonMark. */
function indentColumns(text: string): number {
  let column = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 9) column += 4 - (column % 4);
    else if (code === 32) column++;
    else break;
  }
  return column;
}

function longestRun(text: string, char: string): number {
  let longest = 0;
  let streak = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) === char) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
  }
  return longest;
}

export function normalizeFences(
  texts: readonly string[],
  ranges: readonly AtomicRange[],
  options: CodeBlockOptions,
): string[] {
  const out = texts.slice();
  for (const range of ranges) {
    if (range.kind !== 'code') continue;
    const openIndex = range.start;
    const closeIndex = range.end - 1;
    if (closeIndex <= openIndex) continue;

    const open = FENCE.exec(out[openIndex] ?? '');
    if (open === null) continue;
    const indent = open[1] ?? '';
    const run = open[2] ?? '';
    const rest = open[3] ?? '';
    // A fence indented four columns or more is an indented code block.
    if (indentColumns(indent) > 3) continue;
    const char = run.charAt(0);

    const close = FENCE.exec(out[closeIndex] ?? '');
    if (close === null) continue;
    // A closing fence indented more than three columns past the opener is not a
    // closing fence to the scanner, which skips such a line and leaves the region
    // unterminated. Rewriting it anyway changes protected bytes, and the guard
    // answers a SAFE-01 breach by refusing the whole document - so one malformed
    // fence silently stopped every block before it from being formatted. The
    // scanner owns the region boundary; this pass has to stay inside it.
    if ((close[1] ?? '').length > indent.length + 3) continue;
    if ((close[2] ?? '').charAt(0) !== char) continue;
    if ((close[3] ?? '').trim() !== '') continue;

    const target =
      options.fenceChar === 'preserve' ? char : options.fenceChar === 'tildes' ? '~' : '`';
    // A backtick info string cannot live under a backtick fence.
    if (target === '`' && rest.includes('`')) continue;

    let length = run.length;
    if (options.normalizeLength) {
      let longest = 0;
      for (let i = openIndex + 1; i < closeIndex; i++) {
        longest = Math.max(longest, longestRun(out[i] ?? '', target));
      }
      length = Math.max(3, longest + 1);
    }

    out[openIndex] = indent + target.repeat(length) + rest;
    out[closeIndex] = (close[1] ?? '') + target.repeat(length) + (close[3] ?? '');
  }
  return out;
}
