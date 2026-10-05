/**
 * Line classification and block segmentation.
 *
 * Segmentation is what makes BLK-01 safe: a block is a maximal run of lines
 * that must stay glued together, so inserting a separator between blocks can
 * never split a list item from its own content. Lists that are already loose
 * are separated by blank lines and therefore become several blocks, which is
 * how BLK-03 (never flip list tightness) is honoured for free.
 */

export type LineKind =
  | 'blank'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'table'
  | 'break'
  | 'paragraph';

export type ContentKind = Exclude<LineKind, 'blank'>;

export type BlockKind = ContentKind | 'frontMatter' | 'code' | 'html';

export interface Block {
  readonly kind: BlockKind;
  /** Inclusive line index. */
  readonly start: number;
  /** Exclusive line index. */
  readonly end: number;
  /** Blank lines that preceded this block in the source. */
  readonly blanksBefore: number;
}

export interface AtomicRange {
  readonly start: number;
  readonly end: number;
  readonly kind: BlockKind;
}

const THEMATIC_BREAK = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const BLOCKQUOTE = /^\s*>/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const LIST_ITEM = /^\s*(?:[-*+]|\d{1,9}[.)])(?:\s+|$)/;
const TABLE = /^\s*\|/;
/** A setext heading underline: a run of dashes that closes the paragraph above it. */
const SETEXT_UNDERLINE = /^ {0,3}-+[ \t]*$/;

/** Classification of a line that is known not to be blank. */
export function classifyContent(text: string): ContentKind {
  if (THEMATIC_BREAK.test(text)) return 'break';
  if (BLOCKQUOTE.test(text)) return 'blockquote';
  if (HEADING.test(text)) return 'heading';
  if (LIST_ITEM.test(text)) return 'list';
  if (TABLE.test(text)) return 'table';
  return 'paragraph';
}

export function classifyLine(text: string): LineKind {
  return text.trim().length === 0 ? 'blank' : classifyContent(text);
}

function extendsBlock(current: ContentKind, next: ContentKind): boolean {
  if (current === 'paragraph') return next === 'paragraph';
  if (current === 'list') return next === 'list' || next === 'paragraph';
  if (current === 'blockquote') return next === 'blockquote' || next === 'paragraph';
  if (current === 'table') return next === 'table';
  return false;
}

/**
 * Block quote markers at the head of a line: the `>` chain, each marker followed by
 * at most one space. This is the syntax TYPO-07 and BLK-09 both need to know about,
 * and the scanner needs it to see a protected region that is wrapped in a quote.
 */
export interface QuotePrefix {
  /** Offset just past the last marker. */
  readonly end: number;
  /** How many markers the chain has. */
  readonly depth: number;
}

const QUOTE_MARKER = /^[ \t]*>/;

export function quotePrefix(line: string): QuotePrefix {
  let at = 0;
  let depth = 0;
  for (;;) {
    const match = QUOTE_MARKER.exec(line.slice(at));
    if (match === null) return { end: at, depth };
    at += match[0].length;
    depth++;
  }
}

const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)/;
const HEADING_MARKER = /^[ \t]*#{1,6}(?=[ \t]|$)/;

/**
 * Where the content of a line starts, past the block markers at its head and the
 * whitespace the last of them is separated by.
 *
 * TYPO-07 deletes the whitespace beside full-width punctuation, and at a block
 * marker that whitespace is syntax rather than spacing: `- “引用”` is a list
 * item, while `-“引用”` is a paragraph that happens to start with a hyphen. The
 * two are the same characters with a different meaning, and the formatter is not
 * free to choose the second. The markers recognised here mirror the
 * classification above; what is needed is where the marker chain ends, not
 * whether the line is one.
 */
export function contentStartOf(line: string): number {
  let at = 0;
  for (;;) {
    const rest = line.slice(at);
    const match =
      QUOTE_MARKER.exec(rest) ?? LIST_MARKER.exec(rest) ?? HEADING_MARKER.exec(rest);
    if (match === null) break;
    at += match[0].length;
  }
  const spaces = /^[ \t]*/.exec(line.slice(at))?.[0] ?? '';
  return at + spaces.length;
}

export function segment(texts: readonly string[], atomic: readonly AtomicRange[]): Block[] {
  const starts = new Map<number, AtomicRange>();
  const inside = new Set<number>();
  for (const range of atomic) {
    starts.set(range.start, range);
    for (let i = range.start; i < range.end; i++) inside.add(i);
  }

  const blocks: Block[] = [];
  let i = 0;
  let blanks = 0;

  while (i < texts.length) {
    const text = texts[i] ?? '';
    if (text.trim().length === 0) {
      blanks++;
      i++;
      continue;
    }

    const atom = starts.get(i);
    if (atom !== undefined) {
      blocks.push({ kind: atom.kind, start: atom.start, end: atom.end, blanksBefore: blanks });
      i = atom.end;
      blanks = 0;
      continue;
    }

    const kind = classifyContent(text);
    let j = i + 1;
    let setext = false;
    // A '-' run directly under a paragraph is a setext heading underline, not a
    // thematic break: 'text' followed by '---' is an H2, and a blank line inserted
    // between the two would rewrite it as a paragraph and a horizontal rule. They
    // are one block, so nothing separates them.
    if (kind === 'paragraph' && !inside.has(i + 1) && SETEXT_UNDERLINE.test(texts[i + 1] ?? '')) {
      j = i + 2;
      setext = true;
    }
    while (!setext && j < texts.length) {
      const candidate = texts[j] ?? '';
      if (candidate.trim().length === 0 || inside.has(j)) break;
      if (!extendsBlock(kind, classifyContent(candidate))) break;
      j++;
    }
    blocks.push({ kind, start: i, end: j, blanksBefore: blanks });
    i = j;
    blanks = 0;
  }

  return blocks;
}
