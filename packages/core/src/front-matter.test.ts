/**
 * Front matter: the block at the top of the file that a static site generator
 * reads before the body.
 *
 * FM-01 protects the YAML form byte for byte. FM-06 does the same for the TOML
 * form and says so, because unlike YAML there is no formatting of it to look
 * forward to: the block is preserved and reported rather than silently left
 * alone.
 *
 * Spec references: FM-01, FM-02, FM-06.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

describe('FM-06 TOML front matter is protected and reported', () => {
  test('a +++ block keeps its bytes and gets one warning', () => {
    const input = '+++\ntitle = "x"\n# a note\ntags = ["a","b"]\n+++\n\nBody\n';
    const result = format(input);
    assert.equal(result.output, input, 'the block is byte-verbatim');
    assert.equal(result.changed, false);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('the body after the block still formats', () => {
    const result = format('+++\na = 1\n+++\n\n#标题\n');
    assert.equal(result.output, '+++\na = 1\n+++\n\n# 标题\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
  });

  test('no rule fires inside the block', () => {
    // Read as prose, `# a note` is an ATX heading and `,` is punctuation to
    // convert; both rewrite a file another tool parses as configuration.
    const input = '+++\ntitle = "我的,笔记"\n#comment\n+++\n\nBody\n';
    assert.equal(format(input).output, input);
  });

  test('an unclosed +++ block is preserved to the end and reported', () => {
    const input = '+++\ntitle = "x"\n\nBody\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('YAML front matter is not a TOML report', () => {
    assert.deepEqual(format('---\ntitle: x\n---\n\nBody\n').diagnostics, []);
  });

  test('a +++ line that is not at the top is prose', () => {
    assert.deepEqual(format('intro\n\n+++\n\nBody\n').diagnostics, []);
  });

  test('FM-06 is idempotent', () => {
    const input = '+++\na = 1\n+++\n\nBody\n';
    const once = format(input);
    assert.equal(format(once.output).output, once.output);
  });
});

describe('FM-03 front matter is normalized', () => {
  test('key spacing, sequence indent and flow separators', () => {
    const input = '---\ntitle:   my post\ntags:  [a,b]\nlist:\n- one\n- two\n---\n\nBody\n';
    const expected = '---\ntitle: my post\ntags: [a, b]\nlist:\n  - one\n  - two\n---\n\nBody\n';
    assert.equal(format(input).output, expected);
  });

  test('a long scalar is not folded', () => {
    const long = 'description: ' + Array.from({ length: 12 }, (_, i) => 'word' + String(i)).join(' ');
    const input = '---\n' + long + '\n---\n\nBody\n';
    assert.equal(format(input).output, input);
    assert.equal(format(input).changed, false);
  });

  test('a quoted scalar keeps its bytes and its quoting', () => {
    const input = '---\ntitle: "a: b"\nescaped: "x\\ty"\n---\n\nBody\n';
    assert.equal(format(input).output, input);
  });

  test('FM-03 is idempotent', () => {
    const once = format('---\ntitle:   x\ntags:  [a,b]\n---\n\nBody\n').output;
    assert.equal(format(once).output, once);
  });

  test('frontMatter.format: preserve hands the block back untouched', () => {
    const input = '---\ntitle:   x\ntags:  [a,b]\n---\n\nBody\n';
    const result = format(input, { frontMatter: { format: 'preserve' } });
    assert.equal(result.output, input);
    assert.equal(result.changed, false);
  });

  test('the body still formats while the block does too', () => {
    const input = '---\ntitle:   x\n---\n\n#标题\n';
    assert.equal(format(input).output, '---\ntitle: x\n---\n\n# 标题\n');
  });
});

describe('FM-03 the serializer differences the specification accepts', () => {
  // Each of these is in FM-03's list. They are here because a claim about what a
  // third-party printer does is only worth making with a fixture behind it.
  test('a flow collection gets a space after its commas', () => {
    assert.equal(
      format('---\ntags: [a,b,c]\n---\n\nBody\n').output,
      '---\ntags: [a, b, c]\n---\n\nBody\n',
    );
  });

  test('an explicit tag is re-quoted', () => {
    assert.equal(
      format('---\ntag: !!str 123\n---\n\nBody\n').output,
      '---\ntag: !!str "123"\n---\n\nBody\n',
    );
  });

  test('a folded scalar is folded flat', () => {
    assert.equal(
      format('---\nfold: >\n  p\n  q\n---\n\nBody\n').output,
      '---\nfold: >\n  p q\n---\n\nBody\n',
    );
  });

  test('a comment at the end of the block gets a blank line before it', () => {
    assert.equal(
      format('---\n# lead\ntitle: x\n# trailing\n---\n\nBody\n').output,
      '---\n# lead\ntitle: x\n\n# trailing\n---\n\nBody\n',
    );
  });
});

describe('FM-04 typography inside front matter', () => {
  const on = { frontMatter: { typography: true } } as const;

  test('is on by default', () => {
    const input = '---\n# 注释comment\ntitle: 中文abc\n---\n\nBody\n';
    assert.equal(
      format(input).output,
      '---\n# 注释 comment\ntitle: 中文 abc\n---\n\nBody\n',
    );
  });

  test('can be turned off', () => {
    const input = '---\n# 注释comment\ntitle: 中文abc\n---\n\nBody\n';
    assert.equal(format(input, { frontMatter: { typography: false } }).output, input);
  });

  test('spaces a plain scalar value but never its key', () => {
    const input = '---\ntitle: 中文abc\n中文key: value\n---\n\nBody\n';
    assert.equal(
      format(input, on).output,
      '---\ntitle: 中文 abc\n中文key: value\n---\n\nBody\n',
    );
  });

  test('spaces a comment, above a key and inline', () => {
    const input = '---\n# 注释comment\ntitle: x # 行内note\n---\n\nBody\n';
    assert.equal(
      format(input, on).output,
      '---\n# 注释 comment\ntitle: x # 行内 note\n---\n\nBody\n',
    );
  });

  test('only spaces change, never a character', () => {
    const input = '---\ntitle: 中文abc，def,ghi\n---\n\nBody\n';
    const output = format(input, on).output;
    assert.equal(output.replace(/ /g, ''), input.replace(/ /g, ''));
  });

  test('a block scalar is left alone', () => {
    const input = '---\ndesc: |\n  中文abc\n---\n\nBody\n';
    assert.equal(format(input, on).output, input);
  });

  test('a value inside a flow collection is left alone', () => {
    const input = '---\ntags: [中文abc]\n---\n\nBody\n';
    assert.equal(format(input, on).output, input);
  });

  test('FM-04 is idempotent', () => {
    const once = format('---\ntitle: 中文abc\n---\n\nBody\n', on).output;
    assert.equal(format(once, on).output, once);
  });
});

describe('FM-05 front matter that does not parse is kept and reported', () => {
  test('an unterminated flow sequence', () => {
    const input = '---\ntitle: [unclosed\n---\n\n#标题\n';
    const result = format(input);
    assert.equal(result.output, '---\ntitle: [unclosed\n---\n\n# 标题\n');
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-05');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('a block whose content is only comments stays as written', () => {
    // The serializer would append the `null` it makes of an empty document.
    const input = '---\n# only a note\n---\n\nBody\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.deepEqual(result.diagnostics, []);
  });
});

