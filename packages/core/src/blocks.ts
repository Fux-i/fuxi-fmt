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

/**
 * The kind of a range that occupies whole lines: a block, or a run of prose.
 *
 * A code span or an HTML comment may contain a line ending (SAFE-03, SAFE-04), and
 * the lines it covers are then prose rather than a block of their own. segment()
 * glues them into the paragraph around them; the distinction is why this type is
 * wider than BlockKind.
 */
export type AtomicKind = BlockKind | 'prose';

export interface AtomicRange {
  readonly start: number;
  readonly end: number;
  readonly kind: AtomicKind;
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

function extendsBlock(current: BlockKind, next: ContentKind): boolean {
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

/**
 * The line as it reads from inside its block quote markers.
 *
 * The marker chain is a prefix, so what a quoted line *is* - a list item, a
 * heading, a blank line - is what its content is. A bare `>` is a blank line
 * inside the quote, which is what lets a rule put a blank line there at all.
 */
export function quoteContentOf(line: string): string {
  const quote = quotePrefix(line);
  if (quote.depth === 0) return line;
  const after = line.charCodeAt(quote.end);
  const start = after === 32 || after === 9 ? quote.end + 1 : quote.end;
  return line.slice(start);
}

function leadingIndent(text: string): number {
  let n = 0;
  while (n < text.length) {
    const c = text.charCodeAt(n);
    if (c !== 32 && c !== 9) break;
    n++;
  }
  return n;
}

/** Column width of the leading whitespace, expanding tabs to four-column stops. */
function indentColumns(text: string, chars: number): number {
  let column = 0;
  for (let i = 0; i < chars; i++) {
    column = text.charCodeAt(i) === 9 ? column + (4 - (column % 4)) : column + 1;
  }
  return column;
}

/** Whether a line is blank: whitespace only, or nothing at all. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * A line's content, seen past the block quote markers it is wrapped in.
 *
 * A protected region inside a block quote is still a protected region: the fence
 * in a quoted line is a fence and its body is code (SAFE-01), and the same holds
 * for front matter's siblings - display math and an HTML block. The markers are
 * part of the region and not one byte of them moves; knowing where the content
 * begins only decides which block the line starts.
 *
 * This is the one reading of a line head. The region scanner decides indented code
 * by `columns`, the list scanner measures an item from `body`, and the table
 * scanner finds its cells past `at`; none of them peels the chain again.
 */
export interface LineContent {
  /** Offset of the content, past the marker chain and the one space after it. */
  readonly at: number;
  /** Offset of the content's first non-whitespace character. */
  readonly body: number;
  /** Column width of the whitespace before it, tabs to four-column stops. */
  readonly columns: number;
  /** How many block quote markers the line carries. */
  readonly depth: number;
}

export function lineContentOf(text: string): LineContent {
  const quote = quotePrefix(text);
  // BLK-09 owns one space after the last marker; the whitespace after that is the
  // content's own indentation, which is what makes an indented code block inside a
  // quote code rather than a paragraph. With no marker there is no separator, and
  // the leading whitespace is the line's own indentation.
  const after = text.charCodeAt(quote.end);
  const separator = quote.depth > 0 && (after === 32 || after === 9) ? 1 : 0;
  const at = quote.end + separator;
  const inner = text.slice(at);
  const width = leadingIndent(inner);
  return { at, body: at + width, columns: indentColumns(inner, width), depth: quote.depth };
}

const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)/;
const HEADING_MARKER = /^[ \t]*#{1,6}(?=[ \t]|$)/;

/**
 * Whether a line opens a block of its own: a list marker or a heading hash at its
 * head, past whatever quote chain it carries.
 *
 * TBL-01 needs this because a table row is a *continuation* line - the same
 * container as the row above it, with nothing but whitespace between the chain
 * and the cells. `- | --- | --- |` under `| a | b |` opens a list item, so the two
 * are two blocks and not one table, however table-shaped the second line looks.
 */
export function opensBlock(text: string): boolean {
  return LIST_MARKER.test(text) || HEADING_MARKER.test(text);
}

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
    // SAFE-03. A run of prose is not a block: the paragraph it sits in swallows it,
    // so the two are one block and no blank line may separate them. A blank inside a
    // paragraph rewrites it as two, and inside a quote or a list item it splits the
    // container itself - the change GRT-01 refuses for a lazy continuation.
    if (atom !== undefined && atom.kind === 'prose') {
      const previous = blocks[blocks.length - 1];
      const joins =
        previous !== undefined && previous.end === i && extendsBlock(previous.kind, 'paragraph');
      const kind = joins ? previous.kind : classifyContent(text);
      const start = joins ? previous.start : i;
      const blanksBefore = joins ? previous.blanksBefore : blanks;
      if (joins) blocks.pop();
      let j = atom.end;
      for (;;) {
        const next = starts.get(j);
        if (next !== undefined) {
          if (next.kind !== 'prose') break;
          j = next.end;
          continue;
        }
        const candidate = texts[j];
        if (
          candidate === undefined ||
          candidate.trim().length === 0 ||
          !extendsBlock(kind, classifyContent(candidate))
        ) {
          break;
        }
        j++;
      }
      blocks.push({ kind, start, end: j, blanksBefore });
      i = j;
      blanks = 0;
      continue;
    }
    if (atom !== undefined && atom.kind !== 'prose') {
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
