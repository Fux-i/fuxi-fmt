/**
 * Marker spacing rules, applied per line before the document is re-segmented.
 *
 * Spec references: BLK-04 (list markers), BLK-05 (heading markers),
 * BLK-09 (blockquote markers).
 */

import { classifyContent } from './blocks.ts';
import type { UnorderedMarker } from './options.ts';

const UNORDERED = /^(\s*)([-*+])([ \t]+)([\s\S]*)$/;
const HEADING = /^(\s{0,3})(#{1,6})(?!#)([ \t]*)([\s\S]*)$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)([\s\S]*)$/;
const TASK = /^\[([ xX])\]([ \t]+)([\s\S]*)$/;
const QUOTE = /^(\s*)((?:>+[ \t]*)+)([\s\S]*)$/;

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
    const count = (markers.match(/>/g) ?? []).length;
    if (count === 1) return indent + '> ' + rest;
    // Adjacent markers ('>>') stay adjacent; only whitespace *between* markers
    // means the author wrote the spaced form ('> >'). Trailing whitespace after
    // the last marker is the content gap, not a separator, and treating it as
    // one made this rule non-idempotent: '>> nested' became '> > nested'.
    const adjacent = /^>+[ \t]*$/.test(markers);
    return indent + (adjacent ? '>'.repeat(count) + ' ' : '> '.repeat(count)) + rest;
  }

  return text;
}
