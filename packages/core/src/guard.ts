/**
 * The semantic-preservation guard (GRT-01).
 *
 * A formatter that silently changes what a document means is worse than no
 * formatter at all, so every result is checked before it is handed back. Two
 * properties are verified:
 *
 *  1. The protected regions of the output are the protected regions of the
 *     input: same kinds, same bytes, same order. Nothing inside a code block,
 *     front matter, inline span, URL or MDX fragment can have moved. The single
 *     exception is BLK-12, which removes blank lines at the edges of a fence
 *     body, and it is granted only when that option is on.
 *  2. The sequence of non-blank line kinds is unchanged, with exactly one
 *     documented exception: a paragraph may be promoted to a heading when the
 *     only difference is an inserted space after the hash run (BLK-05).
 *
 * The guard is deliberately conservative and structural rather than byte-based:
 * renumbering lists, spacing around CJK and normalising blank lines all pass.
 */

import { classifyContent } from './blocks.ts';
import { scanRegions, type Region } from './scan.ts';

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

/**
 * A region's identity. For a fence, the delimiter run is excluded because
 * BLK-10 may legitimately change its character and length; the info string and
 * the body are compared exactly.
 */
function regionSignature(text: string, region: Region, trimBlankLines: boolean): string {
  const raw = text.slice(region.start, region.end);
  if (region.kind !== 'fencedCode') return region.kind + ':' + raw;
  let body = raw.replace(/^[ \t]*[`~]{3,}/, '').replace(/[`~]{3,}[ \t]*$/, '');
  // BLK-12, the one intentional difference to SAFE-01: blank lines at the edges of
  // a code block are not code, so they are stripped from both sides before the
  // comparison. Conditional on the option rather than unconditional, so a bug that
  // deleted fence bytes is still a violation when the rule is off.
  if (trimBlankLines) {
    body = body.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
  }
  return region.kind + ':' + body + '\u0000' + (region.info ?? '');
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0);
}

export function checkSemantics(
  before: string,
  after: string,
  trimBlankLines = false,
): Violation[] {
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
      const signatureA = regionSignature(before, a, trimBlankLines);
      const signatureB = regionSignature(after, b, trimBlankLines);
      if (signatureA !== signatureB) {
        violations.push({
          ruleId: 'SAFE-01',
          message:
            a.kind + ' region changed: ' + JSON.stringify(signatureA) + ' -> ' + JSON.stringify(signatureB),
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
