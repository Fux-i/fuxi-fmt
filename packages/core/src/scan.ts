/**
 * Protected-region scanner.
 *
 * Everything this module reports is copied byte-for-byte by the formatter. The
 * scanner is deliberately conservative: a false positive costs a missed
 * formatting opportunity, a false negative corrupts a document.
 *
 * Spec references: SAFE-01 (code), SAFE-02 (fence delimiter line),
 * SAFE-03 (inline code and math), SAFE-04 (HTML), SAFE-05 (MDX and shortcodes),
 * SAFE-06 (URLs and destinations), FM-01 (front matter).
 */

export type RegionKind =
  | 'frontMatter'
  | 'fencedCode'
  | 'indentedCode'
  | 'htmlBlock'
  | 'htmlComment'
  | 'inlineCode'
  | 'inlineMath'
  | 'url'
  | 'wikilink'
  | 'mdx';

export interface Region {
  readonly kind: RegionKind;
  /** Inclusive character offset. */
  readonly start: number;
  /** Exclusive character offset. */
  readonly end: number;
  /** Fence info string, verbatim (SAFE-02). Only set for fencedCode. */
  readonly info?: string;
  /** Leading indentation before the fence delimiter, verbatim (SAFE-02). */
  readonly indent?: string;
}

interface Line {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const LF = 10;
const CR = 13;
const SPACE = 32;
const TAB = 9;
const BACKTICK = 96;
const TILDE = 126;
const BACKSLASH = 92;
const LT = 60;

function splitLines(source: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) !== LF) continue;
    const end = i > start && source.charCodeAt(i - 1) === CR ? i - 1 : i;
    lines.push({ start, end, text: source.slice(start, end) });
    start = i + 1;
  }
  lines.push({ start, end: source.length, text: source.slice(start) });
  return lines;
}

function leadingIndent(text: string): number {
  let n = 0;
  while (n < text.length) {
    const c = text.charCodeAt(n);
    if (c !== SPACE && c !== TAB) break;
    n++;
  }
  return n;
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/** Column width of the leading whitespace, expanding tabs to four-column stops. */
function indentColumns(text: string, chars: number): number {
  let column = 0;
  for (let i = 0; i < chars; i++) {
    column = text.charCodeAt(i) === TAB ? column + (4 - (column % 4)) : column + 1;
  }
  return column;
}

/** Mask of every protected character, block-level and inline (SAFE-01 – SAFE-06). */
export function protectedMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const region of scanRegions(text)) {
    for (let i = region.start; i < region.end; i++) mask[i] = 1;
  }
  return mask;
}

/** Region kinds that occupy whole lines and are never touched (SAFE-01, SAFE-04, FM-01). */
export function isBlockRegionKind(kind: RegionKind): boolean {
  return kind === 'frontMatter' || kind === 'fencedCode' || kind === 'indentedCode' || kind === 'htmlBlock';
}

const LIST_ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])\s/;

function runLength(source: string, index: number, code: number): number {
  let n = 0;
  while (index + n < source.length && source.charCodeAt(index + n) === code) n++;
  return n;
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && source.charCodeAt(i) === BACKSLASH; i--) backslashes++;
  return backslashes % 2 === 1;
}

function claim(mask: Uint8Array, start: number, end: number): boolean {
  const from = Math.max(0, start);
  const to = Math.min(mask.length, end);
  for (let i = from; i < to; i++) if (mask[i] === 1) return false;
  for (let i = from; i < to; i++) mask[i] = 1;
  return true;
}

export function scanRegions(source: string): Region[] {
  const lines = splitLines(source);
  const mask = new Uint8Array(source.length);
  const regions: Region[] = [];
  scanBlocks(source, lines, mask, regions);
  scanInline(source, mask, regions);
  regions.sort((a, b) => a.start - b.start);
  return regions;
}

function scanBlocks(source: string, lines: Line[], mask: Uint8Array, regions: Region[]): void {
  let i = 0;
  const first = lines[0];
  if (first !== undefined && first.text.trimEnd() === '---') {
    for (let j = 1; j < lines.length; j++) {
      const t = lines[j]?.text.trimEnd() ?? '';
      if (t === '---' || t === '...') {
        const end = lines[j]?.end ?? source.length;
        if (claim(mask, 0, end)) regions.push({ kind: 'frontMatter', start: 0, end });
        i = j + 1;
        break;
      }
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const indentLen = leadingIndent(line.text);
    const indentCols = indentColumns(line.text, indentLen);
    const rest = line.text.slice(indentLen);

    if (indentCols <= 3 && rest.length > 0) {
      const code = rest.charCodeAt(0);

      if (code === BACKTICK || code === TILDE) {
        const fenceLen = runLength(rest, 0, code);
        if (fenceLen >= 3) {
          const info = rest.slice(fenceLen).trim();
          const indent = line.text.slice(0, indentLen);
          let end = source.length;
          let next = lines.length;
          for (let j = i + 1; j < lines.length; j++) {
            const cand = lines[j];
            if (cand === undefined) continue;
            const candIndent = leadingIndent(cand.text);
            if (candIndent > indentLen + 3) continue;
            const candRest = cand.text.slice(candIndent);
            if (candRest.length === 0 || candRest.charCodeAt(0) !== code) continue;
            const closing = runLength(candRest, 0, code);
            if (closing >= fenceLen && candRest.slice(closing).trim() === '') {
              end = cand.end;
              next = j + 1;
              break;
            }
          }
          if (claim(mask, line.start, end)) {
            regions.push({ kind: 'fencedCode', start: line.start, end, info, indent });
          }
          i = next - 1;
          continue;
        }
      }

      if (code === LT && /^<[A-Za-z][^>]*>/.test(rest) && !/^<(?:br|hr|img|input|meta|link)\b[^>]*\/?>\s*$/i.test(rest)) {
        let end = line.end;
        let next = i + 1;
        for (let j = i + 1; j < lines.length; j++) {
          const cand = lines[j];
          if (cand === undefined) continue;
          if (isBlank(cand.text)) {
            next = j;
            break;
          }
          end = cand.end;
          next = j + 1;
        }
        if (claim(mask, line.start, end)) {
          regions.push({ kind: 'htmlBlock', start: line.start, end });
        }
        i = next - 1;
        continue;
      }
    }

    if (indentCols >= 4) {
      const prevBlank = i === 0 || isBlank(lines[i - 1]?.text ?? '');
      if (i === 0 || (prevBlank && !isWithinList(lines, i))) {
        let end = line.end;
        let last = i;
        for (let j = i + 1; j < lines.length; j++) {
          const cand = lines[j];
          if (cand === undefined) continue;
          const candidateIndent = leadingIndent(cand.text);
          if (isBlank(cand.text) || indentColumns(cand.text, candidateIndent) < 4) break;
          end = cand.end;
          last = j;
        }
        if (claim(mask, line.start, end)) {
          regions.push({ kind: 'indentedCode', start: line.start, end });
        }
        i = last;
        continue;
      }
    }
  }
}

/** True when the nearest preceding non-blank line opens a list or blockquote. */
function isWithinList(lines: Line[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    const text = lines[j]?.text ?? '';
    if (isBlank(text)) continue;
    const chars = leadingIndent(text);
    if (indentColumns(text, chars) >= 4) return true;
    return LIST_ITEM.test(text);
  }
  return false;
}

function scanInline(source: string, mask: Uint8Array, regions: Region[]): void {
  scanPattern(source, mask, regions, /<!--[\s\S]*?-->/g, 'htmlComment');
  scanInlineCode(source, mask, regions);
  scanPattern(source, mask, regions, /\[\[[^\]\n]*\]\]/g, 'wikilink');
  scanPattern(source, mask, regions, /\{\{[^}\n]*\}\}/g, 'mdx');
  scanPattern(source, mask, regions, /<[A-Z][A-Za-z0-9.]*(?:\s[^<>]*?)?\/?>/g, 'mdx');
  scanPattern(source, mask, regions, /https?:\/\/[^\s<>()[\]{}"'\u3000-\u303f\uff00-\uffef]+/g, 'url');
  scanMath(source, mask, regions);
}

function scanPattern(
  source: string,
  mask: Uint8Array,
  regions: Region[],
  pattern: RegExp,
  kind: RegionKind,
): void {
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = start + match[0].length;
    if (isEscaped(source, start)) continue;
    if (!claim(mask, start, end)) continue;
    regions.push({ kind, start, end });
  }
}

function scanInlineCode(source: string, mask: Uint8Array, regions: Region[]): void {
  let i = 0;
  while (i < source.length) {
    if (source.charCodeAt(i) !== BACKTICK || isEscaped(source, i)) {
      i++;
      continue;
    }
    const open = runLength(source, i, BACKTICK);
    let j = i + open;
    let closeAt = -1;
    while (j < source.length) {
      if (source.charCodeAt(j) === LF) {
        // A code span may cross a line break but never a blank line. Without
        // this, an unmatched backtick finds a partner paragraphs away and
        // invents a "span" spanning half the document, which then blocks every
        // rule that runs inside it.
        let k = j + 1;
        while (k < source.length) {
          const c = source.charCodeAt(k);
          if (c === SPACE || c === TAB || c === CR) k++;
          else break;
        }
        if (k >= source.length || source.charCodeAt(k) === LF) break;
      }
      if (source.charCodeAt(j) !== BACKTICK) {
        j++;
        continue;
      }
      const run = runLength(source, j, BACKTICK);
      if (run === open && !isEscaped(source, j)) {
        closeAt = j;
        break;
      }
      j += run;
    }
    if (closeAt === -1) {
      i += open;
      continue;
    }
    const end = closeAt + open;
    if (claim(mask, i, end)) regions.push({ kind: 'inlineCode', start: i, end });
    i = end;
  }
}

function scanMath(source: string, mask: Uint8Array, regions: Region[]): void {
  const pattern = /\$(?!\s)([^$\n]*?)(?<!\s)\$/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = start + match[0].length;
    if (isEscaped(source, start)) continue;
    if (!claim(mask, start, end)) continue;
    regions.push({ kind: 'inlineMath', start, end });
  }
}

export interface SourceLine {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Line offsets, for callers that need to map regions back onto lines. */
export function splitSourceLines(source: string): SourceLine[] {
  return splitLines(source);
}
