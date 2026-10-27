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

import {
  classifyContent,
  isBlank,
  lineContentOf,
  type AtomicRange,
  type BlockKind,
  type LineContent,
} from './blocks.ts';
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
  containerColumn?: number,
): BlockEnd {
  let end = openerEnd;
  for (let j = from; j < lines.length; j++) {
    const cand = lines[j];
    if (cand === undefined) continue;
    const content = lineContentOf(cand.text);
    if (content.depth < opener.depth) return { end, next: j, closed: false };
    // A line less indented than the list item the fence opened in ends that item,
    // and the code block with it (SAFE-02): its closer has to be inside too. A
    // blank line does not end a list item, which is the difference from a quote.
    if (
      containerColumn !== undefined &&
      content.columns < containerColumn &&
      !isBlank(cand.text.slice(content.body))
    ) {
      return { end, next: j, closed: false };
    }
    end = cand.end;
    if (isCloser(cand.text.slice(content.body), content)) {
      return { end, next: j + 1, closed: true };
    }
  }
  return { end, next: lines.length, closed: false };
}

/**
 * The mask of every character a region of an accepted kind claims, with the
 * caller's ignore ranges folded in.
 *
 * This is the one mask builder: the width passes want every protected character,
 * the spacing pass wants the block kinds and the link and tag syntax separately,
 * and whitespace hygiene wants the block kinds. Passing a predicate rather than
 * walking the regions again means a new region kind is audited here, once.
 */
export function regionMask(
  text: string,
  accept: (kind: RegionKind) => boolean,
  extra: readonly CharRange[] = [],
  regions: readonly Region[] = scanRegions(text),
): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const range of extra) {
    for (let i = range.start; i < range.end; i++) mask[i] = 1;
  }
  for (const region of regions) {
    if (!accept(region.kind)) continue;
    for (let i = region.start; i < region.end; i++) mask[i] = 1;
  }
  return mask;
}

/**
 * Mask of every protected character, block-level and inline (SAFE-01 - SAFE-06).
 *
 * A caller that already holds the regions passes them in. That is not an
 * optimisation: two scans of the same text can disagree, and a rule that fires
 * inside a code block is what disagreement looks like.
 */
export function protectedMask(
  text: string,
  extra: readonly CharRange[] = [],
  regions: readonly Region[] = scanRegions(text),
): Uint8Array {
  return regionMask(text, () => true, extra, regions);
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

/** A list marker at the head of a line, with the whitespace that follows it. */
const LIST_HEAD = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)/;

function scanBlocks(source: string, lines: Line[], mask: Uint8Array, regions: Region[]): void {
  /**
   * The content column of every list item still open, innermost last. A fence is
   * indented relative to its container, so the column to compare against is the
   * item's, not the left margin - reading the margin hid every fence at column 4
   * or more and left its body to the prose rules (SAFE-02).
   */
  const containers: { readonly depth: number; readonly column: number }[] = [];
  /** Whether the last line was prose, which is what stops `2.` opening a list. */
  let previousIsParagraph = false;
  let i = 0;
  const first = lines[0];
  const opener = first === undefined ? '' : first.text.trimEnd();
  if (opener === '---' || opener === '+++') {
    // YAML closes with `---` or the document-end marker `...`; the TOML form has
    // one marker, because TOML has no document-end or multi-document syntax.
    const closes =
      opener === '+++'
        ? (text: string): boolean => text === '+++'
        : (text: string): boolean => text === '---' || text === '...';
    let closed = false;
    for (let j = 1; j < lines.length; j++) {
      const t = lines[j]?.text.trimEnd() ?? '';
      if (!closes(t)) continue;
      const end = lines[j]?.end ?? source.length;
      if (claim(mask, 0, end)) regions.push({ kind: 'frontMatter', start: 0, end, closed: true });
      i = j + 1;
      closed = true;
      break;
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
    if (!closed && opener === '---') {
      const body = lines.slice(1).find((line) => (line?.text ?? '').trim().length > 0);
      if (body !== undefined && YAML_KEY.test(body.text)) {
        if (claim(mask, 0, source.length)) {
          regions.push({ kind: 'frontMatter', start: 0, end: source.length, closed: false });
        }
        i = lines.length;
      }
    }
    // FM-06. An opener that never closes is still TOML front matter, and no
    // heuristic is needed to say so: the block is never parsed, so there is no
    // reading to get wrong. Treating it as prose is the one outcome ruled out.
    if (!closed && opener === '+++') {
      if (claim(mask, 0, source.length)) {
        regions.push({ kind: 'frontMatter', start: 0, end: source.length, closed: false });
      }
      i = lines.length;
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const content = lineContentOf(line.text);
    const rest = line.text.slice(content.body);

    // A blank line does not close a list item, so the stack is only updated for
    // lines that carry content. An item is closed by anything less indented than
    // its content column, which is the same test CommonMark uses for the item.
    // Only a list item opens a container: a thematic break matches a bullet at
    // its head too, and taking it as one made an indented block read as a fence.
    // '2.' does not open one after a paragraph either - only '1.' interrupts a
    // paragraph, so a higher numeral there is that paragraph's continuation.
    const kind = classifyContent(rest);
    const candidate = kind === 'list' ? LIST_HEAD.exec(rest) : null;
    const marker = candidate?.[2] ?? '';
    const head =
      !previousIsParagraph || !/^\d/.test(marker) || /^1[.)]$/.test(marker) ? candidate : null;
    // The item this line sits in, before the item it may open itself: an indented
    // code block is measured from the former, a fence that is the item's own
    // content from the latter.
    let enclosing: { readonly depth: number; readonly column: number } | undefined;
    if (rest.trim().length > 0) {
      while (containers.length > 0) {
        const open = containers[containers.length - 1];
        if (open === undefined) break;
        // A shallower line, by indentation or by quote depth, ends the item.
        if (open.depth > content.depth || open.column > content.columns) {
          containers.pop();
          continue;
        }
        break;
      }
      enclosing = containers[containers.length - 1];
      if (head !== null) {
        containers.push({ depth: content.depth, column: content.columns + (head[0] ?? '').length });
      }
    }
    previousIsParagraph = kind === 'paragraph';
    const container = containers[containers.length - 1];
    // An item that opens with a fence keeps it: the delimiter starts at the item's
    // content column, so the marker in front of it is a prefix, not prose.
    const markerWidth = head === null ? 0 : (head[0] ?? '').length;
    const fenceRest = rest.slice(markerWidth);
    const fenceColumn = content.columns + markerWidth;

    // A fence may sit up to three columns past the content column of the item it
    // belongs to, so this gate is relative to the container rather than the margin.
    const fenceAt =
      content.columns <= 3 ||
      (container !== undefined && fenceColumn <= container.column + 3);

    if (fenceAt && fenceRest.length > 0) {
      const code = fenceRest.charCodeAt(0);

      if (code === BACKTICK || code === TILDE) {
        const fenceLen = runLength(fenceRest, 0, code);
        if (fenceLen >= 3) {
          const info = fenceRest.slice(fenceLen).trim();
          const indent = line.text.slice(0, content.body + markerWidth);
          const found = closerIn(
            lines,
            i + 1,
            content,
            line.end,
            (candRest, candContent) => {
              if (candContent.columns > fenceColumn + 3) return false;
              if (candRest.length === 0 || candRest.charCodeAt(0) !== code) return false;
              const closing = runLength(candRest, 0, code);
              return closing >= fenceLen && candRest.slice(closing).trim() === '';
            },
            container?.column,
          );
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
          previousIsParagraph = false;
          continue;
        }
      }
    }

    // Display math and HTML blocks follow the same container rule as a fence: up to
    // three columns past the content column of the item they sit in. Four or more
    // is an indented code block, which is the branch below.
    const blockAt =
      content.columns <= 3 ||
      (container !== undefined && content.columns <= container.column + 3);

    if (blockAt && rest.length > 0) {
      const code = rest.charCodeAt(0);

      // Display math occupies whole lines and belongs with code (SAFE-03). The
      // inline matcher cannot do this job: it matches the two $$ markers as
      // separate spans and leaves the body in prose, so every half-width mark
      // inside a formula was converted and LaTeX does not survive that.
      if (rest.trim() === '$$' || (rest.startsWith('$$') && rest.endsWith('$$') && rest.length > 4)) {
        const single = rest.length > 4;
        const found: BlockEnd = single
          ? { end: line.end, next: i + 1, closed: true }
          : closerIn(
              lines,
              i + 1,
              content,
              line.end,
              (candRest) => candRest.trim() === '$$',
              container?.column,
            );
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
          const candContent = lineContentOf(cand.text);
          // A bare '>' is a blank line inside the quote, and that is where the
          // block ends; a line without the marker ends the quote itself, and so
          // does one that returns to the left of the item the block opened in.
          if (
            candContent.depth < content.depth ||
            isBlank(cand.text.slice(candContent.body)) ||
            (container !== undefined && candContent.columns < container.column)
          ) {
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

    // An indented code block is four columns past the container it sits in, and it
    // cannot interrupt a paragraph. Once it starts it runs across blank lines while
    // what follows is still indented that far (SAFE-01).
    const codeColumn = enclosing === undefined ? 4 : enclosing.column + 4;
    if (content.columns >= codeColumn) {
      const before = i === 0 ? undefined : lines[i - 1];
      const beforeContent = before === undefined ? undefined : lineContentOf(before.text);
      const prevBlank =
        before === undefined ||
        beforeContent === undefined ||
        isBlank(before.text.slice(beforeContent.body));
      if (i === 0 || prevBlank) {
        let end = line.end;
        let last = i;
        for (let j = i + 1; j < lines.length; j++) {
          const cand = lines[j];
          if (cand === undefined) continue;
          const candContent = lineContentOf(cand.text);
          if (candContent.depth < content.depth) break;
          const blank = isBlank(cand.text.slice(candContent.body));
          if (!blank && candContent.columns < codeColumn) break;
          if (!blank) {
            end = cand.end;
            last = j;
          }
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
    // A backtick a block region already claimed is a fence delimiter, not a span
    // delimiter. Without this test a fence's three backticks paired with the next
    // fence's, inventing a span across the prose in between.
    if (source.charCodeAt(i) !== BACKTICK || mask[i] === 1 || isEscaped(source, i)) {
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
      if (source.charCodeAt(j) !== BACKTICK || mask[j] === 1) {
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
    // A span whose bytes another region holds is no span at all, and the scan
    // resumes just past its opener: jumping to `end` skipped every backtick the
    // rejected pair enclosed, leaving the spans there unmasked (DET-06).
    if (claim(mask, i, end)) {
      regions.push({ kind: 'inlineCode', start: i, end });
      i = end;
    } else {
      i += open;
    }
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

/**
 * The index of the line containing `offset`, or -1 when there is none.
 *
 * One answer to "which line did the author write this on". The offset is
 * inclusive at a line's start, so an offset on a line break belongs to the line
 * that break ends, and an offset past the last line's start belongs to that last
 * line - which is where a trailing newline's empty line lives. A negative offset
 * is before the document, and -1 says so rather than guessing line 0.
 *
 * This is the only such lookup. A diagnostic that names a line, the guard that
 * checks one, and an adapter that turns one into a position all cross this seam.
 */
export function lineIndexOf(lines: readonly SourceLine[], offset: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    if (line === undefined) break;
    if (line.start <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** What a region is when the segmenter reads it: a range that occupies whole lines. */
const ATOMIC_KINDS: Readonly<Record<string, BlockKind>> = {
  frontMatter: 'frontMatter',
  fencedCode: 'code',
  indentedCode: 'code',
  htmlBlock: 'html',
  mathBlock: 'code',
};

/**
 * The lines a protected region covers.
 *
 * A block region (SAFE-01 - SAFE-04, FM-01) occupies whole lines. A region that
 * is not a block kind can still contain a line ending - an HTML comment, a code
 * span the author wrapped across lines - and every structural pass decides by
 * line, so those lines are protected too. SAFE-01 is a promise about bytes; this
 * is its line-level reading, and the only one, so no two passes can disagree
 * about which lines the formatter must not touch.
 */
export function protectedLines(
  text: string,
  lines: readonly SourceLine[],
  regions: readonly Region[],
): boolean[] {
  return coveredLines(text, lines, regions, () => true);
}

/**
 * The protected lines whose content is prose rather than a block (SAFE-03, SAFE-04).
 *
 * A code span and an HTML comment may contain a line ending, and a structural pass
 * reads every run of protected lines as a block. These lines are not one: they are
 * part of the paragraph around them, and segment() glues them into it instead of
 * separating them. An ignored line is not prose - CFG-03 asks for its bytes, not
 * for a reading of it.
 */
export function proseLines(
  text: string,
  lines: readonly SourceLine[],
  regions: readonly Region[],
): boolean[] {
  return coveredLines(text, lines, regions, (kind) => !isBlockRegionKind(kind));
}

function coveredLines(
  text: string,
  lines: readonly SourceLine[],
  regions: readonly Region[],
  accept: (kind: RegionKind) => boolean,
): boolean[] {
  const out = new Array<boolean>(lines.length).fill(false);
  for (const region of regions) {
    if (!accept(region.kind)) continue;
    const start = lineIndexOf(lines, region.start);
    const last = lineIndexOf(lines, Math.max(region.start, region.end - 1));
    if (start < 0 || last < 0 || last < start) continue;
    const newline = text.indexOf('\n', region.start);
    const spansLines = newline !== -1 && newline < region.end;
    if (!isBlockRegionKind(region.kind) && !spansLines) continue;
    for (let i = start; i <= last; i++) out[i] = true;
  }
  return out;
}

/** The regions that occupy whole lines, as the ranges the segmenter reads. */
export function atomicRanges(
  lines: readonly SourceLine[],
  regions: readonly Region[],
): AtomicRange[] {
  const ranges: AtomicRange[] = [];
  for (const region of regions) {
    const kind = ATOMIC_KINDS[region.kind];
    if (kind === undefined) continue;
    const start = lineIndexOf(lines, region.start);
    const last = lineIndexOf(lines, Math.max(region.start, region.end - 1));
    if (start < 0 || last < 0 || last < start) continue;
    ranges.push({ start, end: last + 1, kind });
  }
  return ranges;
}
