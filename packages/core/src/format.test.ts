import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('BLK-05 heading marker spacing', () => {
  test('inserts a missing space after the hash run', () => {
    assert.equal(out('#标题\n'), '# 标题\n');
  });
  test('collapses extra spaces after the hash run', () => {
    assert.equal(out('##   标题\n'), '## 标题\n');
  });
  test('handles deeper levels', () => {
    assert.equal(out('######  深度标题\n'), '###### 深度标题\n');
  });
  test('leaves a bare hash run alone', () => {
    assert.equal(out('####\n'), '####\n');
  });
  test('does not confuse a thematic break with a heading', () => {
    assert.equal(out('---\n'), '---\n');
  });
  test('does not promote an issue reference to a heading', () => {
    assert.equal(out('#123 修复\n'), '#123 修复\n');
  });
});

describe('BLK-04 list marker spacing', () => {
  test('collapses extra spaces after an unordered marker', () => {
    assert.equal(out('-   item\n'), '- item\n');
  });
  test('collapses extra spaces after an ordered marker', () => {
    assert.equal(out('1.   item\n'), '1. item\n');
  });
  test('keeps a parenthesis delimiter', () => {
    assert.equal(out('1)  item\n'), '1) item\n');
  });
  test('preserves nesting indentation', () => {
    assert.equal(out('  -   nested\n'), '  - nested\n');
  });
  test('normalizes the gap after a task checkbox', () => {
    assert.equal(out('- [x]   done\n'), '- [x] done\n');
  });
  test('leaves text that merely starts with a hyphen alone', () => {
    assert.equal(out('-not-a-list\n'), '-not-a-list\n');
  });
});

describe('BLK-09 blockquote marker spacing', () => {
  test('inserts a space after the marker', () => {
    assert.equal(out('>quote\n'), '> quote\n');
  });
  test('collapses extra spaces', () => {
    assert.equal(out('>   quote\n'), '> quote\n');
  });
  test('handles adjacent nested markers', () => {
    assert.equal(out('>>nested\n'), '>> nested\n');
  });
});

describe('BLK-01 and BLK-02 blank lines around blocks', () => {
  test('collapses a run of blank lines to one', () => {
    assert.equal(out('# A\n\n\n\ntext\n'), '# A\n\ntext\n');
  });
  test('inserts a blank line between a paragraph and a heading', () => {
    assert.equal(out('text\n# A\n'), 'text\n\n# A\n');
  });
  test('inserts a blank line between a paragraph and a list', () => {
    assert.equal(out('text\n- x\n'), 'text\n\n- x\n');
  });
  test('inserts blank lines around a fenced code block', () => {
    assert.equal(out('text\n```\ncode\n```\nmore\n'), 'text\n\n```\ncode\n```\n\nmore\n');
  });
  test('atLeast keeps extra blank lines when the cap is lifted', () => {
    assert.equal(
      out('# A\n\n\n\ntext\n', { blankLines: { aroundBlocks: 'atLeast', maxConsecutive: null } }),
      '# A\n\n\n\ntext\n',
    );
  });
  test('strips leading blank lines and ends with exactly one newline', () => {
    assert.equal(out('\n\n# A\n\n\n'), '# A\n');
  });
});

describe('protected regions are never touched', () => {
  test('SAFE-01 a fence body is byte-verbatim', () => {
    const src = '```\n#not a heading\n-not a list\n   spaced   \n```\n';
    assert.equal(out(src), src);
  });
  test('FM-01 front matter is byte-verbatim while the body still formats', () => {
    assert.equal(out('---\ntitle: 标题\n-  x\n---\n\n#标题\n'), '---\ntitle: 标题\n-  x\n---\n\n# 标题\n');
  });
  test('SAFE-02 a fence info string with Pandoc attributes is untouched', () => {
    // With the fence character pinned, nothing about the delimiter line may
    // move: indentation, the spacing before the info string, and the info
    // string itself are all byte-verbatim (SAFE-02).
    const src = '  ~~~ c {3, 4}\n  x\n  ~~~\n';
    assert.equal(out(src, { codeBlock: { fenceChar: 'preserve' } }), src);
  });
});

describe('GRT guarantees', () => {
  test('GRT-02 formatting is idempotent', () => {
    const src = '\n\n#标题\n\n\n-  x\n\n```\nraw\n```\n\n';
    const once = out(src);
    assert.equal(out(once), once);
  });
  test('GRT-03 a clean document is returned unchanged', () => {
    const src = '# A\n\ntext\n\n- x\n';
    assert.equal(out(src), src);
  });
  test('GRT-03 changed is false for a clean document', () => {
    assert.equal(format('# A\n\ntext\n').changed, false);
  });
});
