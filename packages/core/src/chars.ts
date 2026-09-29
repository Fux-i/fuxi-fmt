/** Shared character classification for the typography rules. */

export type CjkClass = 'han' | 'kana' | 'hangul' | 'bopomofo' | 'enclosed';

/**
 * Which scripts count as CJK for spacing and punctuation decisions.
 *
 * Han is the default because the target is Chinese technical writing. The
 * others are opt-in rather than guessed at: enabling kana changes 'テレビabc'
 * from untouched to 'テレビ abc', which is right for Japanese and wrong for a
 * Chinese article that happens to quote a Japanese product name.
 */
const CJK_PATTERNS: Readonly<Record<CjkClass, RegExp>> = {
  han: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/,
  kana: /[\u3040-\u309f\u30a0-\u30ff]/,
  hangul: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/,
  bopomofo: /[\u3100-\u312f\u31a0-\u31bf]/,
  enclosed: /[\u3200-\u32ff\u3300-\u33ff]/,
};

export const DEFAULT_CJK_CLASSES: readonly CjkClass[] = ['han'];
const ALPHANUMERIC = /[A-Za-z0-9]/;

/** Symbols that attach to an adjacent run (TYPO-04, TYPO-10). */
export const DEFAULT_SPACING_SYMBOLS: readonly string[] = ['+', '-', '=', '<', '>', '%', '\u00b0', '\u2103', '\u2109'];
const SPACING_SYMBOLS = new Set(DEFAULT_SPACING_SYMBOLS);

/** Full-width punctuation is a boundary, never a spacing target (TYPO-07). */
const FULL_PUNCT = new Set([
  '\uff0c', '\u3002', '\uff01', '\uff1f', '\uff1b', '\uff1a', '\u3001',
  '\uff08', '\uff09', '\u3010', '\u3011', '\u300c', '\u300d', '\u300a', '\u300b',
  '\u201c', '\u201d', '\u2018', '\u2019',
]);

export function isCjk(ch: string, classes: readonly CjkClass[] = DEFAULT_CJK_CLASSES): boolean {
  if (ch.length === 0) return false;
  for (const name of classes) {
    const pattern = CJK_PATTERNS[name];
    if (pattern !== undefined && pattern.test(ch)) return true;
  }
  return false;
}

export function isAlphanumeric(ch: string): boolean {
  return ch.length > 0 && ALPHANUMERIC.test(ch);
}

/** A character that takes a space at a CJK boundary. */
export function isSpacingChar(
  ch: string,
  symbols: ReadonlySet<string> = SPACING_SYMBOLS,
): boolean {
  return isAlphanumeric(ch) || symbols.has(ch);
}

export function isFullPunct(ch: string): boolean {
  return FULL_PUNCT.has(ch);
}
