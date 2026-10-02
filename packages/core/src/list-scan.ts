/**
 * List item scanning for BLK-08.
 *
 * The stack-based reindenter failed by inferring nesting depth from how deep the
 * indentation looked, which dedented any list whose first item was already
 * indented. Nothing here infers depth: it records the marker column and the
 * content column, both of which are facts about the line.
 *
 * Callers must pass only lines that a list can occupy - not fence bodies, front
 * matter or other protected regions. That filtering belongs to the caller
 * because it depends on the document scan, not on the line.
 *
 * Known limits, deliberately: a bare marker with no content and no trailing
 * space is not recognised, and a spaced thematic break ('- - -') is
 * indistinguishable from a list item by this grammar alone. Both are recorded
 * rather than guessed at, and neither occurs in the fixture corpus.
 */

export interface ListItem {
  /** Index into the lines array. */
  readonly line: number;
  /** Width of the leading whitespace. Tabs count as one. */
  readonly indent: number;
  /** The marker as written: '-', '+', '*', or a number with '.' or ')'. */
  readonly marker: string;
  /** Column where the item's content begins. */
  readonly contentColumn: number;
  readonly ordered: boolean;
  readonly content: string;
}

const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;

export function scanListItems(lines: readonly string[]): ListItem[] {
  const items: ListItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = ITEM.exec(lines[i] ?? '');
    if (match === null) continue;
    const indent = (match[1] ?? '').length;
    const marker = match[2] ?? '';
    const gap = (match[3] ?? '').length;
    items.push({
      line: i,
      indent,
      marker,
      contentColumn: indent + marker.length + gap,
      ordered: /^\d/.test(marker),
      content: match[4] ?? '',
    });
  }
  return items;
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
  for (let j = item.line + 1; j < lines.length; j++) {
    const text = lines[j] ?? '';
    if (text.trim().length === 0 || isItemLine.has(j)) break;
    const indent = (/^\s*/.exec(text)?.[0] ?? '').length;
    if (indent < item.indent) break;
    end = j;
  }
  return end;
}

/**
 * BLK-08 step four: which lists contain a protected block?
 *
 * A list that contains one is excluded from indentation normalisation entirely,
 * and the caller reports a diagnostic (spec section 7 item 1, option b). Moving
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
  const planned = new Map<number, string>();
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

    const original = lines[item.line] ?? '';
    planned.set(item.line, ' '.repeat(target) + original.slice(item.indent));

    for (let j = item.line + 1; j < lines.length; j++) {
      const text = lines[j] ?? '';
      if (text.trim().length === 0 || isItemLine.has(j)) break;
      const indent = (/^\s*/.exec(text)?.[0] ?? '').length;
      if (indent < item.indent) break;
      planned.set(j, ' '.repeat(Math.max(0, indent + delta)) + text.slice(indent));
    }
  }

  return [...planned.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, text]) => ({ line, text }));
}
