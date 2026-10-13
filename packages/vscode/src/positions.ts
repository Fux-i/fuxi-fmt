/** Offset to position conversion. Kept separate so it can be tested in plain Node. */

import { lineIndexOf, splitSourceLines } from '../../core/src/index.ts';

export interface Position {
  readonly line: number;
  readonly character: number;
}

export function offsetToPosition(text: string, offset: number): Position {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const lines = splitSourceLines(text);
  const line = lineIndexOf(lines, clamped);
  return { line, character: clamped - (lines[line]?.start ?? 0) };
}
