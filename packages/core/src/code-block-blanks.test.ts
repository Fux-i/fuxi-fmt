/**
 * BLK-12: blank lines at the edges of a code block are not part of the code.
 *
 * The rule is the one intentional difference to SAFE-01 in the whole tool, so it
 * is declared in the specification and named in the guard where the guarantee is
 * checked, rather than implied by a config key.
 *
 * Spec references: BLK-12.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('BLK-12 blank lines inside a fence', () => {
  test('leading blank lines are removed', () => {
    assert.equal(out('```\n\ncode\n```\n'), '```\ncode\n```\n');
  });

  test('trailing blank lines are removed', () => {
    assert.equal(out('```\ncode\n\n```\n'), '```\ncode\n```\n');
  });

  test('both ends are removed at once, and a blank line in the middle is not', () => {
    assert.equal(out('```\n\na\n\nb\n\n```\n'), '```\na\n\nb\n```\n');
  });

  test('the reported case: a C block with a blank line before the closer', () => {
    const src = '```c\n    #include <stdio.h>\n\nint main(){}\n\n```\n';
    assert.equal(out(src), '```c\n    #include <stdio.h>\n\nint main(){}\n```\n');
  });

  test('an indented fence inside a list is trimmed too', () => {
    assert.equal(
      out('- item\n\n  ```\n\n  code\n\n  ```\n'),
      '- item\n\n  ```\n  code\n  ```\n',
    );
  });

  test('the trim is what the guard allows, so there is no diagnostic', () => {
    const result = format('```\n\ncode\n\n```\n');
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.changed, true);
  });

  test('the pass is idempotent', () => {
    const once = out('```\n\ncode\n\n```\n');
    assert.equal(out(once), once);
  });

  test('can be turned off', () => {
    const src = '```\n\ncode\n\n```\n';
    assert.equal(out(src, { codeBlock: { trimBlankLines: false } }), src);
  });

  test('an unterminated fence keeps every line it has', () => {
    // There is no closing delimiter, so there is no body edge to trim, and the
    // last line is code rather than a fence. Trimming it would delete the code.
    const src = '```\n\na\n';
    assert.equal(out(src), src);
  });

  test('a fence whose body is only blank lines loses them but keeps both delimiters', () => {
    assert.equal(out('```\n\n\n```\n'), '```\n```\n');
  });

  test('a tilde fence is trimmed the same way', () => {
    assert.equal(out('~~~\n\ncode\n\n~~~\n', { codeBlock: { fenceChar: 'preserve' } }), '~~~\ncode\n~~~\n');
  });
});
