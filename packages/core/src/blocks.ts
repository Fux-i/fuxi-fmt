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
    while (j < texts.length) {
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
