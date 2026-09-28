/**
 * File-level hygiene: byte order mark, line endings and whitespace (BLK-11).
 *
 * These run outside the formatting pipeline because they are about the file,
 * not the document. Protected regions are still honoured: a tab or a trailing
 * space inside a fence or front matter is content, not hygiene.
 */

import { isBlockRegionKind, scanRegions, splitSourceLines } from './scan.ts';

export type Eol = 'lf' | 'crlf';

export interface NormalizedInput {
  readonly text: string;
  readonly eol: Eol;
  readonly hadBom: boolean;
}

const BOM = '\uFEFF';

export function normalizeInput(source: string): NormalizedInput {
  const hadBom = source.startsWith(BOM);
  const body = hadBom ? source.slice(1) : source;
  return {
    text: body.replace(/\r\n?/g, '\n'),
    eol: body.includes('\r\n') ? 'crlf' : 'lf',
    hadBom,
  };
}

export function applyEndOfLine(text: string, eol: Eol): string {
  return eol === 'crlf' ? text.split('\n').join('\r\n') : text;
}

/** Mask of characters inside a whole-line protected region. */
function blockMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const region of scanRegions(text)) {
    if (!isBlockRegionKind(region.kind)) continue;
    for (let i = region.start; i < region.end; i++) mask[i] = 1;
  }
  return mask;
}

/**
 * Trim trailing whitespace on every unprotected line.
 *
 * A line ending in two or more spaces followed by a non-blank line is a
 * Markdown hard break, so it is left exactly as written.
 */
export function trimTrailingWhitespace(text: string): string {
  const mask = blockMask(text);
  const lines = splitSourceLines(text);
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const next = lines[i + 1];
    const newline = text.slice(line.end, next === undefined ? text.length : next.start);
    let body = line.text;
    if (!(line.end > line.start && mask[line.start] === 1)) {
      const trailing = /[ \t]+$/.exec(body);
      if (trailing !== null && trailing.index !== undefined) {
        const isHardBreak =
          trailing[0].length >= 2 && next !== undefined && next.text.trim().length > 0;
        if (!isHardBreak) body = body.slice(0, trailing.index);
      }
    }
    out += body + newline;
  }
  return out;
}
