import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** CFG-03: the range directives. The whole-file directive is covered separately. */

const RANGED =
  '#标题\n\n<!-- fuxi-fmt-ignore-start -->\n#未处理的标题\n中文abc,中文\n<!-- fuxi-fmt-ignore-end -->\n\ntext\n';

describe('CFG-03 the ignore-start and ignore-end directives', () => {
  test('a marked range is left exactly as written', () => {
    const output = format(RANGED).output;
    assert.ok(output.includes('#未处理的标题'), 'the ignored heading was reformatted');
    assert.ok(output.includes('中文abc,中文'), 'the ignored prose was reformatted');
    assert.ok(output.includes('# 标题'), 'content outside the range should still format');
  });

  test('an unterminated range runs to the end of the document', () => {
    const output = format('#标题\n\n<!-- fuxi-fmt-ignore-start -->\n#未处理\n中文abc\n').output;
    assert.ok(output.includes('#未处理'));
    assert.ok(output.includes('中文abc'));
    assert.ok(output.includes('# 标题'));
  });

  test('the result settles in one pass', () => {
    const once = format(RANGED).output;
    assert.equal(format(once).output, once);
  });

  test('the directive names are configurable', () => {
    const source = '#标题\n\n<!-- off -->\n#未处理\n<!-- on -->\n\ntext\n';
    assert.ok(!format(source).output.includes('#未处理'));
    assert.ok(format(source, { ignore: { start: 'off', end: 'on' } }).output.includes('#未处理'));
  });

  test('a document with no directives is unaffected', () => {
    assert.equal(format('#标题\n').output, '# 标题\n');
  });
});
