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

import { quotePrefix } from './blocks.ts';
import type { CharRange } from './ignores.ts';

export type RegionKind =
  | 'frontMatter'
  | 'fencedCode'
  | 'indentedCode'
  | 'htmlBlock'
  | 'htmlComment'
  | 'inlineCode'
  | 'inlineMath'
  | 'mathBlock'
  | 'url'
  | 'wikilink'
  | 'mdx'
  /**
   * The delimiters that make a link or an image one: an image's leading
   * exclamation mark and bracket, a link's destination in parentheses, and a
   * reference definition's colon, destination and title. SAFE-06 calls a
   * destination byte-verbatim, and the delimiters around it are syntax in
   * exactly the same sense; without them here TYPO-05, TYPO-08 and TYPO-11
   * rewrote them, which does not spoil the look of a link - it stops the line
   * being one.
   */
  | 'linkSyntax'
  /**
   * A tag in the middle of a line (SAFE-04). The mdx pattern below wants a
   * capital letter and an htmlBlock wants the tag to start its line, so an
   * inline lowercase tag with attributes was claimed by nothing at all: its
   * straight quotes became curly Chinese ones and the spaces between its
   * attributes were eaten by the plain-prose rules.
   */
  | 'inlineHtml'

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
  /**
   * Whether a block region found its terminator. Only the kinds that can run to
   * end of file set it: a fence with no closer is still a fence, and everything
   * that follows is inside it, so the formatter has to know it guessed (DET-01).
   */
  readonly closed?: boolean;
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

/**
 * A line's content, seen past the block quote markers it is wrapped in.
 *
 * A protected region inside a block quote is still a protected region: the fence
 * in `> ```` is a fence and its body is code (SAFE-01), and the same holds for
 * front matter's siblings - display math and an HTML block. The markers are part
 * of the region and not one byte of them moves; knowing where the content begins
 * only decides which block the line starts.
 */
interface LineContent {
  /** Offset of the content, past the marker chain and the one space after it. */
  readonly at: number;
  /** Offset of the content's first non-whitespace character. */
  readonly body: number;
  /** Column width of the whitespace before it, tabs to four-column stops. */
  readonly columns: number;
  /** How many block quote markers the line carries. */
  readonly depth: number;
}

function contentOf(text: string): LineContent {
  const quote = quotePrefix(text);
  // BLK-09 owns one space after the last marker; the whitespace after that is the
  // content's own indentation, which is what makes an indented code block inside a
  // quote code rather than a paragraph. With no marker there is no separator, and
  // the leading whitespace is the line's own indentation.
  const after = text.charCodeAt(quote.end);
  const separator = quote.depth > 0 && (after === SPACE || after === TAB) ? 1 : 0;
  const at = quote.end + separator;
  const inner = text.slice(at);
  const width = leadingIndent(inner);
  return { at, body: at + width, columns: indentColumns(inner, width), depth: quote.depth };
}

/** What a block scan found: its last line, where to resume, and whether it closed. */
interface BlockEnd {
  /** Exclusive end offset of the region. */
  readonly end: number;
  /** Line index to resume scanning at. */
  readonly next: number;
  readonly closed: boolean;
}

/**
 * Walk forward for a line that closes a block, stopping where the block quote the
 * block opened in ends.
 *
 * Without the depth test a quoted fence swallowed the rest of the file: a blank
 * line ends the quote, so the fence it opened ends there too and is unterminated -
 * which is what the author is told, instead of the formatter reading the next
 * quote's text as code.
 */
function closerIn(
  lines: Line[],
  from: number,
  opener: LineContent,
  openerEnd: number,
  isCloser: (rest: string, content: LineContent) => boolean,
): BlockEnd {
  let end = openerEnd;
  for (let j = from; j < lines.length; j++) {
    const cand = lines[j];
    if (cand === undefined) continue;
    const content = contentOf(cand.text);
    if (content.depth < opener.depth) return { end, next: j, closed: false };
    end = cand.end;
    if (isCloser(cand.text.slice(content.body), content)) {
      return { end, next: j + 1, closed: true };
    }
  }
  return { end, next: lines.length, closed: false };
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
export function protectedMask(text: string, extra: readonly CharRange[] = []): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const range of extra) {
    for (let i = range.start; i < range.end; i++) mask[i] = 1;
  }
  for (const region of scanRegions(text)) {
    for (let i = region.start; i < region.end; i++) mask[i] = 1;
  }
  return mask;
}

/** Region kinds that occupy whole lines and are never touched (SAFE-01, SAFE-04, FM-01). */
export function isBlockRegionKind(kind: RegionKind): boolean {
  return (
    kind === 'frontMatter' ||
    kind === 'fencedCode' ||
    kind === 'indentedCode' ||
    kind === 'htmlBlock' ||
    kind === 'mathBlock'
  );
}

const LIST_ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])\s/;

/** A YAML mapping key: `title:`, `tags:`, `draft :`. The FM-02 heuristic. */
const YAML_KEY = /^\s*[A-Za-z_][\w.-]*\s*:/;

/** Whether a line reads as a YAML mapping key, which is what opens front matter. */
export function looksLikeYamlKey(text: string): boolean {
  return YAML_KEY.test(text);
}

function runLength(source: string, index: number, code: number): number {
  let n = 0;
  while (index + n < source.length && source.charCodeAt(index + n) === code) n++;
  return n;
}

export function isEscaped(source: string, index: number): boolean {
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
    let closed = false;
    for (let j = 1; j < lines.length; j++) {
      const t = lines[j]?.text.trimEnd() ?? '';
      if (t === '---' || t === '...') {
        const end = lines[j]?.end ?? source.length;
        if (claim(mask, 0, end)) regions.push({ kind: 'frontMatter', start: 0, end, closed: true });
        i = j + 1;
        closed = true;
        break;
      }
    }
    // FM-02. An opener that never closes is still front matter when what follows
    // reads as YAML, and the whole document is then protected rather than having
    // its metadata formatted as prose - "title: 我的,笔记" lost its comma to
    // TYPO-05 and the file a static site generator reads was no longer the file
    // the author wrote.
    //
    // The heuristic is the first non-blank line being a key, so a horizontal rule
    // at the top of a document stays a horizontal rule: refusing that document
    // would be a false alarm on correct input.
    if (!closed) {
      const body = lines.slice(1).find((line) => (line?.text ?? '').trim().length > 0);
      if (body !== undefined && YAML_KEY.test(body.text)) {
        if (claim(mask, 0, source.length)) {
          regions.push({ kind: 'frontMatter', start: 0, end: source.length, closed: false });
        }
        i = lines.length;
      }
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const content = contentOf(line.text);
    const rest = line.text.slice(content.body);

    if (content.columns <= 3 && rest.length > 0) {
      const code = rest.charCodeAt(0);

      if (code === BACKTICK || code === TILDE) {
        const fenceLen = runLength(rest, 0, code);
        if (fenceLen >= 3) {
          const info = rest.slice(fenceLen).trim();
          const indent = line.text.slice(0, content.body);
          const found = closerIn(lines, i + 1, content, line.end, (candRest, candContent) => {
            if (candContent.columns > content.columns + 3) return false;
            if (candRest.length === 0 || candRest.charCodeAt(0) !== code) return false;
            const closing = runLength(candRest, 0, code);
            return closing >= fenceLen && candRest.slice(closing).trim() === '';
          });
          if (claim(mask, line.start, found.end)) {
            regions.push({
              kind: 'fencedCode',
              start: line.start,
              end: found.end,
              info,
              indent,
              closed: found.closed,
            });
          }
          i = found.next - 1;
          continue;
        }
      }

      // Display math occupies whole lines and belongs with code (SAFE-03). The
      // inline matcher cannot do this job: it matches the two $$ markers as
      // separate spans and leaves the body in prose, so every half-width mark
      // inside a formula was converted and LaTeX does not survive that.
      if (rest.trim() === '$$' || (rest.startsWith('$$') && rest.endsWith('$$') && rest.length > 4)) {
        const single = rest.length > 4;
        const found: BlockEnd = single
          ? { end: line.end, next: i + 1, closed: true }
          : closerIn(lines, i + 1, content, line.end, (candRest) => candRest.trim() === '$$');
        if (claim(mask, line.start, found.end)) {
          regions.push({
            kind: 'mathBlock',
            start: line.start,
            end: found.end,
            closed: found.closed,
          });
        }
        i = found.next - 1;
        continue;
      }

      if (code === LT && /^<[A-Za-z][^>]*>/.test(rest) && !/^<(?:br|hr|img|input|meta|link)\b[^>]*\/?>\s*$/i.test(rest)) {
        let end = line.end;
        let next = i + 1;
        for (let j = i + 1; j < lines.length; j++) {
          const cand = lines[j];
          if (cand === undefined) continue;
          const candContent = contentOf(cand.text);
          // A bare '>' is a blank line inside the quote, and that is where the
          // block ends; a line without the marker ends the quote itself.
          if (candContent.depth < content.depth || isBlank(cand.text.slice(candContent.body))) {
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

    if (content.columns >= 4) {
      const before = i === 0 ? undefined : lines[i - 1];
      const beforeContent = before === undefined ? undefined : contentOf(before.text);
      const prevBlank =
        before === undefined ||
        beforeContent === undefined ||
        isBlank(before.text.slice(beforeContent.body));
      if (i === 0 || (prevBlank && !isWithinList(lines, i))) {
        let end = line.end;
        let last = i;
        for (let j = i + 1; j < lines.length; j++) {
          const cand = lines[j];
          if (cand === undefined) continue;
          const candContent = contentOf(cand.text);
          if (
            candContent.depth < content.depth ||
            candContent.columns < 4 ||
            isBlank(cand.text.slice(candContent.body))
          ) {
            break;
          }
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
    const content = contentOf(text);
    if (isBlank(text.slice(content.body))) continue;
    if (content.columns >= 4) return true;
    return LIST_ITEM.test(text.slice(content.body));
  }
  return false;
}

function scanInline(source: string, mask: Uint8Array, regions: Region[]): void {
  // A code span wins the characters it covers. CommonMark parses code spans before
  // raw HTML, and the order matters here: the comment pattern used to claim the
  // first, so an `<!--` written inside backticks swallowed the closing backtick
  // and left two unmatched ones behind.
  scanInlineCode(source, mask, regions);
  scanPattern(source, mask, regions, /<!--[\s\S]*?-->/g, 'htmlComment');
  scanPattern(source, mask, regions, /\[\[[^\]\n]*\]\]/g, 'wikilink');
  scanPattern(source, mask, regions, /\{\{[^}\n]*\}\}/g, 'mdx');
  scanPattern(source, mask, regions, /<[A-Z][A-Za-z0-9.]*(?:\s[^<>]*?)?\/?>/g, 'mdx');
  scanPattern(
    source,
    mask,
    regions,
    /<[/!]?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>\n]*?)?\/?>/g,
    'inlineHtml',
  );
  // Before the url pattern, not after: an absolute destination belongs to its
  // link, and letting url claim the inside of it first would leave the
  // parentheses that delimit it unmasked - which is the bug this closes.
  scanPattern(
    source,
    mask,
    regions,
    /!\[|\]\((?:[^()\n\\]|\\.|\([^()\n]*\))*\)|\]:(?:[ \t]+)(?:<[^<>\n]*>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?/g,
    'linkSyntax',
  );
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
      // No escape check on the closer. Backslash escapes do not work inside a code
      // span, so the closing backtick of a span whose content is a backslash is a
      // delimiter even though a backslash precedes it. Requiring it to be
      // unescaped meant that span never closed and the opener stayed open across
      // the rest of the document, shifting the pairing of every backtick after it:
      // one such span in MAINSTREAM_MD_FORMATTERS_REPORT.md surfaced as a single
      // unmatched backtick forty lines later.
      if (run === open) {
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
