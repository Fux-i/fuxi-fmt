/**
 * TYPO-11: straight double quotes become paired Chinese quotation marks.
 *
 * Only the double quote is converted. The apostrophe is left alone entirely:
 * ' and the single quotation mark share a codepoint family, "don't" is
 * indistinguishable from an opening quote without guessing, and a rule that
 * guesses will one day eat a contraction.
 *
 * Pairing is per paragraph and all-or-nothing. A paragraph with an odd number of
 * straight quotes has one whose partner is somewhere else, so it is left exactly
 * as written and the caller reports it once - converting the ones that happen to
 * pair would leave the author with a document that is neither what they wrote nor
 * what they meant. The paragraph rather than the line, because a quotation may
 * wrap and a hard-wrapped document would otherwise warn on every wrapped quote.
 *
 * Spec references: TYPO-11.
 */

import { isAlphanumeric } from './chars.ts';
import { inChineseContext, paragraphAround } from './context.ts';
import type { TypographyOptions } from './options.ts';

const OPEN = '\u201c';
const CLOSE = '\u201d';
const STRAIGHT = '"';

export interface QuoteResult {
  readonly text: string;
  /** Offset of the first straight quote in each paragraph that could not pair. */
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

  let at = 0;
  while (at < text.length) {
    const paragraph = paragraphAround(text, at);

    const marks: number[] = [];
    for (let i = paragraph.start; i < paragraph.end; i++) {
      if (mask[i] !== 1 && text.charAt(i) === STRAIGHT) marks.push(i);
    }

    if (marks.length % 2 !== 0) {
      // One report per paragraph, at its first straight quote: a wrapped paragraph
      // with three marks is one problem, not three.
      const first = marks[0];
      if (first !== undefined) unpaired.push(first);
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

    if (paragraph.end >= text.length) break;
    at = paragraph.end + 1;
  }

  return { text: chars.join(''), unpaired };
}
