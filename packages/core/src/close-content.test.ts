/**
 * The content tail: TBL-01, then BLK-12, then trailing whitespace.
 *
 * TBL-01 is the first pass here that reports a line and BLK-12 is the only rule
 * that removes lines, so their order is the contract: run the other way round, a
 * notice names the line the removals left behind rather than the line the author
 * wrote. The stage had no seam, so that contract could only be exercised through a
 * whole document.
 *
 * Spec references: TBL-01, BLK-12.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { closeContent, lineProvenance, type LineMap } from './format.ts';
import { resolveOptions } from './options.ts';
import { splitSourceLines } from './scan.ts';

/** The identity map: every rebuilt line came from the input line of the same index. */
function identity(text: string): LineMap {
  const lines = splitSourceLines(text);
  return lineProvenance(lines, lines.map((_, index) => index));
}

const OVER_CAP = '| head | b |\n| --- | --- |\n| 1 | 2 |\n';

describe('TBL-01/BLK-12 the content tail', () => {
  test('a table notice names the input line the author wrote', () => {
    const options = resolveOptions({ table: { maxWidth: 8 } });
    const out = closeContent(OVER_CAP, options, identity(OVER_CAP));
    assert.deepEqual(out.diagnostics.map((d) => [d.ruleId, d.line]), [['TBL-01', 0]]);
  });

  test('BLK-12 trims the fence edges, and the notice still names line 0', () => {
    const source = OVER_CAP + '\n```\n\ncode\n\n```\n';
    const options = resolveOptions({ table: { maxWidth: 8 } });
    const out = closeContent(source, options, identity(source));
    assert.deepEqual(out.diagnostics.map((d) => [d.ruleId, d.line]), [['TBL-01', 0]]);
    assert.ok(out.text.includes('```\ncode\n```'), 'fence edges not trimmed: ' + JSON.stringify(out.text));
  });

  test('with the rule off the fence body keeps every blank line', () => {
    const source = '```\n\ncode\n\n```\n';
    const options = resolveOptions({ codeBlock: { trimBlankLines: false } });
    const out = closeContent(source, options, identity(source));
    assert.ok(out.text.includes('\n\ncode\n\n'), 'body changed with the rule off: ' + JSON.stringify(out.text));
  });
});
