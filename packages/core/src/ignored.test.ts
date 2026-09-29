import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/**
 * CFG-03. The escape hatch an author needs when a rule is wrong about their
 * document. Only the whole-file directive exists so far; the range and
 * next-block directives are declared missing in the specification.
 */

describe('CFG-03 the ignore-file directive', () => {
  test('returns the document untouched', () => {
    const source = '<!-- fuxi-fmt-ignore-file -->\n\n#标题\n\n本项目 使用Vue3开发\n';
    const result = format(source);
    assert.equal(result.output, source);
    assert.equal(result.changed, false);
    assert.deepEqual(result.diagnostics, []);
  });

  test('is recognised wherever the comment sits', () => {
    const source = '#标题\n\n<!-- fuxi-fmt-ignore-file -->\n';
    assert.equal(format(source).output, source);
  });

  test('tolerates whitespace inside the comment', () => {
    assert.equal(format('<!--   fuxi-fmt-ignore-file   -->\n#标题\n').output, '<!--   fuxi-fmt-ignore-file   -->\n#标题\n');
  });

  test('must be the whole comment, so mentioning it does not opt out', () => {
    assert.equal(
      format('#标题 见 fuxi-fmt-ignore-file\n').output,
      '# 标题 见 fuxi-fmt-ignore-file\n',
    );
    assert.equal(
      format('<!-- see fuxi-fmt-ignore-file -->\n#标题\n').output,
      '<!-- see fuxi-fmt-ignore-file -->\n\n# 标题\n',
    );
  });

  test('the directive name is configurable', () => {
    const source = '<!-- no-format-here -->\n#标题\n';
    // The comment is still a block in the document, so it survives with a blank
    // line after it.
    assert.equal(format(source).output, '<!-- no-format-here -->\n\n# 标题\n');
    assert.equal(format(source, { ignore: { file: 'no-format-here' } }).output, source);
  });

  test('a document without the directive still formats', () => {
    assert.equal(format('#标题\n').output, '# 标题\n');
  });
});
