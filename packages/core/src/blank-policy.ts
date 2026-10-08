/**
 * BLK-01, BLK-02, BLK-03 - where blank lines go.
 *
 * A block quote is a prefix and not a wall (BLK-14), so the policy is applied one
 * level at a time: the lines inside a quote are a document of their own, and a
 * blank line there is written with that level's marker chain. That is what makes
 * \`> - a\` and \`> - b\` one list while \`> - a\`, an empty line and \`> - b\` are
 * two quotes holding one item each - and no policy may merge those two, because
 * the empty line is the quote boundary and a \`>\` line is content.
 *
 * Two rules follow, and both are about not doing more than asked:
 *
 * - **The author's blank lines are re-emitted verbatim** whenever the count does
 *   not change. Only the number is the policy's business; which chain a blank line
 *   carries is structure, and \`>\` and \`> >\` mean different documents.
 * - **A blank is only added or removed at the level that owns it.** A blank whose
 *   chain is shorter than the two blocks it separates is a boundary between
 *   containers, so the list rules - which may remove a blank - leave it alone.
 */

import { quotePrefix, segment, type AtomicRange, type Block } from './blocks.ts';
import { scanListItems, type ListItem } from './list-scan.ts';
import type { FormatOptions } from './options.ts';

/** 0-based line index in the input, or -1 for a blank this policy invented. */
export type LineOrigin = number;

export interface BlankPolicyContext {
  readonly options: FormatOptions;
  /** Whether each input line is protected (SAFE-01, CFG-03), by input line index. */
  readonly protectedLine: readonly boolean[];
  /** Input lines of items in a list holding a protected block (DET-12). */
  readonly excludedItemLines: ReadonlySet<number>;
  /** Atomic ranges over input line indices: protected regions, and tables. */
  readonly ranges: readonly AtomicRange[];
}

export interface AssembledDocument {
  readonly lines: string[];
  readonly from: LineOrigin[];
}

/** A line as one level reads it: peeled text, plus what was peeled to get here. */
interface InputLine {
  readonly text: string;
  readonly from: LineOrigin;
  /** Every chain peeled on the way down, to put back in front when emitting. */
  readonly chain: string;
}

/** How many blank lines the policy wants before a block. */
function blankCount(existing: number, options: FormatOptions): number {
  const { aroundBlocks, maxConsecutive } = options.blankLines;
  const cap = maxConsecutive === null ? Number.POSITIVE_INFINITY : Math.max(1, maxConsecutive);
  if (aroundBlocks === 'exact') return Math.min(1, cap);
  return Math.min(Math.max(1, existing), cap);
}

/** One quote marker at the head of a line, with any whitespace in front of it. */
function peelMarker(text: string): { readonly marker: string; readonly rest: string } {
  const quote = quotePrefix(text);
  if (quote.depth === 0) return { marker: '', rest: text };
  const marker = /^[ \t]*>/.exec(text)?.[0] ?? '';
  return { marker, rest: text.slice(marker.length) };
}

/**
 * The document, with every blank line the policy wants and without the ones it
 * does not.
 */
export function applyBlankPolicy(
  lines: readonly string[],
  ctx: BlankPolicyContext,
): AssembledDocument {
  const top: InputLine[] = lines.map((text, index) => ({ text, from: index, chain: '' }));
  return assemble(top, ctx, true);
}

function assemble(
  level: readonly InputLine[],
  ctx: BlankPolicyContext,
  top: boolean,
): AssembledDocument {
  const texts = level.map((line) => line.text);
  const blocks = mergeQuoteRuns(texts, segment(texts, levelRanges(level, ctx)));
  const isProtected = (index: number): boolean => {
    const line = level[index];
    return line === undefined || line.from < 0 || ctx.protectedLine[line.from] === true;
  };
  const isExcluded = (index: number): boolean => {
    const line = level[index];
    return line !== undefined && line.from >= 0 && ctx.excludedItemLines.has(line.from);
  };

  // BLK-03 reads list identity at this level: an item quoted *here* is not an item
  // here at all, it is a quote block, and its own level decides about its items.
  const itemAt = new Map<number, ListItem>();
  for (const item of scanListItems(texts)) {
    if (item.prefix === '' && !isProtected(item.line)) itemAt.set(item.line, item);
  }
  const markOf = (block: Block): string | null => {
    for (let j = block.start; j < block.end; j++) {
      const item = itemAt.get(j);
      if (item !== undefined) return item.marker;
    }
    return null;
  };

  const listBlanks = ctx.options.blankLines.insideLists;
  const lines: string[] = [];
  const from: LineOrigin[] = [];
  const emit = (text: string, origin: LineOrigin): void => {
    lines.push(text);
    from.push(origin);
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === undefined) continue;
    if (i > 0) {
      const previous = blocks[i - 1];
      if (previous === undefined) continue;
      const untouched = isExcluded(previous.end - 1) || isExcluded(block.start);
      let count = untouched ? block.blanksBefore : blankCount(block.blanksBefore, ctx.options);
      const before = markOf(previous);
      const after = markOf(block);
      if (!untouched && listBlanks !== 'preserve' && before !== null && before === after) {
        count = listBlanks === 'remove' ? 0 : 1;
      }
      // The author's own blank lines, in order, and the chain an invented one takes:
      // the level's own, which is the last chain peeled on the way in.
      const authored: InputLine[] = [];
      for (let j = previous.end; j < block.start; j++) {
        const line = level[j];
        if (line !== undefined) authored.push(line);
      }
      const chain = level[previous.end - 1]?.chain ?? level[block.start]?.chain ?? '';
      for (let k = 0; k < count; k++) {
        const line = authored[k];
        if (line === undefined) emit(chain, -1);
        else emit(line.chain + line.text, line.from);
      }
    }

    if (isQuoteRun(texts, block)) {
      const inner: InputLine[] = [];
      for (let j = block.start; j < block.end; j++) {
        const line = level[j];
        if (line === undefined) continue;
        const peeled = peelMarker(line.text);
        inner.push({ text: peeled.rest, from: line.from, chain: line.chain + peeled.marker });
      }
      const child = assemble(inner, ctx, false);
      for (let k = 0; k < child.lines.length; k++) {
        emit(child.lines[k] ?? '', child.from[k] ?? -1);
      }
      continue;
    }

    for (let j = block.start; j < block.end; j++) {
      const line = level[j];
      if (line === undefined) continue;
      // BLK-03 is opt-in: a blank line between items flips a tight list to loose, so
      // it never happens unless asked for. The j > block.start guard is what keeps
      // this idempotent - on a second pass each item is already its own block.
      if (listBlanks === 'one' && j > block.start && itemAt.has(j) && !isExcluded(j)) {
        emit(line.chain, -1);
      }
      emit(line.chain + line.text, line.from);
    }
  }

  // BLK-14: a quote's own first and last blank lines belong to it, and whether they
  // survive is a setting rather than an accident of the loop above, which only ever
  // emits blanks *between* blocks. At the top level the file's own edges are BLK-11's
  // business and are dropped either way.
  const preserveEdges = !top && ctx.options.blankLines.insideBlockquotes === 'preserve';
  if (!preserveEdges) return { lines, from };

  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const head: InputLine[] = [];
  for (let j = 0; j < (first?.start ?? level.length); j++) {
    const line = level[j];
    if (line !== undefined) head.push(line);
  }
  const tail: InputLine[] = [];
  for (let j = last?.end ?? 0; j < level.length; j++) {
    const line = level[j];
    if (line !== undefined) tail.push(line);
  }
  return {
    lines: [...head.map((line) => line.chain + line.text), ...lines, ...tail.map((line) => line.chain + line.text)],
    from: [...head.map((line) => line.from), ...from, ...tail.map((line) => line.from)],
  };
}

/**
 * Join blocks that are two halves of one quote run.
 *
 * Segmentation splits a quote at anything it treats as an atomic block - a quoted
 * fence is the common case - so the two halves arrive here as separate blocks with
 * no blank line between them. They are one run, and the gap inside it belongs to
 * the level *inside* the quote: treating it as a gap out here is how a bare empty
 * line gets inserted between two quoted blocks, which ends the quote instead of
 * separating anything.
 */
function mergeQuoteRuns(texts: readonly string[], blocks: readonly Block[]): Block[] {
  const runs: Block[] = [];
  for (const block of blocks) {
    const previous = runs[runs.length - 1];
    if (
      previous !== undefined &&
      block.blanksBefore === 0 &&
      quotePrefix(texts[previous.end - 1] ?? '').depth > 0 &&
      quotePrefix(texts[block.start] ?? '').depth > 0
    ) {
      runs[runs.length - 1] = { ...previous, end: block.end };
      continue;
    }
    runs.push(block);
  }
  return runs;
}

/** Whether every line of the block carries a quote marker at this level. */
function isQuoteRun(texts: readonly string[], block: Block): boolean {
  for (let j = block.start; j < block.end; j++) {
    if (quotePrefix(texts[j] ?? '').depth === 0) return false;
  }
  return true;
}

/**
 * The atomic ranges as this level sees them.
 *
 * A quoted fence is protected at every level it is peeled through, so the runs of
 * protected lines are ranges of their own; the global ranges are carried down when
 * the whole of one lies inside this level, which is what keeps a quoted table a
 * table all the way in.
 */
function levelRanges(level: readonly InputLine[], ctx: BlankPolicyContext): AtomicRange[] {
  const out: AtomicRange[] = [];
  let run = -1;
  for (let i = 0; i <= level.length; i++) {
    const line = level[i];
    const here = line !== undefined && line.from >= 0 && ctx.protectedLine[line.from] === true;
    if (here && run < 0) run = i;
    else if (!here && run >= 0) {
      out.push({ start: run, end: i, kind: 'code' });
      run = -1;
    }
  }
  const first = level[0]?.from ?? -1;
  const last = level[level.length - 1]?.from ?? -1;
  if (first >= 0) {
    for (const range of ctx.ranges) {
      if (range.start < first || range.end > last + 1) continue;
      out.push({ start: range.start - first, end: range.end - first, kind: range.kind });
    }
  }
  return out;
}
