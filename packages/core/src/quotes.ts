/**
 * TYPO-11: straight double quotes become paired Chinese quotation marks.
 *
 * Only the double quote is converted. The apostrophe is left alone entirely:
 * ' and the single quotation mark share a codepoint family, "don't" is
 * indistinguishable from an opening quote without guessing, and a rule that
 * guesses will one day eat a contraction.
 *
 * Pairing is per line and all-or-nothing. A line with an odd number of straight
 * quotes has one whose partner is somewhere else, so the line is left exactly as
 * written and the caller reports it - converting the ones that happen to pair
 * would leave the author with a document that is neither what they wrote nor what
 * they meant.
 *
 * Spec references: TYPO-11.
 */

import { isAlphanumeric } from './chars.ts';
import { inChineseContext } from './context.ts';
import type { TypographyOptions } from './options.ts';

const OPEN = '\u201c';
const CLOSE = '\u201d';
const STRAIGHT = '"';

export interface QuoteResult {
  readonly text: string;
  /** Offsets of straight quotes that had no partner on their line. */
  readonly unpaired: readonly number[];
}

export function normalizeQuotes(
  text: string,
  options: TypographyOptions,
  mask: Uint8Array,
): QuoteResult {
  if (options.quotes === 'preserve') return { text, unpaired: [] };

  const chars = text.split('');
  const unpaired: number[] = [];

  let from = 0;
  while (from < text.length) {
    let to = text.indexOf('\n', from);
    if (to === -1) to = text.length;

    const marks: number[] = [];
    for (let i = from; i < to; i++) {
      if (mask[i] !== 1 && text.charAt(i) === STRAIGHT) marks.push(i);
    }

    if (marks.length % 2 !== 0) {
      for (const mark of marks) unpaired.push(mark);
    } else {
      for (let k = 0; k + 1 < marks.length; k += 2) {
        const open = marks[k] ?? 0;
        const close = marks[k + 1] ?? 0;
        // A quote tight against a word is an inch mark or a stray, not the start
        // of a quotation: 12" x 8".
        if (isAlphanumeric(text.charAt(open - 1))) continue;
        if (!inChineseContext(text, open, mask, options)) continue;
        chars[open] = OPEN;
        chars[close] = CLOSE;
      }
    }

    from = to + 1;
  }

  return { text: chars.join(''), unpaired };
}
