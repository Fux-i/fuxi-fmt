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
export function assignParents(items: readonly ListItem[]): number[] {
  const parents: number[] = [];
  const open: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;

    while (open.length > 0) {
      const top = items[open[open.length - 1] ?? 0];
      if (top === undefined || top.contentColumn <= item.indent) break;
      open.pop();
    }

    parents.push(open.length > 0 ? (open[open.length - 1] ?? -1) : -1);
    open.push(i);
  }

  return parents;
}
