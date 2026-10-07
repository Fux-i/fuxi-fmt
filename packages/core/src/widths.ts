/**
 * Character width normalisation.
 *
 * Spec references: TYPO-05 (punctuation width), TYPO-06 (full-width
 * alphanumerics and the ideographic space), TYPO-08 (parenthesis width).
 *
 * Which marks may change, and what they change to, lives here. Whether a mark is
 * in Chinese context is decided in one place, context.ts, so the rules cannot
 * drift apart again - they already had, and the same sentence got full-width
 * commas and half-width parentheses.
 */

import { isGluedToWord, isLoneDotAfterCjk, parensConvert, punctuationConverts } from './context.ts';
import type { TypographyOptions } from './options.ts';
import { protectedMask } from './scan.ts';

const OPENERS = new Set(['(', '\uff08']);
const CLOSERS = new Set([')', '\uff09']);

const HALF_TO_FULL = new Map<string, string>([
  [',', '\uff0c'],
  ['.', '\u3002'],
  [':', '\uff1a'],
  ['!', '\uff01'],
  ['?', '\uff1f'],
  [';', '\uff1b'],
]);

const IDEOGRAPHIC_SPACE = 0x3000;
const FULLWIDTH_DIGIT_START = 0xff10;
const FULLWIDTH_DIGIT_END = 0xff19;
const FULLWIDTH_UPPER_START = 0xff21;
const FULLWIDTH_UPPER_END = 0xff3a;
const FULLWIDTH_LOWER_START = 0xff41;
const FULLWIDTH_LOWER_END = 0xff5a;
/** '0' minus '０', and the same offset for both letter ranges. */
const FULLWIDTH_OFFSET = 0xfee0;

/** TYPO-06: full-width alphanumerics and the ideographic space become half-width. */
export function normalizeFullwidthAlphanumerics(
  text: string,
  options: TypographyOptions,
  maskIn?: Uint8Array,
): string {
  if (!options.halfwidthAlphanumerics && !options.ideographicSpace) return text;
  const mask = maskIn ?? protectedMask(text);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (mask[i] === 1) {
      out += ch;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code === IDEOGRAPHIC_SPACE) {
      out += options.ideographicSpace ? ' ' : ch;
      continue;
    }
    if (!options.halfwidthAlphanumerics) {
      out += ch;
      continue;
    }
    const isFullwidth =
      (code >= FULLWIDTH_DIGIT_START && code <= FULLWIDTH_DIGIT_END) ||
      (code >= FULLWIDTH_UPPER_START && code <= FULLWIDTH_UPPER_END) ||
      (code >= FULLWIDTH_LOWER_START && code <= FULLWIDTH_LOWER_END);
    out += isFullwidth ? String.fromCharCode(code - FULLWIDTH_OFFSET) : ch;
  }
  return out;
}

/**
 * TYPO-08: the width of a parenthesis pair.
 *
 * Deliberately conservative about the pair itself. A pair that spans a line break,
 * touches a protected region, or contains another opener is left exactly as
 * written rather than guessed at - a wrong parenthesis is worse than a wide one.
 * Both parens take the opening one's decision, so they never come out mismatched.
 */
export function normalizeParens(
  text: string,
  options: TypographyOptions,
  maskIn?: Uint8Array,
): string {
  if (options.parenStyle === 'preserve') return text;
  const mask = maskIn ?? protectedMask(text);
  const chars = text.split('');
  for (let i = 0; i < text.length; i++) {
    if (mask[i] === 1 || !OPENERS.has(text.charAt(i))) continue;
    let j = i + 1;
    let bail = false;
    while (j < text.length) {
      const c = text.charAt(j);
      if (c === '\n' || mask[j] === 1 || OPENERS.has(c)) {
        bail = true;
        break;
      }
      if (CLOSERS.has(c)) break;
      j++;
    }
    if (bail || j >= text.length) continue;
    const full =
      options.parenStyle === 'fullwidth'
        ? true
        : options.parenStyle === 'halfwidth'
          ? false
          : parensConvert(text, i, j, mask, options);
    chars[i] = full ? '\uff08' : '(';
    chars[j] = full ? '\uff09' : ')';
    i = j;
  }
  return chars.join('');
}

/** TYPO-05: half-width punctuation beside Chinese, and the reverse. */
export function normalizePunctuation(
  text: string,
  options: TypographyOptions,
  maskIn?: Uint8Array,
): string {
  if (options.punctuationStyle === 'off') return text;

  const allowed = new Set(options.punctuationChangeList);
  const toFull = new Map<string, string>();
  const toHalf = new Map<string, string>();
  for (const [half, full] of HALF_TO_FULL) {
    if (!allowed.has(half)) continue;
    toFull.set(half, full);
    toHalf.set(full, half);
  }

  const style = options.punctuationStyle;
  const doFull = style === 'fullwidth' || style === 'mixed';
  const doHalf = style === 'halfwidth' || style === 'mixed';
  const mask = maskIn ?? protectedMask(text);

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (mask[i] === 1) {
      out += ch;
      continue;
    }

    const full = toFull.get(ch);
    if (full !== undefined && doFull) {
      // The dot is asked a question none of the other marks are: a decimal point
      // and an ellipsis are both dots, and only a lone one after CJK ends a
      // sentence.
      const convert =
        ch === '.' ? isLoneDotAfterCjk(text, i, mask, options) : punctuationConverts(text, i, mask, options);
      if (convert) {
        out += full;
        continue;
      }
    }

    const half = toHalf.get(ch);
    if (
      half !== undefined &&
      doHalf &&
      isGluedToWord(text, i) &&
      !punctuationConverts(text, i, mask, options)
    ) {
      out += half;
      continue;
    }
    out += ch;
  }
  return out;
}
