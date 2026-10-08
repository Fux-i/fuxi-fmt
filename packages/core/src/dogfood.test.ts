import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from './format.ts';
import type { FormatResult } from './format.ts';
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
  'CONTRIBUTING.md',
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

      // A note is not a refusal: TBL-01 reports the rows its cap left out of the
      // column widths, which is the formatter saying what it did. What must not
      // happen is an error, which is the guard withholding the result.
      const withheld = (result: FormatResult) =>
        result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
      assert.deepEqual(withheld(first), [], 'the guard withheld a result');
      assert.deepEqual(checkSemantics(source, first.output), [], 'semantics changed');

      const second = format(first.output);
      assert.deepEqual(withheld(second), []);
      assert.deepEqual(second.diagnostics, first.diagnostics, 'the second pass reported something else');
      assert.equal(second.output, first.output, 'formatting did not settle in one pass');
    });
  }
});
