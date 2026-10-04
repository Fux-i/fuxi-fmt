/**
 * Detection: what the formatter had to guess.
 *
 * Every rule here reports a place where the parse was ambiguous, not a place
 * where the prose is bad (that is NG-12's non-goal). A block that never
 * terminated means the rest of the document was read as part of it, so the
 * document is refused and the author is told; a suspicion that terminated is a
 * warning and the document still formats.
 *
 * Spec references: DET-01, DET-03, CFG-04, GRT-04.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** Backticks, without writing one in the source and confusing every reader. */
const TICK = String.fromCharCode(96);
const FENCE = TICK + TICK + TICK;

describe('DET-01 an unterminated code fence refuses the document', () => {
  test('everything after the fence is code, so nothing is formatted', () => {
    const input = FENCE + 'js\nconst a = 1;\n\n# 标题, 后面\n';
    const result = format(input);
    assert.equal(result.output, input, 'a refused document comes back untouched');
    assert.equal(result.changed, false);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-01');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('the line is the fence, wherever it is', () => {
    const result = format('intro\n\n' + FENCE + '\nnever closed\n');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('a closed fence is not a detection', () => {
    assert.deepEqual(format(FENCE + '\ncode\n' + FENCE + '\n').diagnostics, []);
  });

  test('a tilde fence is a fence, and a longer opener does not pair with a shorter closer', () => {
    assert.equal(format('~~~\ncode\n').diagnostics[0]?.ruleId, 'DET-01');
    const four = TICK + TICK + TICK + TICK;
    assert.equal(format(four + 'js\ncode\n' + FENCE + '\n').diagnostics[0]?.ruleId, 'DET-01');
  });

  test('a refused document is byte-identical, line endings included', () => {
    const input = FENCE + 'js\r\ncode\r\n';
    assert.equal(format(input).output, input);
  });
});

describe('DET-03 an unterminated HTML comment refuses the document', () => {
  test('nothing closes it, so the rest of the file is a comment', () => {
    const input = 'intro\n\n<!-- open\n\n中文,后面\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-03');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('a closed comment is not a detection', () => {
    assert.deepEqual(format('<!-- 全角，标点 -->\n').diagnostics, []);
  });

  test('a comment start inside a code fence is code, not a comment', () => {
    const input = FENCE + '\n<!-- not a comment\n' + FENCE + '\n';
    assert.deepEqual(format(input).diagnostics, []);
  });
});
