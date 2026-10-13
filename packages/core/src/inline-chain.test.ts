/**
 * The inline chain: six passes whose order is the contract.
 *
 * Each pass has its own test; the thing that actually broke in this repository was
 * the order they run in, which lived in comments inside format() and could only be
 * exercised through a whole document. Extracting the chain gives it a seam, and
 * these are the two properties the order exists to produce.
 *
 * Spec references: TYPO-01, TYPO-05, TYPO-06, TYPO-07, TYPO-08, TYPO-11, TYPO-12.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteInline } from './format.ts';
import { resolveOptions } from './options.ts';
import { protectedMask } from './scan.ts';

const options = resolveOptions();
const run = (text: string): string => rewriteInline(text, options, protectedMask(text)).text;

describe('TYPO-12/TYPO-05 the inline chain settles', () => {
  const samples = [
    '中文abc中文',
    '中文, 中文',
    '中文（abc）中文',
    '1,000 与 中文',
    '中文"引用"中文',
    '１２３，中文',
    '中文 —— abc',
  ];

  for (const sample of samples) {
    test('a second run changes nothing: ' + JSON.stringify(sample), () => {
      const once = run(sample);
      assert.equal(run(once), once);
    });
  }
});

describe('SAFE-01 the inline chain respects the mask', () => {
  test('a protected span keeps its bytes while its neighbours are spaced', () => {
    const source = '中文\`a,b\`中文';
    const out = run(source);
    assert.ok(out.includes('\`a,b\`'), 'the code span was rewritten: ' + out);
    assert.ok(out.includes('中文 '), 'spacing did not reach the plain run: ' + out);
  });
});
