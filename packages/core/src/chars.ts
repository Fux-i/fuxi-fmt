/** Shared character classification for the typography rules. */

/** Han, including extension A and the compatibility block. */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const ALPHANUMERIC = /[A-Za-z0-9]/;

/** Symbols that attach to an adjacent run (TYPO-04, TYPO-10). */
const SPACING_SYMBOLS = new Set(['+', '-', '=', '<', '>', '%', '\u00b0', '\u2103', '\u2109']);

/** Full-width punctuation is a boundary, never a spacing target (TYPO-07). */
const FULL_PUNCT = new Set([
  '\uff0c', '\u3002', '\uff01', '\uff1f', '\uff1b', '\uff1a', '\u3001',
  '\uff08', '\uff09', '\u3010', '\u3011', '\u300c', '\u300d', '\u300a', '\u300b',
  '\u201c', '\u201d', '\u2018', '\u2019',
]);

export function isCjk(ch: string): boolean {
  return ch.length > 0 && CJK.test(ch);
}

export function isAlphanumeric(ch: string): boolean {
  return ch.length > 0 && ALPHANUMERIC.test(ch);
}

/** A character that takes a space at a CJK boundary. */
export function isSpacingChar(ch: string): boolean {
  return isAlphanumeric(ch) || SPACING_SYMBOLS.has(ch);
}

export function isFullPunct(ch: string): boolean {
  return FULL_PUNCT.has(ch);
}
