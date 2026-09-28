import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from './format.ts';
import { checkSemantics } from './guard.ts';

/**
 * The formatter's own documentation is the most awkward Markdown it will ever
 * meet: fenced examples containing fences, front matter discussions, tables of
 * rule IDs, CJK in inline code, and punctuation that is deliberately wrong.
 *
 * These files are not required to come out unchanged. They are required to come
 * out semantically identical and to settle in one pass.
 */

const root = new URL('../../../', import.meta.url).pathname;
const FILES = [
  'README.md',
  'AGENTS.md',
  'FUXI-FMT-SPEC.md',
  'CHANGELOG.md',
  'MAINSTREAM_MD_FORMATTERS_REPORT.md',
];

describe('dogfood: the repository formatter as its own input', () => {
  for (const file of FILES) {
    test(file, () => {
      const source = readFileSync(join(root, file), 'utf8');
      const first = format(source);

      assert.deepEqual(first.diagnostics, [], 'the guard withheld a result');
      assert.deepEqual(checkSemantics(source, first.output), [], 'semantics changed');

      const second = format(first.output);
      assert.deepEqual(second.diagnostics, []);
      assert.equal(second.output, first.output, 'formatting did not settle in one pass');
    });
  }
});
