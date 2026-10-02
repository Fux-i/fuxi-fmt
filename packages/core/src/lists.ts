/**
 * Ordered list renumbering.
 *
 * Numbers are renumbered at every nesting level, honouring a declared start on
 * the first item. In the default 'keep-all-ones' mode a list the author wrote
 * with lazy all-ones markers is detected and left alone, which keeps diffs
 * minimal for the common git-diff-friendly style and matches what Prettier and
 * dprint do; 'renumber' numbers it anyway and 'preserve' changes no number at all.
 *
 * Spec references: BLK-06.
 */

import { classifyContent } from './blocks.ts';
import type { ListOptions } from './options.ts';

const ORDERED = /^(\s*)(\d{1,9})([.)])([ \t]+)([\s\S]*)$/;

/**
 * The blockquote marker run, split off before the list grammar is applied.
 *
 * ORDERED anchors at the start of the line, so a quoted list was invisible to
 * this pass: '> 1. a' matched nothing, and a broken sequence inside a quote was
 * never renumbered. BLK-09 has already collapsed the marker spacing by the time
 * this runs, so each '>' is followed by at most one space.
 */
const QUOTE = /^(\s*(?:>+[ \t]*)+)([\s\S]*)$/;

interface Frame {
  /** The blockquote prefix this frame belongs to; '' at the top level. */
  readonly prefix: string;
  readonly indent: number;
  readonly start: number;
  seen: number;
  lazy: boolean;
}

export function renumberOrderedLists(
  texts: readonly string[],
  protectedLine: readonly boolean[],
  options: ListOptions,
): string[] {
  const out = texts.slice();
  const stack: Frame[] = [];
  let previousBlank = true;

  for (let i = 0; i < out.length; i++) {
    const text = out[i] ?? '';
    if (protectedLine[i] === true) {
      stack.length = 0;
      previousBlank = false;
      continue;
    }
    const quote = QUOTE.exec(text);
    const prefix = quote === null ? '' : (quote[1] ?? '');
    const body = quote === null ? text : (quote[2] ?? '');
    // A bare '>' is how a blockquote spells a blank line. Its text is not empty,
    // so the plain blank test would miss it and a quoted list separated by a
    // quoted paragraph would be numbered as though the paragraph were not there.
    if (body.trim().length === 0) {
      previousBlank = true;
      continue;
    }

    // Classify the content inside the quote: a heading in a blockquote is still a
    // heading, and it ends the list exactly as a bare one does.
    const kind = classifyContent(body);
    if (kind === 'heading' || kind === 'break' || kind === 'table') {
      stack.length = 0;
      previousBlank = false;
      continue;
    }
    // A fresh paragraph after a blank line ends the enclosing list; a paragraph
    // without a preceding blank line is a lazy continuation and does not.
    if (kind === 'paragraph' && previousBlank) stack.length = 0;
    previousBlank = false;

    const match = ORDERED.exec(body);
    if (match === null) continue;

    const indentText = match[1] ?? '';
    const indent = indentText.length;
    const value = Number(match[2] ?? '1');
    const delimiter = match[3] ?? '.';
    const gap = match[4] ?? ' ';
    const rest = match[5] ?? '';

    // A frame from another quote depth belongs to a different list and can never
    // supply a number: '> > 1. a' and '> 1. b' are two lists, not a sequence.
    while (stack.length > 0 && stack[stack.length - 1]?.prefix !== prefix) stack.pop();
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) > indent) stack.pop();

    let frame = stack[stack.length - 1];
    if (frame === undefined || frame.indent < indent) {
      frame = { prefix, indent, start: value, seen: 0, lazy: false };
      stack.push(frame);
    }
    frame.seen++;
    if (frame.seen === 2 && frame.start === 1 && value === 1) frame.lazy = true;

    const number =
      options.orderedStyle === 'preserve'
        ? value
        : options.orderedStyle === 'keep-all-ones' && frame.lazy
          ? 1
          : frame.start + frame.seen - 1;
    const mark = options.orderedDelimiter === 'preserve' ? delimiter : options.orderedDelimiter;
    out[i] = prefix + indentText + String(number) + mark + gap + rest;
  }

  return out;
}
