import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * The README claims four guarantees, the fourth being totality: never throws,
 * never corrupts, worst case reproduces the input unchanged. Every other test
 * feeds the formatter documents, which is to say input a human might write.
 * This feeds it input a human might write *by accident* - the half-finished
 * fence, the unmatched bracket, the stray delimiter.
 *
 * A formatter that crashes on a malformed document is worse than one that
 * declines to format it, because a crash loses the user's buffer.
 */

const HOSTILE = [
  '',
  '\n',
  '\r\n\r\n',
  '   ',
  '\t',
  '\uFEFF',
  '\u0000',
  '\u3000',
  '```',
  '```js',
  '~~~',
  '~~~js\n',
  '````\n```\n',
  '---',
  '---\n---',
  '---\na: 1',
  '---\n',
  '>',
  '>>',
  '>>>>>>>>>>>>',
  '-',
  '1.',
  '- [',
  '* * * *',
  '| | |',
  '||',
  '|<',
  '<div>',
  '<!--',
  '<!-- -->',
  '<Badge',
  '{{',
  '[[',
  '$',
  '$$$$',
  '`` ` ` ` ``',
  '\\`',
  '\\',
  '#'.repeat(200),
  '-'.repeat(200),
  '`'.repeat(200),
  'a'.repeat(20000),
  Array.from({ length: 60 }, (_, i) => ' '.repeat(i) + '- x').join('\n'),
  '中文abc\n'.repeat(500),
];

describe('totality: the formatter never throws and never corrupts', () => {
  for (const [index, source] of HOSTILE.entries()) {
    test('hostile input ' + String(index + 1) + ' (' + JSON.stringify(source.slice(0, 24)) + ')', () => {
      let result;
      try {
        result = format(source);
      } catch (error) {
        assert.fail('format threw on ' + JSON.stringify(source.slice(0, 40)) + ': ' + String(error));
      }

      // If the guard withheld a result, the input must come back untouched.
      if (result.diagnostics.length > 0) {
        assert.equal(result.output, source, 'guard withheld a result but the output changed');
        return;
      }

      // Otherwise the result must be stable.
      const again = format(result.output);
      assert.deepEqual(again.diagnostics, [], 'the second pass was withheld');
      assert.equal(again.output, result.output, 'formatting did not settle in one pass');
    });
  }
});
