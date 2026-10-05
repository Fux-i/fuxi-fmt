import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanRegions } from './scan.ts';

const TICK = String.fromCharCode(96);

/** Assert on the matched source text so tests do not depend on raw offsets. */
function slices(src: string) {
  return scanRegions(src).map((r) => [r.kind, src.slice(r.start, r.end)] as const);
}

describe('scan: front matter (FM-01)', () => {
  test('detects a YAML front matter block and excludes the trailing newline', () => {
    const src = '---\ntitle: x\ntags:\n  - a\n---\n\nbody\n';
    assert.deepEqual(slices(src), [['frontMatter', '---\ntitle: x\ntags:\n  - a\n---']]);
  });

  test('does not treat a thematic break as front matter', () => {
    const src = 'first\n\n---\n\nsecond\n';
    assert.deepEqual(slices(src), []);
  });

  test('does not treat front matter as such unless it starts on line 1', () => {
    const src = 'intro\n\n---\ntitle: x\n---\n';
    assert.deepEqual(slices(src), []);
  });
});

describe('scan: fenced code (SAFE-01, SAFE-02)', () => {
  test('detects a fence and reports its info string verbatim', () => {
    const src = 'before\n\n```js\nconst a = 1;\n```\n\nafter\n';
    const regions = scanRegions(src);
    assert.deepEqual(regions.map((r) => [r.kind, src.slice(r.start, r.end)]), [
      ['fencedCode', '```js\nconst a = 1;\n```'],
    ]);
    assert.equal(regions[0]?.info, 'js');
    assert.equal(regions[0]?.indent, '');
  });

  test('preserves a tilde fence with Pandoc attributes byte-for-byte', () => {
    const src = '~~~ c {3, 4}\nx\n~~~\n';
    const regions = scanRegions(src);
    assert.equal(regions[0]?.kind, 'fencedCode');
    assert.equal(regions[0]?.info, 'c {3, 4}');
    assert.equal(src.slice(regions[0]!.start, regions[0]!.end), '~~~ c {3, 4}\nx\n~~~');
  });

  test('records leading indentation without consuming it into the body', () => {
    const src = '- item\n\n  ```js\n  const a = 1;\n  ```\n';
    const regions = scanRegions(src);
    assert.equal(regions[0]?.kind, 'fencedCode');
    assert.equal(regions[0]?.indent, '  ');
  });

  test('a longer closing fence does not end a shorter opening fence early', () => {
    const src = '````md\n```\ninner\n````\n';
    const regions = scanRegions(src);
    assert.equal(src.slice(regions[0]!.start, regions[0]!.end), '````md\n```\ninner\n````');
  });

  test('an unterminated fence runs to end of input', () => {
    const src = 'text\n\n```js\nnever closed\n';
    assert.equal(slices(src)[0]?.[1], '```js\nnever closed\n');
  });
});

describe('scan: indented code (SAFE-01)', () => {
  test('detects a 4-space indented code block following a blank line', () => {
    const src = 'para\n\n    indented code\n    more code\n\nafter\n';
    assert.deepEqual(slices(src), [['indentedCode', '    indented code\n    more code']]);
  });

  test('does not treat a wrapped list continuation as indented code', () => {
    const src = '- item\n\n  continuation of the item\n';
    assert.deepEqual(slices(src), []);
  });
});

describe('scan: inline protected spans (SAFE-03)', () => {
  test('detects an inline code span', () => {
    const src = '中文 `code` 中文\n';
    assert.deepEqual(slices(src), [['inlineCode', '`code`']]);
  });

  test('detects a multi-backtick inline span', () => {
    const src = 'a ``code with ` tick`` b\n';
    assert.deepEqual(slices(src), [['inlineCode', '``code with ` tick``']]);
  });

  test('detects inline math', () => {
    const src = '值 $x^2$ 与 $y$\n';
    assert.deepEqual(slices(src), [['inlineMath', '$x^2$'], ['inlineMath', '$y$']]);
  });

  test('detects an escaped backtick as literal text, not a span', () => {
    const src = 'a \\` not code\\` b\n';
    assert.deepEqual(slices(src), []);
  });
});

describe('scan: verbatim link and markup destinations (SAFE-04, SAFE-05, SAFE-06)', () => {
  test('detects a bare URL and excludes trailing punctuation', () => {
    const src = '见 https://example.com/a_b?q=1，然后\n';
    assert.deepEqual(slices(src), [['url', 'https://example.com/a_b?q=1']]);
  });

  test('detects an inline link destination but not its text', () => {
    const src = '[中文](https://example.com/路径) 后\n';
    assert.deepEqual(slices(src), [['url', 'https://example.com/路径']]);
  });

  test('detects an HTML comment', () => {
    const src = 'a <!-- 全角，标点 --> b\n';
    assert.deepEqual(slices(src), [['htmlComment', '<!-- 全角，标点 -->']]);
  });

  test('detects an HTML block', () => {
    const src = 'x\n\n<div class="a">\n  <span>中文</span>\n</div>\n\ny\n';
    assert.deepEqual(slices(src), [['htmlBlock', '<div class="a">\n  <span>中文</span>\n</div>']]);
  });

  test('detects a wikilink', () => {
    const src = '见 [[笔记 A|别名]] 和 [[B]]\n';
    assert.deepEqual(slices(src), [['wikilink', '[[笔记 A|别名]]'], ['wikilink', '[[B]]']]);
  });

  test('detects MDX/JSX shortcode markup', () => {
    const src = '文本 <Badge text="中文" /> 结尾\n';
    assert.deepEqual(slices(src), [['mdx', '<Badge text="中文" />']]);
  });

  test('detects a `{{ }}` shortcode', () => {
    const src = '见 {{< figure src="a.png" >}} 处\n';
    assert.deepEqual(slices(src), [['mdx', '{{< figure src="a.png" >}}']]);
  });
});

describe('scan: inline code delimiters', () => {
  test('a span whose content is a backslash still closes', () => {
    const src = 'escape ' + TICK + '[' + TICK + ' ' + TICK + ']' + TICK + ' ' + TICK + '\\' + TICK + ' done\n';
    assert.deepEqual(slices(src), [
      ['inlineCode', TICK + '[' + TICK],
      ['inlineCode', TICK + ']' + TICK],
      ['inlineCode', TICK + '\\' + TICK],
    ]);
  });

  test('an escaped backtick does not open a span', () => {
    assert.deepEqual(slices('a \\' + TICK + ' b\n'), []);
  });
});

describe('scan: display math (SAFE-03)', () => {
  test('two dollar-sign-only lines delimit a block, trailing newline excluded', () => {
    const src = '$$\nf(x), 中文(零)\n$$\n';
    assert.deepEqual(slices(src), [['mathBlock', '$$\nf(x), 中文(零)\n$$']]);
  });

  test('one line beginning and ending with two dollars is display math', () => {
    // One region covering the whole line, not two spans covering the markers.
    assert.deepEqual(slices('$$x^2$$\n'), [['mathBlock', '$$x^2$$']]);
  });

  test('dollars in prose are not display math', () => {
    assert.deepEqual(slices('价格 $5 元, 很贵\n'), []);
  });

  test('an opener with no closer runs to the end of the document', () => {
    const regions = scanRegions('a\n$$\nx_1\n');
    assert.deepEqual(regions.map((r) => [r.kind, r.closed]), [['mathBlock', false]]);
  });
});

describe('scan: region contract', () => {
  test('regions are sorted by start offset and never overlap', () => {
    const src = '---\nt: 1\n---\n\n`code` 与文字\n\n```js\nx\n```\n\n<div>y</div>\n';
    const regions = scanRegions(src);
    for (let i = 1; i < regions.length; i++) {
      assert.ok(regions[i]!.start >= regions[i - 1]!.end, 'regions overlap or are unsorted');
    }
  });
});

describe('scan: a protected region inside a block quote (SAFE-01, SAFE-04)', () => {
  test('a quoted fence is a fence, markers included in the region', () => {
    const src = '> ' + TICK.repeat(3) + '\n> 中文abc\n> ' + TICK.repeat(3) + '\n';
    assert.deepEqual(slices(src), [
      ['fencedCode', '> ' + TICK.repeat(3) + '\n> 中文abc\n> ' + TICK.repeat(3)],
    ]);
  });

  test('an unterminated quoted fence ends where the quote ends', () => {
    const src = '> ' + TICK.repeat(3) + '\n> code\n\ntext\n';
    assert.deepEqual(slices(src), [
      ['fencedCode', '> ' + TICK.repeat(3) + '\n> code'],
    ]);
  });

  test('a quoted display math block is a math block, not two inline spans', () => {
    const src = '> $$\n> 中文abc\n> $$\n';
    assert.deepEqual(slices(src), [['mathBlock', '> $$\n> 中文abc\n> $$']]);
  });

  test('a quoted HTML block is an HTML block', () => {
    const src = '> <div>\n> 中文,abc\n> </div>\n';
    assert.deepEqual(slices(src), [['htmlBlock', '> <div>\n> 中文,abc\n> </div>']]);
  });

  test('a quoted indented code block is code', () => {
    const src = '>\n>     中文abc\n';
    assert.deepEqual(slices(src), [['indentedCode', '>     中文abc']]);
  });

  test('a bare > is a blank line, so it ends a quoted HTML block', () => {
    const src = '> <div>\n>\n> 中文,abc\n> </div>\n';
    const kinds = scanRegions(src).map((r) => r.kind);
    assert.deepEqual(kinds, ['htmlBlock']);
    assert.equal(slices(src)[0]?.[1], '> <div>');
  });

  test('front matter is still a document-start thing, not a quoted one', () => {
    assert.deepEqual(slices('> ---\ntitle: x\n> ---\n'), []);
  });
});
