/**
 * SAFE-01: a region is a run of bytes, not a line kind.
 *
 * An HTML comment and an inline span can both contain a line ending, and every
 * structural pass here decides by line. The scanner knew the region all along;
 * the passes did not, so the blank-line policy split a comment at its own first
 * newline and a code span wrapped across lines was rewritten. Both documents are
 * valid, and both came back refused with an opaque SAFE-01 or GRT-01.
 *
 * Spec references: SAFE-01, SAFE-04, BLK-01, GRT-01.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** Backticks, without writing one in the source. */
const TICK = String.fromCharCode(96);

describe('SAFE-01 a region that spans lines is left byte for byte', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['an HTML comment', '<!--\n- list\n-->\n'],
    ['an HTML comment shaped like a heading', '<!--\n# heading\n-->\n'],
    ['an HTML comment shaped like a table', '<!--\n| --- | --- |\n-->\n'],
    ['a comment wrapped across lines after prose', 'text <!--\n- list\n-->\n'],
    ['a code span wrapped across lines', TICK + 'a\n# heading\nb' + TICK + '\n'],
    ['a code span wrapped across a list shape', TICK + 'a\n- list\nb' + TICK + '\n'],
  ];
  for (const [name, input] of cases) {
    test(name + ' is returned untouched, with no diagnostic', () => {
      const result = format(input);
      assert.deepEqual(result.diagnostics, []);
      assert.equal(result.output, input);
    });
  }

  test('a multi-line comment does not stop the prose after it from formatting', () => {
    const input = '<!--\n- list\n-->\n\n中文abc\n';
    const result = format(input);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, '<!--\n- list\n-->\n\n中文 abc\n');
  });
});
