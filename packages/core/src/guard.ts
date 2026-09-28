/**
 * The semantic-preservation guard (GRT-01).
 *
 * A formatter that silently changes what a document means is worse than no
 * formatter at all, so every result is checked before it is handed back. Two
 * properties are verified:
 *
 *  1. The protected regions of the output are the protected regions of the
 *     input: same kinds, same bytes, same order. Nothing inside a code block,
 *     front matter, inline span, URL or MDX fragment can have moved.
 *  2. The sequence of non-blank line kinds is unchanged, with exactly one
 *     documented exception: a paragraph may be promoted to a heading when the
 *     only difference is an inserted space after the hash run (BLK-05).
 *
 * The guard is deliberately conservative and structural rather than byte-based:
 * renumbering lists, spacing around CJK and normalising blank lines all pass.
 */

import { classifyContent } from './blocks.ts';
import { scanRegions } from './scan.ts';

export interface Violation {
  readonly ruleId: string;
  readonly message: string;
}

/** A paragraph that looks like an ATX heading missing its space. */
const HEADING_MISSING_SPACE = /^( {0,3})(#{1,6})(?!#)(\S[\s\S]*)$/;

function isHeadingPromotion(before: string, after: string): boolean {
  const match = HEADING_MISSING_SPACE.exec(before);
  if (match === null) return false;
  const indent = match[1] ?? '';
  const hashes = match[2] ?? '';
  const rest = match[3] ?? '';
  return after === indent + hashes + ' ' + rest;
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0);
}

export function checkSemantics(before: string, after: string): Violation[] {
  const violations: Violation[] = [];

  const beforeRegions = scanRegions(before);
  const afterRegions = scanRegions(after);

  if (beforeRegions.length !== afterRegions.length) {
    violations.push({
      ruleId: 'GRT-01',
      message:
        'protected region count changed: ' +
        String(beforeRegions.length) +
        ' -> ' +
        String(afterRegions.length),
    });
  } else {
    for (let i = 0; i < beforeRegions.length; i++) {
      const a = beforeRegions[i];
      const b = afterRegions[i];
      if (a === undefined || b === undefined) continue;
      const textA = before.slice(a.start, a.end);
      const textB = after.slice(b.start, b.end);
      if (a.kind !== b.kind || textA !== textB) {
        violations.push({
          ruleId: 'SAFE-01',
          message:
            a.kind +
            ' region changed: ' +
            JSON.stringify(textA) +
            ' -> ' +
            JSON.stringify(textB),
        });
      }
    }
  }

  const beforeLines = nonBlankLines(before);
  const afterLines = nonBlankLines(after);

  if (beforeLines.length !== afterLines.length) {
    violations.push({
      ruleId: 'GRT-01',
      message:
        'non-blank line count changed: ' +
        String(beforeLines.length) +
        ' -> ' +
        String(afterLines.length),
    });
    return violations;
  }

  for (let i = 0; i < beforeLines.length; i++) {
    const a = beforeLines[i] ?? '';
    const b = afterLines[i] ?? '';
    const kindA = classifyContent(a);
    const kindB = classifyContent(b);
    if (kindA === kindB) continue;
    if (kindA === 'paragraph' && kindB === 'heading' && isHeadingPromotion(a, b)) continue;
    violations.push({
      ruleId: 'GRT-01',
      message:
        'block kind changed on line ' + String(i + 1) + ': ' + kindA + ' -> ' + kindB,
    });
  }

  return violations;
}
