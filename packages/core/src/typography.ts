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

import type { TypographyOptions } from './options.ts';
import { isBlockRegionKind, scanRegions, splitSourceLines } from './scan.ts';

type CharClass = 'cjk' | 'latin' | 'fullpunct' | 'other' | 'space';

interface Unit {
  readonly text: string;
  readonly cls: CharClass;
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN = /[A-Za-z0-9]/;

/** Characters that attach to an adjacent Latin or CJK run (TYPO-04, TYPO-10). */
const SPACING_SYMBOLS = new Set(['+', '-', '=', '<', '>', '%', '\u00b0', '\u2103', '\u2109']);

/** Full-width punctuation is a boundary, never a spacing target (TYPO-07). */
const FULL_PUNCT = new Set([
  '\uff0c', '\u3002', '\uff01', '\uff1f', '\uff1b', '\uff1a', '\u3001',
  '\uff08', '\uff09', '\u3010', '\u3011', '\u300c', '\u300d', '\u300a', '\u300b',
  '\u201c', '\u201d', '\u2018', '\u2019',
]);

function classOf(ch: string): CharClass {
  if (CJK.test(ch)) return 'cjk';
  if (LATIN.test(ch) || SPACING_SYMBOLS.has(ch)) return 'latin';
  if (FULL_PUNCT.has(ch)) return 'fullpunct';
  return 'other';
}

/**
 * The separator to emit between two adjacent units.
 *
 * Full-width punctuation always wins: nothing is ever placed next to it.
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

function tokenize(text: string, from: number, to: number, mask: Uint8Array): Unit[] {
  const units: Unit[] = [];
  let i = from;
  while (i < to) {
    if (mask[i] === 1) {
      let j = i;
      while (j < to && mask[j] === 1) j++;
      // A protected span behaves as one opaque Latin word (SAFE-03).
      units.push({ text: text.slice(i, j), cls: 'latin' });
      i = j;
      continue;
    }
    const ch = text.charAt(i);
    if (ch === ' ' || ch === '\t') {
      let j = i;
      while (j < to && (text.charAt(j) === ' ' || text.charAt(j) === '\t')) j++;
      units.push({ text: text.slice(i, j), cls: 'space' });
      i = j;
      continue;
    }
    units.push({ text: ch, cls: classOf(ch) });
    i++;
  }
  return units;
}

function formatLine(text: string, from: number, to: number, mask: Uint8Array, blockMask: Uint8Array): string {
  if (from >= to) return '';
  let allBlock = true;
  for (let i = from; i < to; i++) {
    if (blockMask[i] === 0) {
      allBlock = false;
      break;
    }
  }
  if (allBlock) return text.slice(from, to);

  const units = tokenize(text, from, to, mask);
  let out = '';
  let prev: Unit | null = null;
  let pending = '';

  for (const unit of units) {
    if (unit.cls === 'space') {
      if (prev === null) out += unit.text;
      else pending = unit.text;
      continue;
    }
    out += prev === null ? unit.text : separator(prev, unit, pending) + unit.text;
    prev = unit;
    pending = '';
  }
  if (pending.length > 0 && prev !== null) out += pending;
  return out;
}

export function applyTypography(text: string, options: TypographyOptions): string {
  if (!options.cjkSpacing) return text;

  const regions = scanRegions(text);
  const mask = new Uint8Array(text.length);
  const blockMask = new Uint8Array(text.length);
  for (const region of regions) {
    const block = isBlockRegionKind(region.kind);
    for (let i = region.start; i < region.end; i++) {
      mask[i] = 1;
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
    out += formatLine(text, line.start, line.end, mask, blockMask) + newline;
  }
  return out;
}
