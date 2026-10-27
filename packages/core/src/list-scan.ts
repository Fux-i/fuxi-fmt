/**
 * List item scanning for BLK-08.
 *
 * The stack-based reindenter failed by inferring nesting depth from how deep the
 * indentation looked, which dedented any list whose first item was already
 * indented. Nothing here infers depth: it records the marker column and the
 * content column, both of which are facts about the line.
 *
 * The caller must say which lines a list can occupy, and this scan takes that as
 * a parameter rather than trusting a comment: a fence body fed in here becomes a
 * list, and then the fence is reported as a list containing a protected block.
 * Two callers shipped that bug. A required parameter is the difference between a
 * contract and a hope.
 *
 * Known limits, deliberately: a bare marker with no content and no trailing
 * space is not recognised, and a spaced thematic break ('- - -') is
 * indistinguishable from a list item by this grammar alone. Both are recorded
 * rather than guessed at, and neither occurs in the fixture corpus.
 */

import { indentColumns, quotePrefix } from './blocks.ts';

export interface ListItem {
  /** Index into the lines array. */
  readonly line: number;
  /**
   * The block quote markers in front of the item, with their one space, so the
   * plan can put an item back at a new indentation *inside* its quote. Empty for
   * an item that is not quoted.
   */
  readonly prefix: string;
  /** Width of the whitespace between the prefix and the marker. Tabs count as one. */
  readonly indent: number;
  /** The marker as written: '-', '+', '*', or a number with '.' or ')'. */
  readonly marker: string;
  /** Column where the item's content begins. */
  readonly contentColumn: number;
  readonly ordered: boolean;
  readonly content: string;
}

const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;

export function scanListItems(
  lines: readonly string[],
  isProtectedLine: (index: number) => boolean,
): ListItem[] {
  const items: ListItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isProtectedLine(i)) continue;
    const text = lines[i] ?? '';
    // A quoted list is a list: the marker chain is a prefix, so the item is read
    // from inside it and its indentation is measured from there. Without this a
    // quoted item was not an item at all, and BLK-08 never touched one.
    const quote = quotePrefix(text);
    // With no marker there is no separator either: the leading whitespace is the
    // item's own indentation, and eating a column of it would shift every list.
    const afterQuote =
      quote.depth > 0 && isSpace(text.charCodeAt(quote.end)) ? quote.end + 1 : quote.end;
    const prefix = text.slice(0, afterQuote);
    const match = ITEM.exec(text.slice(afterQuote));
    if (match === null) continue;
    const indent = (match[1] ?? '').length;
    const marker = match[2] ?? '';
    const gap = (match[3] ?? '').length;
    items.push({
      line: i,
      prefix,
      indent,
      marker,
      contentColumn: indent + marker.length + gap,
      ordered: /^\d/.test(marker),
      content: match[4] ?? '',
    });
  }
  return items;
}

/** Space or tab, by character code. */
function isSpace(code: number): boolean {
  return code === 32 || code === 9;
}

/**
 * BLK-08 step two: which item is each item nested under?
 *
 * The parent is the nearest preceding item whose content column is at or before
 * this item's marker column. That is a comparison between two recorded facts,
 * not an inference - which is what the stack version got wrong when it treated
 * the first observed indent as depth zero.
 *
 * Returns -1 for an item with no parent. Those are top level, and top level
 * items keep the indentation they were written with: snapping them to column 0
 * is precisely the bug that dedented an already-indented fragment.
 */
/**
 * @param brokeOut Filled with one flag per item: true when the item closed an
 * ancestor on its way in, which is a different situation from opening the list.
 */
export function assignParents(items: readonly ListItem[], brokeOut?: boolean[]): number[] {
  const parents: number[] = [];
  const open: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;

    // Closing a *sibling* is ordinary list structure: the previous item at the same
    // indent leaves the parent stack on the way to this one. Closing something
    // shallower than this item is the item falling out of a list that cannot hold
    // it, which is the case that has an indent worth removing.
    let closedOuter = false;
    while (open.length > 0) {
      const top = items[open[open.length - 1] ?? 0];
      if (top === undefined || top.contentColumn <= item.indent) break;
      if (top.indent < item.indent) closedOuter = true;
      open.pop();
    }

    parents.push(open.length > 0 ? (open[open.length - 1] ?? -1) : -1);
    brokeOut?.push(closedOuter);
    open.push(i);
  }

  return parents;
}

/** The top-level item a given item descends from. */
function rootOf(parents: readonly number[], index: number): number {
  let at = index;
  const seen = new Set<number>();
  while (!seen.has(at)) {
    seen.add(at);
    const next = parents[at] ?? -1;
    if (next === -1) break;
    at = next;
  }
  return at;
}

/** The last line belonging to an item: its continuation run, or the item alone. */
function spanEnd(
  lines: readonly string[],
  isItemLine: ReadonlySet<number>,
  item: ListItem,
): number {
  let end = item.line;
  // The quote chain the item lives in: a line that carries less of it is outside
  // the item's container, however far it happens to be indented.
  const depth = quotePrefix(item.prefix).depth;
  for (let j = item.line + 1; j < lines.length; j++) {
    const text = lines[j] ?? '';
    // A blank line does not end an item, and neither does a nested item: the body
    // of an item continues past its own children, and a fence written at the
    // item's content column below them is still that item's. Only a line that
    // leaves the container or sits to the left of the content column ends it.
    if (text.trim().length === 0) continue;
    if (quotePrefix(text).depth < depth) break;
    // The item's body starts at its content column, so a line to the left of that
    // column ends the item. Comparing against the marker column said a fence at
    // the margin was part of the item, and the whole list was then excluded from
    // reindentation and the blank-line policy for a block it never contained.
    // The item's own quote prefix is not indentation: a quoted block inside an
    // unquoted item is indented where it is written.
    const body =
      item.prefix.length > 0 && text.startsWith(item.prefix) ? text.slice(item.prefix.length) : text;
    const indent = (/^\s*/.exec(body)?.[0] ?? '').length;
    // Columns, not characters: a tab is one character and four columns, and the
    // item ends where the line is less indented than its content, which is a
    // column comparison. Against a character content column, this can only read
    // a tab-indented line as inside, which keeps the list where it was.
    if (indentColumns(body, indent) < item.contentColumn) break;
    end = j;
  }
  return end;
}

/**
 * The lines of every list that holds a protected block (DET-12).
 *
 * The tab expansion of BLK-11 rewrites a line's leading whitespace, so expanding
 * the item above a fence and leaving the fence alone moves the fence out of its
 * container: the document then has one fence in the input and no fence in the
 * output, and the guard refuses it. A list that is already left out of BLK-08 is
 * left out of the expansion too.
 */
export function excludedListLines(
  lines: readonly string[],
  isProtectedLine: (index: number) => boolean,
): Set<number> {
  const items = scanListItems(lines, isProtectedLine);
  const brokeOut: boolean[] = [];
  const parents = assignParents(items, brokeOut);
  const protectedLines = lines.map((_, index) => isProtectedLine(index));
  const excluded = findExcludedLists(lines, items, parents, protectedLines);
  const out = new Set<number>();
  if (excluded.length === 0) return out;
  const isItemLine = new Set(items.map((item) => item.line));
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;
    if (!excluded.includes(rootOf(parents, i))) continue;
    const end = spanEnd(lines, isItemLine, item);
    for (let j = item.line; j <= end; j++) out.add(j);
  }
  return out;
}

/**
 * BLK-08 step four: which lists contain a protected block?
 *
 * A list that contains one is excluded from indentation normalisation entirely,
 * and the caller reports a diagnostic (SAFE-02 × BLK-08, reported as DET-12). Moving
 * code the author fixed at a particular indentation is what SAFE-02 exists to
 * prevent, and reindenting a list around a fence would either move the fence or
 * leave the list half normalised.
 *
 * Returns the index of each excluded list's top-level item, ascending.
 */
export function findExcludedLists(
  lines: readonly string[],
  items: readonly ListItem[],
  parents: readonly number[],
  protectedLines: readonly boolean[],
): number[] {
  const isItemLine = new Set(items.map((item) => item.line));
  const excluded = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;
    const end = spanEnd(lines, isItemLine, item);
    for (let j = item.line; j <= end; j++) {
      if (protectedLines[j] === true) {
        excluded.add(rootOf(parents, i));
        break;
      }
    }
  }

  return [...excluded].sort((a, b) => a - b);
}

export interface Reindent {
  readonly line: number;
  readonly text: string;
  /** The top-level item of the list this line belongs to. */
  readonly root: number;
}

/**
 * BLK-08 step three: which lines should be rewritten, and to what.
 *
 * A nested item's marker moves under its parent's content column, and the target
 * is computed top-down from where the parent ends up - not from where it started.
 * Using the original column looks right on one pass and is not idempotent: a
 * grandchild stays one level too deep, and a second run moves it again. The
 * parent's own delta has to be applied before its children are placed.
 *
 * An item with no parent is untouched, so a fragment keeps the offset it was
 * written at however deep the nesting inside it goes.
 *
 * Continuation lines - the prose under an item, up to the next item or blank
 * line - move by the same delta so an item keeps its body aligned. A line less
 * indented than the item it follows is not part of it and ends the run.
 *
 * Indentation is written as spaces; hard tabs are expanded by the structural
 * pass before this runs.
 */
export function planListIndent(
  lines: readonly string[],
  items: readonly ListItem[],
  parents: readonly number[],
  excluded: ReadonlySet<number> = new Set(),
  orderedMin = 0,
  unorderedMin = 0,
  brokeOut: readonly boolean[] = [],
): Reindent[] {
  const isItemLine = new Set(items.map((item) => item.line));
  const planned = new Map<number, Reindent>();
  const placed: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;

    const parentIndex = parents[i] ?? -1;
    const parent = items[parentIndex];
    // Two ways to have no parent, and they are not the same. Opening the list is a
    // fragment, and a fragment keeps the offset it was written at. Closing an
    // ancestor means the item fell out of a list it cannot belong to, and the
    // indent that made it look like a child is the indent to remove.
    const fellOut = parent === undefined && brokeOut[i] === true;
    // 'aligned' passes 0, so the parent's content column is selected; an explicit
    // width is a floor. The max is what keeps nesting: a '10. ' parent has a
    // content column of 4, and a narrower setting must not place the child
    // shallower than the parent's content.
    const minFor = item.ordered ? orderedMin : unorderedMin;
    const width = parent === undefined ? 0 : Math.max(minFor, parent.contentColumn - parent.indent);
    const target =
      parent === undefined
        ? fellOut
          ? 0
          : item.indent
        : (placed[parentIndex] ?? parent.indent) + width;
    // Pushed before the exclusion test so that placed stays aligned with the
    // item indices; a skipped item still has to occupy its slot.
    placed.push(target);
    if (excluded.has(rootOf(parents, i))) continue;

    const delta = target - item.indent;
    if (delta === 0) continue;
    const root = rootOf(parents, i);

    const original = lines[item.line] ?? '';
    planned.set(item.line, {
      line: item.line,
      text: item.prefix + ' '.repeat(target) + original.slice(item.prefix.length + item.indent),
      root,
    });

    const itemDepth = quotePrefix(item.prefix).depth;
    for (let j = item.line + 1; j < lines.length; j++) {
      const text = lines[j] ?? '';
      // A blank line does not end the item, so what follows it moves with the
      // item too. Breaking here left a continuation at its old column while the
      // item moved, and a line that was prose before the move could become an
      // indented code block after it.
      if (text.trim().length === 0) continue;
      if (isItemLine.has(j)) break;
      if (quotePrefix(text).depth < itemDepth) break;
      // Whether the line belongs to this item is decided the way spanEnd decides
      // it - in the item's own frame, against its content column. The marker
      // column is shallower, and a line between the two is the parent's: moving
      // it here dragged a parent's code block - protected bytes included - along.
      const own =
        item.prefix.length > 0 && text.startsWith(item.prefix)
          ? text.slice(item.prefix.length)
          : text;
      const ownIndent = (/^\s*/.exec(own)?.[0] ?? '').length;
      if (indentColumns(own, ownIndent) < item.contentColumn) break;
      // Continuation lines move by the same delta, inside whatever prefix each of
      // them carries, so a quoted continuation stays quoted.
      const quote = quotePrefix(text);
      const afterQuote =
        quote.depth > 0 && isSpace(text.charCodeAt(quote.end)) ? quote.end + 1 : quote.end;
      const body = text.slice(afterQuote);
      const indent = (/^\s*/.exec(body)?.[0] ?? '').length;
      planned.set(j, {
        line: j,
        text: text.slice(0, afterQuote) + ' '.repeat(Math.max(0, indent + delta)) + body.slice(indent),
        root,
      });
    }
  }

  return [...planned.values()].sort((a, b) => a.line - b.line);
}
