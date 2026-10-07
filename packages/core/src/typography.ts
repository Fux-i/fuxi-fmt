/**
 * CJK typography.
 *
 * The one principle that resolves every disputed case: spacing is a property of
 * the CJK boundary, not of any particular character pairing. A space is
 * inserted only between a CJK character and a non-CJK unit, and nowhere else.
 * Numbers therefore stay tight to percents and units ('15%', '10GB') while
 * being spaced from Han ('第 1 章', '50% 中文') without a single special case.
 *
 * Because the rule never looks inside a run of non-CJK characters, compound
 * names such as 'GPT-4o', 'state-of-the-art' and '60公里/小时' survive intact
 * with no exclusion list.
 *
 * Spec references: TYPO-01 (spacing), TYPO-02 (boundary-only collapse),
 * TYPO-03 (compound names), TYPO-07 (full-width punctuation), TYPO-09 (hashtags).
 */

import { contentStartOf } from './blocks.ts';
import { isCjk, isFullPunct, isSpacingChar, type CjkClass } from './chars.ts';
import type { CharRange } from './ignores.ts';
import type { TypographyOptions } from './options.ts';
import { isBlockRegionKind, scanRegions, splitSourceLines } from './scan.ts';

type CharClass = 'cjk' | 'latin' | 'fullpunct' | 'other' | 'space';

interface Unit {
  readonly text: string;
  readonly cls: CharClass;
  /** Offset of the unit in the text being formatted. */
  readonly start: number;
}

function classOf(ch: string, options: TypographyOptions): CharClass {
  if (isCjk(ch, options.cjkClasses)) return 'cjk';
  // TYPO-09: a mid-text '#' is a hashtag or an anchor and is never spaced by
  // default, because '中文#标签' becoming '中文 # 标签' breaks the tag wherever
  // it is published. Opting in is a deliberate choice, not an oversight.
  if (ch === '#' && options.hashtag) return 'latin';
  if (isSpacingChar(ch, options.spacingSymbols)) return 'latin';
  if (isFullPunct(ch)) return 'fullpunct';
  return 'other';
}

/**
 * The separator to emit between two adjacent units.
 *
 * Full-width punctuation always wins: nothing is ever placed next to it. The one
 * exception is the whitespace that separates a block marker from its content, and
 * it is granted by the caller rather than here: whether a space is syntax or
 * spacing is a fact about the line, not about the two units being joined.
 * A CJK to non-CJK boundary collapses whatever whitespace was present to one
 * space, inserting one when there was none. Everything else keeps the
 * author's whitespace verbatim, so collapsing never leaks outside the boundary.
 */
function separator(prev: Unit, cur: Unit, pending: string): string {
  if (prev.cls === 'fullpunct' || cur.cls === 'fullpunct') return '';
  if ((prev.cls === 'cjk' && cur.cls === 'latin') || (prev.cls === 'latin' && cur.cls === 'cjk')) {
    return ' ';
  }
  return pending;
}

function tokenize(
  text: string,
  from: number,
  to: number,
  mask: Uint8Array,
  syntaxMask: Uint8Array,
  options: TypographyOptions,
): Unit[] {
  const units: Unit[] = [];
  let i = from;
  while (i < to) {
    if (mask[i] === 1) {
      let j = i;
      while (j < to && mask[j] === 1) j++;
      // A protected span usually behaves as one opaque Latin word (SAFE-03), so
      // an inline code span gains the spaces that make it a word in the
      // sentence. Punctuation that delimits a link is not a word: treating the
      // destination as one put a space inside the link text and
      // another after the destination, which is a change the author never asked
      // for and a rule that never wanted to make it. It takes the class the
      // markup characters take, which is to say neither side of it is a
      // boundary.
      let k = i;
      while (k < j) {
        const syntax = syntaxMask[k] === 1;
        let end = k;
        while (end < j && (syntaxMask[end] === 1) === syntax) end++;
        units.push({ text: text.slice(k, end), cls: syntax ? 'other' : 'latin', start: k });
        k = end;
      }
      i = j;
      continue;
    }
    const ch = text.charAt(i);
    if (ch === ' ' || ch === '\t') {
      let j = i;
      while (j < to && (text.charAt(j) === ' ' || text.charAt(j) === '\t')) j++;
      units.push({ text: text.slice(i, j), cls: 'space', start: i });
      i = j;
      continue;
    }
    units.push({ text: ch, cls: classOf(ch, options), start: i });
    i++;
  }
  return units;
}

function formatLine(
  text: string,
  from: number,
  to: number,
  /** Offset of the first content character, past the block markers (see markerHead). */
  contentStart: number,
  mask: Uint8Array,
  syntaxMask: Uint8Array,
  blockMask: Uint8Array,
  options: TypographyOptions,
): string {
  if (from >= to) return '';
  let allBlock = true;
  for (let i = from; i < to; i++) {
    if (blockMask[i] === 0) {
      allBlock = false;
      break;
    }
  }
  if (allBlock) return text.slice(from, to);

  const units = tokenize(text, from, to, mask, syntaxMask, options);
  let out = '';
  let prev: Unit | null = null;
  let pending = '';

  for (const unit of units) {
    if (unit.cls === 'space') {
      if (prev === null) out += unit.text;
      else pending = unit.text;
      continue;
    }
    if (prev === null) {
      out += unit.text;
    } else {
      let sep = separator(prev, unit, pending);
      // TYPO-07 takes the whitespace from beside full-width punctuation, but not
      // the whitespace that separates a block marker from its content: taking
      // that one is what turns a list item into a paragraph. One space stays
      // rather than the run the author wrote, because a separator is one space.
      if (sep.length === 0 && pending.length > 0 && unit.start === contentStart) sep = ' ';
      out += sep + unit.text;
    }
    prev = unit;
    pending = '';
  }
  if (pending.length > 0 && prev !== null) out += pending;
  return out;
}

export function applyTypography(
  text: string,
  options: TypographyOptions,
  extra: readonly CharRange[] = [],
): string {
  if (!options.cjkSpacing) return text;

  const regions = scanRegions(text);
  const mask = new Uint8Array(text.length);
  const blockMask = new Uint8Array(text.length);
  /**
   * Protected characters that are punctuation rather than a word: the
   * delimiters of a link or an image. They are protected either way; the
   * distinction is only about spacing, and it is needed because SAFE-03's model
   * - a protected span is one opaque Latin word - is right for an inline code
   * span and wrong for a bracket.
   */
  const syntaxMask = new Uint8Array(text.length);
  for (const range of extra) {
    for (let i = range.start; i < range.end; i++) {
      mask[i] = 1;
      blockMask[i] = 1;
    }
  }
  for (const region of regions) {
    const block = isBlockRegionKind(region.kind);
    const syntax = region.kind === 'linkSyntax';
    for (let i = region.start; i < region.end; i++) {
      mask[i] = 1;
      if (syntax) syntaxMask[i] = 1;
      if (block) blockMask[i] = 1;
    }
  }

  const lines = splitSourceLines(text);
  let out = '';
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line === undefined) continue;
    const next = lines[li + 1];
    const newline = text.slice(line.end, next === undefined ? text.length : next.start);
    const contentStart = line.start + contentStartOf(text.slice(line.start, line.end));
    out +=
      formatLine(text, line.start, line.end, contentStart, mask, syntaxMask, blockMask, options) +
      newline;
  }
  return out;
}
