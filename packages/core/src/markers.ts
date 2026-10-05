/**
 * Marker spacing rules, applied per line before the document is re-segmented.
 *
 * Spec references: BLK-04 (list markers), BLK-05 (heading markers),
 * BLK-09 (blockquote markers).
 */

import { classifyContent } from './blocks.ts';
import type { ThematicBreak, UnorderedMarker } from './options.ts';

const UNORDERED = /^(\s*)([-*+])([ \t]+)([\s\S]*)$/;
const HEADING = /^(\s{0,3})(#{1,6})(?!#)([ \t]*)([\s\S]*)$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)([\s\S]*)$/;
const TASK = /^\[([ xX])\]([ \t]+)([\s\S]*)$/;
// BLK-09: one marker, at most one space after it, then the content. The old
// pattern swallowed every space after every marker, which is why the content's
// own indentation could not survive.
const QUOTE = /^(\s*)((?:>[ \t]?)+)([\s\S]*)$/;

/**
 * BLK-07. Thematic breaks and emphasis are excluded by asking the block
 * classifier first: '* * *' is a break and '*emphasis*' is not a list at all.
 */
export function normalizeUnorderedMarker(text: string, marker: UnorderedMarker): string {
  if (marker === 'preserve') return text;
  if (classifyContent(text) !== 'list') return text;
  const match = UNORDERED.exec(text);
  if (match === null) return text;
  const want = marker === 'dashes' ? '-' : '*';
  return (match[1] ?? '') + want + (match[3] ?? ' ') + (match[4] ?? '');
}

const BREAK_CHAR: Readonly<Record<Exclude<ThematicBreak, 'preserve'>, string>> = {
  dashes: '-',
  asterisks: '*',
  underscores: '_',
};

/**
 * BLK-13. A thematic break is exactly three of the chosen character.
 *
 * `-----`, `* * *` and `___` are the same node as `---`, so the canonical form is
 * the shortest one and the indent is the author's. Whether the rewrite is *safe*
 * is the caller's decision: it depends on the lines around the break, and only
 * the caller can see them.
 */
export function normalizeThematicBreak(text: string, target: ThematicBreak): string {
  if (target === 'preserve') return text;
  if (classifyContent(text) !== 'break') return text;
  const indent = /^ {0,3}/.exec(text)?.[0] ?? '';
  return indent + BREAK_CHAR[target].repeat(3);
}

export function normalizeMarkers(text: string): string {
  const heading = HEADING.exec(text);
  if (heading !== null) {
    const indent = heading[1] ?? '';
    const hashes = heading[2] ?? '';
    const spaces = heading[3] ?? '';
    const rest = heading[4] ?? '';
    if (spaces.length === 1 || rest.length === 0) return text;
    // A hash run followed by a digit is an issue reference, not a heading.
    if (spaces.length === 0 && /^\d/.test(rest)) return text;
    return indent + hashes + ' ' + rest;
  }

  const list = LIST.exec(text);
  if (list !== null) {
    const indent = list[1] ?? '';
    const marker = list[2] ?? '';
    let rest = list[4] ?? '';
    const task = TASK.exec(rest);
    if (task !== null) rest = '[' + (task[1] ?? ' ') + '] ' + (task[3] ?? '');
    return rest.length === 0 ? indent + marker : indent + marker + ' ' + rest;
  }

  const quote = QUOTE.exec(text);
  if (quote !== null) {
    const indent = quote[1] ?? '';
    const markers = quote[2] ?? '';
    const rest = quote[3] ?? '';
    // BLK-09 is one space between the marker chain and its content, and it is
    // only that space. Everything after it is the content's own indentation, and
    // that indentation is what makes a quoted list nested rather than flat and a
    // quoted line an indented code block. Collapsing it - which is what this
    // rule used to do - turned '> - a / >   - b' into two sibling items, and the
    // guard could not see it, because every quoted line is the same block kind.
    // Adjacent markers ('>>') stay adjacent; only whitespace between markers
    // means the author wrote the spaced form ('> >').
    if (rest.length === 0) return indent + markers.trimEnd();
    return indent + markers + (/[ \t]$/.test(markers) ? '' : ' ') + rest;
  }

  return text;
}
