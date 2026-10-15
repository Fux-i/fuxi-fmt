/**
 * YAML front matter: the block at the top of a document that another tool reads
 * before the body (FM-01 ... FM-06).
 *
 * It is normalized by a YAML serializer rather than by the Markdown pipeline,
 * because the rules that make prose readable - CJK spacing, punctuation width,
 * the blank-line policy - edit the bytes of a *value*, and in front matter a
 * value is data. The serializer is also the thing that knows where a scalar
 * ends, which no line-level rule can say.
 *
 * This module is the only place in core that knows about YAML. The scanner says
 * where the block is; this says what it becomes, and what still counts as the
 * same document afterwards for the guard.
 *
 * Spec references: FM-01, FM-03, FM-05.
 */

import { isMap, isScalar, isSeq, parseDocument, visit, type Document } from 'yaml';
import type { TypographyOptions } from './options.ts';
import { applyTypography } from './typography.ts';

/**
 * The serializer's own choices, pinned so a formatting run changes what was
 * asked for and nothing else. Line width is the important one: the default of 80
 * folds a long scalar across lines, which would rewrite every long description
 * on every save.
 */
const PRINT = {
  lineWidth: 0,
  indent: 2,
  indentSeq: true,
  flowCollectionPadding: false,
} as const;

/** What a front matter block becomes, or why it does not become anything. */
export interface FrontMatterBlock {
  /** The block as it should be written, or null when it must be left as it is. */
  readonly text: string | null;
  /** Whether the block could not be parsed at all (FM-05). */
  readonly malformed: boolean;
}

const UNTOUCHED: FrontMatterBlock = { text: null, malformed: false };

/**
 * FM-04. Space every scalar *value* in the document, and nothing else.
 *
 * Keys are identifiers, a block scalar's indentation is its content, a scalar
 * that spans lines is prose the author wrapped, and a flow collection in front
 * matter is almost always a tag or slug list where one byte is one match. All
 * four are skipped, and a scalar is only ever handed to `applyTypography`, which
 * inserts and removes spaces - so no character in a value can change.
 */
function spaceValues(node: unknown, typography: TypographyOptions): void {
  if (isMap(node)) {
    if (node.flow === true) return;
    for (const pair of node.items) spaceValues(pair.value, typography);
    return;
  }
  if (isSeq(node)) {
    if (node.flow === true) return;
    for (const item of node.items) spaceValues(item, typography);
    return;
  }
  if (!isScalar(node)) return;
  const type = node.type;
  if (type !== 'PLAIN' && type !== 'QUOTE_DOUBLE' && type !== 'QUOTE_SINGLE') return;
  const value = node.value;
  if (typeof value !== 'string' || value.includes('\n')) return;
  node.value = applyTypography(value, typography);
}

/** FM-04 for comments: they are prose, so they get the same spacing as the body. */
function spaceComments(doc: Document, typography: TypographyOptions): void {
  const spaced = (comment: unknown): string | undefined =>
    typeof comment === 'string' ? applyTypography(comment, typography) : undefined;
  const before = spaced(doc.commentBefore);
  if (before !== undefined) doc.commentBefore = before;
  const after = spaced(doc.comment);
  if (after !== undefined) doc.comment = after;
  visit(doc, {
    Node: (_key, node) => {
      const above = spaced(node.commentBefore);
      if (above !== undefined) node.commentBefore = above;
      const inline = spaced(node.comment);
      if (inline !== undefined) node.comment = inline;
    },
  });
}

/** The lines between the markers, or null when this is not a closed YAML block. */
function innerOf(block: string): string | null {
  const lines = block.split('\n');
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (first === undefined || last === undefined || lines.length < 3) return null;
  if (first.trimEnd() !== '---') return null;
  const closer = last.trimEnd();
  if (closer !== '---' && closer !== '...') return null;
  return lines.slice(1, -1).join('\n');
}

/**
 * Normalize one block, markers included.
 *
 * Null text means "leave it as it is", and there are three honest reasons for
 * that: there is no content between the markers, the document it parses to is
 * empty (the serializer would append the `null` it makes of one), or the block is
 * already what the serializer would write.
 */
export function normalizeFrontMatter(
  block: string,
  typography: TypographyOptions | null = null,
): FrontMatterBlock {
  const inner = innerOf(block);
  if (inner === null || inner.trim().length === 0) return UNTOUCHED;
  const doc = parseDocument(inner);
  if (doc.errors.length > 0) return { text: null, malformed: true };
  if (doc.contents === null) return UNTOUCHED;
  if (typography !== null) {
    spaceValues(doc.contents, typography);
    spaceComments(doc, typography);
  }
  const printed = doc.toString(PRINT);
  const body = printed.endsWith('\n') ? printed.slice(0, -1) : printed;
  if (body === inner) return UNTOUCHED;
  const lines = block.split('\n');
  return {
    text: [lines[0] ?? '', ...body.split('\n'), lines[lines.length - 1] ?? ''].join('\n'),
    malformed: false,
  };
}

/** A parsed block: its value, and every comment in document order. */
interface Parsed {
  readonly value: unknown;
  readonly comments: readonly string[];
}

function parse(inner: string): Parsed | null {
  const doc = parseDocument(inner);
  if (doc.errors.length > 0) return null;
  const comments: string[] = [];
  const add = (comment: unknown): void => {
    if (typeof comment === 'string') comments.push(comment);
  };
  add(doc.commentBefore);
  add(doc.comment);
  visit(doc, {
    Node: (_key, node) => {
      add(node.commentBefore);
      add(node.comment);
    },
  });
  return { value: doc.toJS(), comments };
}

/**
 * A value as JSON, with the option of forgetting where the spaces were.
 *
 * `exact` is the comparison when nothing may change. Otherwise the spaces are
 * dropped, which is the whole of what FM-04 is allowed to do inside a value.
 */
function canonical(value: unknown, exact: boolean): string | undefined {
  return JSON.stringify(value, (_key, node: unknown) =>
    exact || typeof node !== 'string' ? node : node.replace(/\s+/g, ''),
  );
}

function commentText(comments: readonly string[], exact: boolean): string {
  return comments.map((comment) => (exact ? comment : comment.replace(/\s+/g, ''))).join('\u0000');
}

/**
 * Whether two front matter blocks are the same document (FM-03's guard).
 *
 * Style and whitespace may differ; the value, the keys and their order, and the
 * comments may not - except by inserted or removed spaces, which is all
 * `frontMatter.typography` does. A block that does not parse on either side falls
 * back to comparing bytes, which is what the guard did before this rule existed
 * and what an untouched malformed block needs.
 */
export function sameFrontMatter(before: string, after: string, typography: boolean): boolean {
  const innerA = innerOf(before);
  const innerB = innerOf(after);
  if (innerA === null || innerB === null) return before === after;
  const a = parse(innerA);
  const b = parse(innerB);
  if (a === null || b === null) return before === after;
  const exact = !typography;
  return (
    canonical(a.value, exact) === canonical(b.value, exact) &&
    commentText(a.comments, exact) === commentText(b.comments, exact)
  );
}
