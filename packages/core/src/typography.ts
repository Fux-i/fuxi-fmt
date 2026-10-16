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
 * TYPO-03 (compound names), TYPO-07 (full-width punctuation), TYPO-09 (hashtags),
 * INL-01 (a link bracket is half a word).
 */

import { contentStartOf } from './blocks.ts';
import { isCjk, isFullPunct, isSpacingChar, type CjkClass } from './chars.ts';
import type { CharRange } from './ignores.ts';
import type { TypographyOptions } from './options.ts';
import {
  isBlockRegionKind,
  protectedMask,
  regionMask,
  scanRegions,
  splitSourceLines,
  type Region,
  type RegionKind,
} from './scan.ts';

/**
 * 'open' and 'close' are the two halves of a link bracket (INL-01). A word is a
 * boundary on both sides; 'open' is a boundary on its left only ('[' - spacing it
 * on the right would put the space inside the link text), 'close' on its right
 * only ('](destination)' - spacing it on the left would do the same).
 */
type CharClass = 'cjk' | 'latin' | 'open' | 'close' | 'fullpunct' | 'other' | 'space';

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
  // INL-01: the opening bracket of a link, an image or a reference. It is a word
  // on its left, whichever of those it turns out to be.
  if (ch === '[') return 'open';
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
  // INL-01. A bracket is attached on its inside: nothing is ever placed between
  // '[' and the text it opens, or between the link text and '](destination)'.
  if (prev.cls === 'open' || prev.cls === 'other') return pending;
  if (cur.cls === 'close' || cur.cls === 'other') return pending;
  const left = prev.cls === 'close' ? 'latin' : prev.cls;
  const right = cur.cls === 'open' ? 'latin' : cur.cls;
  if ((left === 'cjk' && right === 'latin') || (left === 'latin' && right === 'cjk')) {
    return ' ';
  }
  return pending;
}

/**
 * The link brackets, as the half of the word they are (INL-01).
 *
 * 1 is the opening half - '[' and the '![' of an image - and 2 is the closing
 * one, the '](destination)' tail the scanner claims as one region. Everything
 * else protected is either a word ('latin') or markup that binds on both sides
 * ('other', which is what an inline HTML tag is).
 */
function linkBracketMask(text: string, regions: readonly Region[]): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const region of regions) {
    if (region.kind !== 'linkSyntax') continue;
    // An image marker is scanned as '![' - one region - so the bracket is the
    // second character there.
    const at = text.charAt(region.start) === '!' ? region.start + 1 : region.start;
    const head = text.charAt(at);
    const value = head === '[' ? 1 : head === ']' ? 2 : 0;
    if (value === 0) continue;
    for (let i = region.start; i < region.end; i++) mask[i] = value;
  }
  return mask;
}

/** The class of one character inside a protected region. */
function protectedClassAt(
  at: number,
  syntaxMask: Uint8Array,
  bracketMask: Uint8Array,
): CharClass {
  const bracket = bracketMask[at];
  if (bracket === 1) return 'open';
  if (bracket === 2) return 'close';
  return syntaxMask[at] === 1 ? 'other' : 'latin';
}

function tokenize(
  text: string,
  from: number,
  to: number,
  mask: Uint8Array,
  syntaxMask: Uint8Array,
  bracketMask: Uint8Array,
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
      // sentence, and so does a wikilink. A link bracket is the exception: each
      // half is a word on its outside and markup on its inside (INL-01), and an
      // inline HTML tag is markup on both.
      let k = i;
      while (k < j) {
        const cls = protectedClassAt(k, syntaxMask, bracketMask);
        let end = k;
        while (end < j && protectedClassAt(end, syntaxMask, bracketMask) === cls) end++;
        units.push({ text: text.slice(k, end), cls, start: k });
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
  bracketMask: Uint8Array,
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

  const units = tokenize(text, from, to, mask, syntaxMask, bracketMask, options);
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

/**
 * Protected characters that are markup rather than a word: an inline HTML tag,
 * which binds on both sides. The link brackets are the third case and are not
 * here: each half binds on its inside only (INL-01), which is what
 * linkBracketMask is for.
 */
const isInlineSyntax = (kind: RegionKind): boolean => kind === 'inlineHtml';

export function applyTypography(
  text: string,
  options: TypographyOptions,
  extra: readonly CharRange[] = [],
): string {
  if (!options.cjkSpacing) return text;

  const regions = scanRegions(text);
  const mask = protectedMask(text, extra, regions);
  const blockMask = regionMask(text, isBlockRegionKind, extra, regions);
  const syntaxMask = regionMask(text, isInlineSyntax, [], regions);
  const bracketMask = linkBracketMask(text, regions);
  const lines = splitSourceLines(text);
  let out = '';
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line === undefined) continue;
    const next = lines[li + 1];
    const newline = text.slice(line.end, next === undefined ? text.length : next.start);
    const contentStart = line.start + contentStartOf(text.slice(line.start, line.end));
    out +=
      formatLine(
        text,
        line.start,
        line.end,
        contentStart,
        mask,
        syntaxMask,
        bracketMask,
        blockMask,
        options,
      ) +
      newline;
  }
  return out;
}
