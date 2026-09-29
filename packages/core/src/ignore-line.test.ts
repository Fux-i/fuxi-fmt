import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** CFG-03: the one-off directive, which covers the next block. */

describe('CFG-03 the ignore directive', () => {
  test('the next block is left as written', () => {
    const source = '#标题\n\n<!-- fuxi-fmt-ignore -->\n#未处理\n中文abc,中文\n\ntext\n';
    const output = format(source).output;
    assert.ok(output.includes('#未处理'), 'the ignored heading was reformatted');
    assert.ok(output.includes('中文abc,中文'), 'the ignored prose was reformatted');
    assert.ok(output.includes('# 标题'), 'content before the directive should still format');
  });

  test('only the next block is affected', () => {
    const source = '#标题\n\n<!-- fuxi-fmt-ignore -->\n#未处理\n\ntext\n\n#另一标题\n';
    const output = format(source).output;
    assert.ok(output.includes('#未处理'));
    assert.ok(output.includes('# 另一标题'), 'the block after the ignored one should format');
  });

  test('the directive name is configurable', () => {
    const source = '#标题\n\n<!-- skip -->\n#未处理\n\ntext\n';
    assert.ok(!format(source).output.includes('#未处理'));
    assert.ok(format(source, { ignore: { line: 'skip' } }).output.includes('#未处理'));
  });

  test('a document with no directive is unaffected', () => {
    assert.equal(format('#标题\n').output, '# 标题\n');
  });
});
