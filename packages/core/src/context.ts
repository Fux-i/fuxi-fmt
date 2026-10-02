/**
 * One definition of "Chinese context", shared by every width rule.
 *
 * Each rule used to answer this question its own way, and each got a different
 * case wrong. Punctuation asked whether the character immediately beside the mark
 * was CJK; parentheses asked for the nearest non-blank character before the
 * opener. So a Chinese sentence quoting an English term got full-width commas and
 * half-width parentheses - and an emphasis marker between the CJK and the mark
 * hid the CJK from both: `这就是**自信**(confidence)的体现` kept half-width
 * parentheses while the same sentence without the asterisks did not.
 *
 * The default is now the line, bounded three ways. A quoted span is its own
 * scope, so an English sentence inside Chinese quotation marks is English and
 * keeps its own punctuation. A mark written tight against a Latin word is that
 * word's punctuation, which is what keeps `1,000`, `10:30`, `e.g.` and
 * `foo(bar)` intact without an exception list for any of them. And CJK directly
 * beside the mark always wins, so `abc,中文` converts: the comma is Chinese even
 * though a Latin word is on its left.
 *
 * Spec references: TYPO-05, TYPO-08.
 */

import { isAlphanumeric, isCjk, type CjkClass } from './chars.ts';
import type { TypographyOptions } from './options.ts';

const OPEN_QUOTE = '\u201c';
const CLOSE_QUOTE = '\u201d';
const STRAIGHT_QUOTE = '"';

/**
 * Inline delimiters that are markup rather than text. They are skipped when
 * looking for the character that decides a mark's context, because the author
 * wrote `*自信*` and meant the word, not the asterisk.
 */
const MARKUP = new Set(['*', '_', '~']);

export interface Span {
  readonly start: number;
  readonly end: number;
}

function lineStart(text: string, index: number): number {
  const at = text.lastIndexOf('\n', index - 1);
  return at === -1 ? 0 : at + 1;
}

function lineEnd(text: string, index: number): number {
  const at = text.indexOf('\n', index);
  return at === -1 ? text.length : at;
}

/**
 * Quoted spans on the line.
 *
 * Curly quotes pair by their own codepoints, with a stack, so nesting works.
 * Straight quotes pair by alternation and only when the line holds an even number
 * of them: an odd count means one quote's partner is on another line, and
 * guessing which is worse than declining to pair.
 *
 * Curly spans matter as much as straight ones. After a first pass the quotes are
 * curly, and a rule that did not treat those as scopes would convert the
 * punctuation inside them on the second run - which is the difference between a
 * formatter and a shuffler.
 */
export function quoteSpans(text: string, mask: Uint8Array, from: number, to: number): Span[] {
  const spans: Span[] = [];
  const openCurly: number[] = [];
  const straight: number[] = [];
  for (let i = from; i < to; i++) {
    if (mask[i] === 1) continue;
    const ch = text.charAt(i);
    if (ch === OPEN_QUOTE) openCurly.push(i);
    else if (ch === CLOSE_QUOTE) {
      const start = openCurly.pop();
      if (start !== undefined) spans.push({ start, end: i });
    } else if (ch === STRAIGHT_QUOTE) straight.push(i);
  }
  if (straight.length % 2 === 0) {
    for (let k = 0; k + 1 < straight.length; k += 2) {
      spans.push({ start: straight[k] ?? 0, end: straight[k + 1] ?? 0 });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function isBlank(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const ch = text.charAt(i);
    if (ch !== ' ' && ch !== '\t' && ch !== '\r') return false;
  }
  return true;
}

/**
 * The run of non-blank lines containing `index` - one paragraph.
 *
 * A quotation may wrap across a line break, so it is not bounded by the line it
 * opens on, and an author who hard-wraps prose has not written two unbalanced
 * quotes. Pairing per line warns about every wrapped quotation in a document,
 * which is a warning nobody reads twice.
 */
export function paragraphAround(text: string, index: number): Span {
  let start = lineStart(text, index);
  let end = lineEnd(text, index);
  while (start > 0) {
    const prevEnd = start - 1;
    const prevStart = lineStart(text, prevEnd);
    if (isBlank(text, prevStart, prevEnd)) break;
    start = prevStart;
  }
  while (end < text.length) {
    const nextStart = end + 1;
    const nextEnd = lineEnd(text, nextStart);
    if (isBlank(text, nextStart, nextEnd)) break;
    end = nextEnd;
  }
  return { start, end };
}

/**
 * The innermost quoted span containing `index`, or else the line.
 *
 * Quotations are found per paragraph, so a wrapped quotation is one scope for
 * every mark inside it. The fallback stays the line rather than the paragraph: a
 * mark with no quotation around it is judged by the line it is on, which is the
 * rule TYPO-05 states.
 */
export function scopeOf(text: string, index: number, mask: Uint8Array): Span {
  const paragraph = paragraphAround(text, index);
  let best: Span | undefined;
  for (const span of quoteSpans(text, mask, paragraph.start, paragraph.end)) {
    if (index > span.start && index < span.end) {
      if (best === undefined || span.end - span.start < best.end - best.start) best = span;
    }
  }
  return best ?? { start: lineStart(text, index), end: lineEnd(text, index) };
}

/** Does this span contain CJK? Protected characters never count. */
export function spanHasCjk(
  text: string,
  span: Span,
  mask: Uint8Array,
  classes: readonly CjkClass[],
): boolean {
  for (let i = span.start; i < span.end; i++) {
    if (mask[i] === 1) continue;
    if (isCjk(text.charAt(i), classes)) return true;
  }
  return false;
}

function skippable(ch: string, index: number, mask: Uint8Array): boolean {
  return mask[index] === 1 || ch === ' ' || ch === '\t' || ch === '\r' || MARKUP.has(ch);
}

/**
 * The nearest character before `index` that can decide context, or '' at the
 * start of the line. Protected regions are looked through rather than stopped at:
 * what precedes ``code`(x)` is the character before the span, because that is
 * the text the reader sees.
 */
export function significantBefore(text: string, index: number, mask: Uint8Array): string {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text.charAt(i);
    if (ch === '\n') return '';
    if (skippable(ch, i, mask)) continue;
    return ch;
  }
  return '';
}

export function significantAfter(text: string, index: number, mask: Uint8Array): string {
  for (let i = index + 1; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '\n') return '';
    if (skippable(ch, i, mask)) continue;
    return ch;
  }
  return '';
}

/**
 * Is the mark written tight against a Latin letter or digit?
 *
 * This is the whole of the number guard: `1,000`, `3.14`, `10:30` and `3:1`
 * are protected because their marks touch a word character, not because a rule
 * knows what a number is.
 */
export function isGluedToWord(text: string, index: number): boolean {
  return isAlphanumeric(text.charAt(index - 1)) || isAlphanumeric(text.charAt(index + 1));
}

/** Is the mark at `index` in Chinese context, by the configured strategy? */
export function inChineseContext(
  text: string,
  index: number,
  mask: Uint8Array,
  options: TypographyOptions,
): boolean {
  if (options.context === 'adjacent') {
    return (
      isCjk(significantBefore(text, index, mask), options.cjkClasses) ||
      isCjk(significantAfter(text, index, mask), options.cjkClasses)
    );
  }
  return spanHasCjk(text, scopeOf(text, index, mask), mask, options.cjkClasses);
}

/**
 * The decision every width rule shares, once its own question is answered.
 *
 * `besideCjk` says whether a CJK character is directly on the side this rule
 * reads, and `outsideIsWord` whether that side is a Latin word the mark belongs
 * to. A rule supplies those two facts and gets the same answer every other rule
 * gets for the same facts.
 */
function decides(
  besideCjk: boolean,
  outsideIsWord: boolean,
  text: string,
  index: number,
  mask: Uint8Array,
  options: TypographyOptions,
): boolean {
  // CJK right beside the mark decides on its own: 'abc,中文' is Chinese text with
  // a Latin word in it, and the comma belongs to the Chinese.
  if (besideCjk) return true;
  // Otherwise a mark written tight against a Latin word is that word's own
  // punctuation, and the line it sits on does not get a vote.
  if (outsideIsWord) return false;
  return inChineseContext(text, index, mask, options);
}

/** TYPO-05: does this punctuation mark take the full-width form? */
export function punctuationConverts(
  text: string,
  index: number,
  mask: Uint8Array,
  options: TypographyOptions,
): boolean {
  const classes = options.cjkClasses;
  const besideCjk =
    isCjk(text.charAt(index - 1), classes) || isCjk(text.charAt(index + 1), classes);
  return decides(besideCjk, isGluedToWord(text, index), text, index, mask, options);
}

/**
 * TYPO-08: does this parenthesis pair take the full-width form?
 *
 * Only the character *outside* the opening parenthesis is read. The bracketed
 * term is what the pair contains, not the text the pair sits in, which is why
 * `English(中文)English` keeps half-width parentheses while `中文(English)文`
 * does not.
 */
export function parensConvert(
  text: string,
  index: number,
  mask: Uint8Array,
  options: TypographyOptions,
): boolean {
  const before = text.charAt(index - 1);
  return decides(
    isCjk(before, options.cjkClasses),
    isAlphanumeric(before),
    text,
    index,
    mask,
    options,
  );
}

/**
 * Is this '.' a lone full stop following CJK?
 *
 * A '.' in Markdown is three different things: a sentence end, a decimal point
 * and an ellipsis, and adjacency on either side was not enough to tell them
 * apart - '等等...' became '等等。..' because the first dot's left neighbour is
 * CJK. The dot must stand alone, with no dot on either side, and follow CJK.
 *
 * Standing alone is the test, not the end of the line: '中文.后面还有字' is a
 * sentence boundary and converts, while an ellipsis anywhere does not. The
 * character it follows is the nearest significant one, so '中文 .后面' converts
 * too - a space is not a reason for a full stop to stop being a full stop.
 */
export function isLoneDotAfterCjk(
  text: string,
  index: number,
  mask: Uint8Array,
  options: TypographyOptions,
): boolean {
  if (text.charAt(index - 1) === '.' || text.charAt(index + 1) === '.') return false;
  return isCjk(significantBefore(text, index, mask), options.cjkClasses);
}
