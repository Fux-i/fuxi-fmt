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
