import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string) => format(src).output;

describe('TYPO-01 CJK and non-CJK spacing', () => {
  test('inserts one space between CJK and Latin', () => {
    assert.equal(out('中文abc\n'), '中文 abc\n');
    assert.equal(out('abc中文\n'), 'abc 中文\n');
  });
  test('leaves text without CJK alone', () => {
    assert.equal(out('abc123\n'), 'abc123\n');
  });
  test('keeps an existing boundary space', () => {
    assert.equal(out('中文 abc\n'), '中文 abc\n');
  });
  test('collapses a boundary whitespace run to a single space', () => {
    assert.equal(out('中文  abc\n'), '中文 abc\n');
  });
  test('spaces CJK against digits, percents and counters', () => {
    assert.equal(out('第1章\n'), '第 1 章\n');
    assert.equal(out('50%中文\n'), '50% 中文\n');
    assert.equal(out('100分\n'), '100 分\n');
  });
  test('leaves a number and unit that touch no CJK alone', () => {
    assert.equal(out('15%\n'), '15%\n');
    assert.equal(out('10GB\n'), '10GB\n');
  });
  test('keeps a trailing plus attached to its word', () => {
    assert.equal(out('C++中文\n'), 'C++ 中文\n');
  });
});

describe('TYPO-02 whitespace collapse is local to the CJK boundary', () => {
  test('does not collapse whitespace between two Latin runs', () => {
    assert.equal(out('a  b\n'), 'a  b\n');
  });
  test('does not collapse whitespace between two CJK runs', () => {
    assert.equal(out('中文  中文\n'), '中文  中文\n');
  });
});

describe('TYPO-03 compound names stay intact', () => {
  test('spaces around, but never inside, a hyphenated name', () => {
    assert.equal(out('使用GPT-4o模型\n'), '使用 GPT-4o 模型\n');
    assert.equal(out('得到一个A-B的结果\n'), '得到一个 A-B 的结果\n');
    assert.equal(out('state-of-the-art技术\n'), 'state-of-the-art 技术\n');
  });
  test('keeps a slash tight', () => {
    assert.equal(out('60公里/小时\n'), '60 公里/小时\n');
  });
});

describe('TYPO-07 no space around full-width punctuation', () => {
  test('does not space across full-width punctuation', () => {
    assert.equal(out('中文，abc\n'), '中文，abc\n');
  });
  test('removes whitespace adjacent to full-width punctuation', () => {
    assert.equal(out('中文 ， abc\n'), '中文，abc\n');
  });
  test('keeps a sentence-ending mark tight', () => {
    assert.equal(out('中文。\n'), '中文。\n');
  });
});

/**
 * A refused document comes back as its own input, so asserting on the output
 * alone cannot tell "formatted, unchanged" from "not formatted at all". These
 * cases assert that nothing was reported first.
 */
const clean = (src: string): string => {
  const result = format(src);
  assert.deepEqual(result.diagnostics, [], 'refused or warned: ' + JSON.stringify(src));
  return result.output;
};

describe('TYPO-07 keeps the space a block marker is separated by', () => {
  test('a list item whose content starts with full-width punctuation stays a list item', () => {
    assert.equal(clean('- “引用”\n'), '- “引用”\n');
    assert.equal(clean('1. “引用”\n'), '1. “引用”\n');
    assert.equal(clean('- 《中文》\n'), '- 《中文》\n');
  });
  test('a heading whose text starts with full-width punctuation stays a heading', () => {
    assert.equal(clean('# “引用”\n'), '# “引用”\n');
  });
  test('the inner marker of a list inside a blockquote survives too', () => {
    assert.equal(clean('> - “引用”\n'), '> - “引用”\n');
  });
  test('the marker keeps its space and the rest of the line is still formatted', () => {
    assert.equal(clean('- “引用”中abc\n'), '- “引用”中 abc\n');
  });
  test('a run of spaces after the marker collapses to the one it needs', () => {
    assert.equal(clean('-   “引用”\n'), '- “引用”\n');
  });
  test('an unchanged document is reported as unchanged', () => {
    const result = format('- “引用”\n');
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.changed, false);
  });
  test('prose still loses the space beside full-width punctuation', () => {
    assert.equal(out('中文 ，“引用”\n'), '中文，“引用”\n');
    assert.equal(out('中文 - “引用”\n'), '中文 -“引用”\n');
  });
});

describe('TYPO-09 hashtags are not spaced', () => {
  test('leaves a CJK hashtag intact', () => {
    assert.equal(out('中文#标签\n'), '中文#标签\n');
  });
  test('spaces it only when the opt-in is set', () => {
    assert.equal(
      format('中文#标签\n', { typography: { hashtag: true } }).output,
      '中文 # 标签\n',
    );
  });
});

describe('inline atoms behave as Latin words with untouched contents', () => {
  test('spaces around inline code', () => {
    assert.equal(out('中文`code`中文\n'), '中文 `code` 中文\n');
  });
  test('keeps inline code tight against full-width punctuation', () => {
    assert.equal(out('中文`code`，\n'), '中文 `code`，\n');
  });
  test('never rewrites the contents of a code span', () => {
    assert.equal(out('中文`a  b`中文\n'), '中文 `a  b` 中文\n');
  });
  test('spaces around inline math', () => {
    assert.equal(out('值$x^2$与$y$\n'), '值 $x^2$ 与 $y$\n');
  });
  test('spaces a bare URL against CJK', () => {
    assert.equal(out('见https://a.b\n'), '见 https://a.b\n');
  });
});

describe('protected blocks are skipped by the typography pass', () => {
  test('SAFE-01 fence bodies keep their spacing verbatim', () => {
    const src = '```\n中文abc\n```\n';
    assert.equal(out(src), src);
  });
  test('FM-01 front matter keeps its spacing verbatim', () => {
    const src = '---\ntitle: 中文abc\n---\n\ntext\n';
    assert.equal(out(src), src);
  });
});

describe('GRT-02 typography is idempotent', () => {
  test('a second pass changes nothing', () => {
    const src = '中文abc，中文`code`中文 中文  x\n';
    const once = out(src);
    assert.equal(out(once), once);
  });
});

describe('TYPO-12 one delimiter per emphasis kind', () => {
  const strong = (value: 'asterisks' | 'underscores' | 'preserve') => ({
    typography: { emphasis: { strong: value } },
  });
  const em = (value: 'asterisk' | 'underscore' | 'preserve') => ({
    typography: { emphasis: { em: value } },
  });
  const strike = (value: 'double' | 'single' | 'preserve') => ({
    typography: { emphasis: { strikethrough: value } },
  });
  const emph = (src: string, options: Parameters<typeof format>[1]) => format(src, options).output;

  test('preserve is the default, so no delimiter moves', () => {
    for (const src of ['a **b** c\n', 'a __b__ c\n', 'a *b* c\n', 'a _b_ c\n', 'a ~~b~~ c\n']) {
      assert.equal(out(src), src);
    }
  });
  test('respells a pair, one kind at a time', () => {
    assert.equal(emph('a **b** c\n', strong('underscores')), 'a __b__ c\n');
    assert.equal(emph('a __b__ c\n', strong('asterisks')), 'a **b** c\n');
    assert.equal(emph('a _b_ c\n', em('asterisk')), 'a *b* c\n');
    assert.equal(emph('a *b* c\n', em('underscore')), 'a _b_ c\n');
    assert.equal(emph('a ~b~ c\n', strike('double')), 'a ~~b~~ c\n');
    assert.equal(emph('a ~~b~~ c\n', strike('single')), 'a ~b~ c\n');
  });
  test('never turns a word into emphasis', () => {
    // An underscore inside a word cannot open one, so there is no pair to respell.
    assert.equal(emph('snake_case_name\n', em('asterisk')), 'snake_case_name\n');
    assert.equal(emph('中文_斜体_中文\n', em('asterisk')), '中文_斜体_中文\n');
    // And the target is tested too: '**' here is emphasis, '__' would not be.
    assert.equal(emph('中文**加粗**中文\n', strong('underscores')), '中文**加粗**中文\n');
    assert.equal(emph('中文__加粗__中文\n', strong('asterisks')), '中文__加粗__中文\n');
  });
  test('leaves a run of three delimiters alone', () => {
    assert.equal(emph('***both***\n', strong('underscores')), '***both***\n');
  });
  test('never reaches into a protected region', () => {
    const src = 'a `__b__` c\n';
    assert.equal(emph(src, strong('asterisks')), src);
    const fence = '```\n__b__\n```\n';
    assert.equal(emph(fence, strong('asterisks')), fence);
  });
  test('settles in one pass', () => {
    const options: FormatOptionsInput = {
      typography: { emphasis: { strong: 'asterisks', em: 'asterisk', strikethrough: 'double' } },
    };
    const once = emph('a __b__ _c_ ~d~\n', options);
    assert.equal(emph(once, options), once);
  });
});
