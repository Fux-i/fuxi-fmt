/**
 * Character width normalisation.
 *
 * Spec references: TYPO-05 (punctuation width), TYPO-06 (full-width
 * alphanumerics and the ideographic space).
 *
 * Punctuation width is decided by adjacency, never by a global search and
 * replace. A mark is only converted when the character immediately beside it
 * is on the other side of the boundary, which is what keeps '1,000', '2.5'
 * and 'e.g.' intact without any exclusion list.
 */

import { isAlphanumeric, isCjk } from './chars.ts';

const OPENERS = new Set(['(', '\uff08']);
const CLOSERS = new Set([')', '\uff09']);

function containsCjk(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (isCjk(text.charAt(i))) return true;
  }
  return false;
}
import type { TypographyOptions } from './options.ts';
import { protectedMask } from './scan.ts';

const HALF_TO_FULL = new Map<string, string>([
  [',', '\uff0c'],
  ['.', '\u3002'],
  [':', '\uff1a'],
  ['!', '\uff01'],
  ['?', '\uff1f'],
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
export function normalizeFullwidthAlphanumerics(text: string, options: TypographyOptions): string {
  if (!options.halfwidthAlphanumerics && !options.ideographicSpace) return text;
  const mask = protectedMask(text);
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
 * TYPO-08: the width of a parenthesis pair follows the script of its contents.
 *
 * Deliberately conservative. A pair that spans a line break, touches a
 * protected region, or contains another opener is left exactly as written
 * rather than guessed at - a wrong parenthesis is worse than a wide one.
 */
export function normalizeParens(text: string, options: TypographyOptions): string {
  if (options.parenStyle === 'preserve') return text;
  const mask = protectedMask(text);
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
          : containsCjk(text.slice(i + 1, j));
    chars[i] = full ? '\uff08' : '(';
    chars[j] = full ? '\uff09' : ')';
    i = j;
  }
  return chars.join('');
}

/** TYPO-05: half-width punctuation becomes full-width beside CJK, and vice versa. */
export function normalizePunctuation(text: string, options: TypographyOptions): string {
  if (options.punctuationStyle === 'off') return text;

  const allowed = new Set(options.punctuationAllowlist);
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
  const mask = protectedMask(text);

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (mask[i] === 1) {
      out += ch;
      continue;
    }
    const left = i > 0 ? text.charAt(i - 1) : '';
    const right = i + 1 < text.length ? text.charAt(i + 1) : '';

    const full = toFull.get(ch);
    if (doFull && full !== undefined && (isCjk(left) || isCjk(right))) {
      out += full;
      continue;
    }
    const half = toHalf.get(ch);
    if (
      doHalf &&
      half !== undefined &&
      !isCjk(left) &&
      !isCjk(right) &&
      (isAlphanumeric(left) || isAlphanumeric(right))
    ) {
      out += half;
      continue;
    }
    out += ch;
  }
  return out;
}
