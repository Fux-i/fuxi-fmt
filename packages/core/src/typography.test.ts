import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

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

describe('TYPO-09 hashtags are not spaced', () => {
  test('leaves a CJK hashtag intact', () => {
    assert.equal(out('中文#标签\n'), '中文#标签\n');
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
