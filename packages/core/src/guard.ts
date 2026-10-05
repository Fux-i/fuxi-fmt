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

import { classifyContent, quoteContentOf } from './blocks.ts';
import type { MessageArgs, MessageId } from './messages.ts';
import { scanRegions, type Region } from './scan.ts';

export interface Violation {
  readonly ruleId: string;
  /** The catalogue entry (CFG-08), so the sentence renders in any language. */
  readonly messageId: MessageId;
  readonly args: MessageArgs;
  /**
   * 0-based line in the input when the violation can be pinned to one. The
   * guard's first job is to say *what* diverged; this says where. `undefined` is
   * the honest answer for a complaint that is a global count with no position.
   */
  readonly line: number | undefined;
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

/** 0-based line of a character offset. */
function lineOfOffset(text: string, offset: number): number {
  let line = 0;
  const limit = Math.max(0, Math.min(offset, text.length));
  for (let i = 0; i < limit; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

interface Anchor {
  readonly text: string;
  /** 0-based line in the document this line came from. */
  readonly line: number;
}

/**
 * The non-blank lines, each still knowing the line it was on.
 *
 * Blankness is decided on the content, so a bare `>` counts as the blank line it
 * renders as rather than as a line of text. Without that, no rule could add or
 * remove a blank line inside a block quote: the guard would read the `>` line as a
 * new line and refuse the document for it (section 7, item 0).
 */
function nonBlankLines(text: string): Anchor[] {
  const out: Anchor[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (quoteContentOf(line).trim().length > 0) out.push({ text: line, line: i });
  }
  return out;
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
    // The count is global, but the divergence is local: walk the regions in
    // order and stop at the first one with no counterpart, so the author is sent
    // to the region that changed rather than to the top of the file.
    const common = Math.min(beforeRegions.length, afterRegions.length);
    let first = 0;
    while (first < common) {
      const a = beforeRegions[first];
      const b = afterRegions[first];
      if (a === undefined || b === undefined || a.kind !== b.kind) break;
      first++;
    }
    const anchor = beforeRegions[first > 0 ? first - 1 : 0];
    violations.push({
      ruleId: 'GRT-01',
      messageId: 'grt.regionCount',
      args: [beforeRegions.length, afterRegions.length],
      line: anchor === undefined ? undefined : lineOfOffset(before, anchor.start),
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
          messageId: 'safe.regionChanged',
          args: [a.kind, JSON.stringify(signatureA), JSON.stringify(signatureB)],
          line: lineOfOffset(before, a.start),
        });
      }
    }
  }

  const beforeLines = nonBlankLines(before);
  const afterLines = nonBlankLines(after);

  if (beforeLines.length !== afterLines.length) {
    // Same reasoning as the regions: report where the two documents stop
    // agreeing. The old code said "line i + 1" against the non-blank-filtered
    // array, which is not a line in the file at all.
    const common = Math.min(beforeLines.length, afterLines.length);
    let first = 0;
    while (first < common) {
      const a = beforeLines[first];
      const b = afterLines[first];
      if (a === undefined || b === undefined) break;
      if (classifyContent(a.text) !== classifyContent(b.text)) break;
      first++;
    }
    // The last line the two documents still agreed on. When a line was lost,
    // that is the line that went missing - which is the one to go and look at.
    const anchor = beforeLines[first > 0 ? first - 1 : 0];
    violations.push({
      ruleId: 'GRT-01',
      messageId: 'grt.nonBlankCount',
      args: [beforeLines.length, afterLines.length],
      line: anchor?.line,
    });
    return violations;
  }

  for (let i = 0; i < beforeLines.length; i++) {
    // Compared as content rather than as raw lines: every quoted line is a
    // 'blockquote' to the classifier, so a change inside a quote - a nested list
    // flattened into siblings, a marker eaten - used to be invisible here. It is
    // the same comparison as before for a line that is not in a quote.
    const a = quoteContentOf(beforeLines[i]?.text ?? '');
    const b = quoteContentOf(afterLines[i]?.text ?? '');
    const kindA = classifyContent(a);
    const kindB = classifyContent(b);
    if (kindA === kindB) continue;
    if (kindA === 'paragraph' && kindB === 'heading' && isHeadingPromotion(a, b)) continue;
    violations.push({
      ruleId: 'GRT-01',
      messageId: 'grt.blockKindChanged',
      args: [kindA, kindB],
      line: beforeLines[i]?.line,
    });
  }

  return violations;
}
