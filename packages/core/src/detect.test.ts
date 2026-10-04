/**
 * Detection: what the formatter had to guess.
 *
 * Every rule here reports a place where the parse was ambiguous, not a place
 * where the prose is bad (that is NG-12's non-goal). A block that never
 * terminated means the rest of the document was read as part of it, so the
 * document is refused and the author is told; a suspicion that terminated is a
 * warning and the document still formats.
 *
 * Spec references: DET-01, DET-03, CFG-04, GRT-04.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

/** Backticks, without writing one in the source and confusing every reader. */
const TICK = String.fromCharCode(96);
const FENCE = TICK + TICK + TICK;

describe('DET-01 an unterminated code fence refuses the document', () => {
  test('everything after the fence is code, so nothing is formatted', () => {
    const input = FENCE + 'js\nconst a = 1;\n\n# 标题, 后面\n';
    const result = format(input);
    assert.equal(result.output, input, 'a refused document comes back untouched');
    assert.equal(result.changed, false);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-01');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('the line is the fence, wherever it is', () => {
    const result = format('intro\n\n' + FENCE + '\nnever closed\n');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('a closed fence is not a detection', () => {
    assert.deepEqual(format(FENCE + '\ncode\n' + FENCE + '\n').diagnostics, []);
  });

  test('a tilde fence is a fence, and a longer opener does not pair with a shorter closer', () => {
    assert.equal(format('~~~\ncode\n').diagnostics[0]?.ruleId, 'DET-01');
    const four = TICK + TICK + TICK + TICK;
    assert.equal(format(four + 'js\ncode\n' + FENCE + '\n').diagnostics[0]?.ruleId, 'DET-01');
  });

  test('a refused document is byte-identical, line endings included', () => {
    const input = FENCE + 'js\r\ncode\r\n';
    assert.equal(format(input).output, input);
  });
});

describe('DET-03 an unterminated HTML comment refuses the document', () => {
  test('nothing closes it, so the rest of the file is a comment', () => {
    const input = 'intro\n\n<!-- open\n\n中文,后面\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-03');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('a closed comment is not a detection', () => {
    assert.deepEqual(format('<!-- 全角，标点 -->\n').diagnostics, []);
  });

  test('a comment start inside a code fence is code, not a comment', () => {
    const input = FENCE + '\n<!-- not a comment\n' + FENCE + '\n';
    assert.deepEqual(format(input).diagnostics, []);
  });
});

describe('DET-04 an unterminated display-math block refuses the document', () => {
  const DOLLARS = '$$';

  test('everything after the opener was read as display math', () => {
    const input = DOLLARS + '\nf(x), 中文(零)\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-04');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('a closed block is not a detection, and its body is protected', () => {
    // The reason the region exists: the inline matcher used to claim the two
    // dollar markers as separate spans and leave the body in prose, so every
    // half-width mark inside a formula was converted.
    const input = DOLLARS + '\nf(x), 中文(零)\n' + DOLLARS + '\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.deepEqual(result.diagnostics, []);
  });

  test('one line of display math is protected too', () => {
    const input = DOLLARS + 'f(x), 中文(零)' + DOLLARS + '\n';
    assert.equal(format(input).output, input);
  });
});

describe('DET-02 unterminated front matter refuses the document', () => {
  test('a YAML-looking body makes the opener front matter, not a thematic break', () => {
    // The metadata was being formatted as prose: the comma in title: 我的,笔记
    // became full-width, and the file a static site generator reads was no longer
    // the file the author wrote.
    const input = '---\ntitle: 我的,笔记\ntags: [中文,测试]\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-02');
    assert.equal(result.diagnostics[0]?.severity, 'error');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('a horizontal rule followed by prose is not front matter', () => {
    const input = '---\n这是正文,不是 YAML\n';
    const result = format(input);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, '---\n\n这是正文，不是 YAML\n');
  });

  test('closed front matter is not a detection, and its bytes are kept', () => {
    const result = format('---\ntitle: 我的,笔记\n---\n\n正文,后面\n');
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.output, '---\ntitle: 我的,笔记\n---\n\n正文，后面\n');
  });
});

describe('DET-06/DET-07 a delimiter with no partner', () => {
  test('an unmatched backtick is reported once for the line', () => {
    const input = '用 ' + TICK + ' 表示\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-06');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('an escaped backtick is deliberate, and is not reported', () => {
    assert.deepEqual(format('a \\' + TICK + ' b\n').diagnostics, []);
  });

  test('a matched code span is not an unmatched backtick', () => {
    assert.deepEqual(format('用 ' + TICK + 'x' + TICK + ' 表示\n').diagnostics, []);
  });

  test('a backtick inside a fence is code, not a delimiter', () => {
    const input = FENCE + '\na ' + TICK + ' b\n' + FENCE + '\n';
    assert.deepEqual(format(input).diagnostics, []);
  });

  test('a code span the author wrapped across lines is not reported', () => {
    // DET-05 was proposed for exactly this shape and dropped: a hard-wrapped
    // inline code span is correct Markdown, it appears in this repository's own
    // CHANGELOG, and the span is protected precisely as it should be. A rule that
    // fires on correct input is a rule that teaches people to ignore the panel.
    const input = 'text ' + TICK + 'a long span\nwrapped over two lines' + TICK + ' more\n';
    assert.deepEqual(format(input).diagnostics, []);
  });

  test('an unmatched dollar is reported', () => {
    const result = format('价格是 $5 元, 很便宜\n');
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-07');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
  });

  test('a closed formula is not an unmatched dollar', () => {
    assert.deepEqual(format('设 $x=1$, 则结果\n').diagnostics, []);
  });
});

describe('DET-08/DET-09 an inline opener with no closer', () => {
  test('an unclosed wikilink', () => {
    const result = format('见 [[笔记 A 处\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-08');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
  });

  test('a closed wikilink is not reported', () => {
    assert.deepEqual(format('见 [[笔记 A|别名]] 处\n').diagnostics, []);
  });

  test('an unclosed link destination', () => {
    const result = format('见 [文字](https://a.b 处\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-09');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
  });

  test('a closed link is not reported', () => {
    assert.deepEqual(format('见 [文字](https://a.b) 处\n').diagnostics, []);
  });
});

describe('DET-10 a table row that does not match its header', () => {
  test('a row with too many cells', () => {
    const result = format('| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-10');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('an escaped pipe is cell content, not a column separator', () => {
    assert.deepEqual(format('| a | b |\n| --- | --- |\n| x \\| y | z |\n').diagnostics, []);
  });

  test('a table inside a fence is code', () => {
    const input = FENCE + '\n| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n' + FENCE + '\n';
    assert.deepEqual(format(input).diagnostics, []);
  });
});

describe('DET-11 an item indented as if nested that belongs to no parent', () => {
  test('the snippet that started this: an item written shallower than its siblings', () => {
    const result = format('1. 333\n   - yes\n  - ok\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'DET-11');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 2);
  });

  test('ordinary nesting is not reported', () => {
    assert.deepEqual(format('1. a\n   - b\n').diagnostics, []);
  });
});

