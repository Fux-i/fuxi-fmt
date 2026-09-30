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

interface Frame {
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
    if (text.trim().length === 0) {
      previousBlank = true;
      continue;
    }

    const kind = classifyContent(text);
    if (kind === 'heading' || kind === 'break' || kind === 'table') {
      stack.length = 0;
      previousBlank = false;
      continue;
    }
    // A fresh paragraph after a blank line ends the enclosing list; a paragraph
    // without a preceding blank line is a lazy continuation and does not.
    if (kind === 'paragraph' && previousBlank) stack.length = 0;
    previousBlank = false;

    const match = ORDERED.exec(text);
    if (match === null) continue;

    const indentText = match[1] ?? '';
    const indent = indentText.length;
    const value = Number(match[2] ?? '1');
    const delimiter = match[3] ?? '.';
    const gap = match[4] ?? ' ';
    const rest = match[5] ?? '';

    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) > indent) stack.pop();

    let frame = stack[stack.length - 1];
    if (frame === undefined || frame.indent < indent) {
      frame = { indent, start: value, seen: 0, lazy: false };
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
    out[i] = indentText + String(number) + mark + gap + rest;
  }

  return out;
}
