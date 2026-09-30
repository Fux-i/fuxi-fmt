import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import { checkSemantics } from './guard.ts';
import type { FormatOptionsInput } from './options.ts';

/**
 * Each option has its own tests; the option surface in combination had none.
 * Interactions are exactly where a formatter breaks - a fence pinned to tildes
 * meeting a list renumbered at depth, a parenthesis rule meeting a punctuation
 * rule that already moved the brackets.
 *
 * This sweeps a deterministic sample of the full option product against a few
 * deliberately awkward documents and asserts the two things that must hold for
 * every combination: the guard passes, and the result settles in one pass.
 */

const DOCS = [
  '---\ntitle: 中文abc\nlist:\n  - １２３\n---\n\n#标题\n\n本项目 使用Vue3开发,性能提升50%。（NMRI）\n\n1. 安装\n9. 启动\n\n- 要点（一二三）\n\n```js\nconst a=1;// 中文\n```\n\n~~~ c {3, 4}\n中文abc\n~~~\n\n> 引用\n\n| 参数 | 说明 |\n| --- | --- |\n| a | 中文abc |\n\n中文#标签;中文()与（）\n',
  '>quote\n>>nested\n\n中文１２３ 与 \u3000全角空格\n\n`code`与 $x$ 与 https://a.b 与 [[笔记]]\n',
  '# A\n\ntext\n\n* item\n+ item\n\n3. a\n7. b\n',
];

const AROUND = ['exact', 'atLeast'] as const;
const ORDERED = ['renumber', 'keep-all-ones', 'preserve'] as const;
const MARKERS = ['dashes', 'asterisks', 'preserve'] as const;
const FENCES = ['backticks', 'tildes', 'preserve'] as const;
const PUNCT = ['fullwidth', 'halfwidth', 'mixed', 'off'] as const;
const PAREN = ['mixed', 'fullwidth', 'halfwidth', 'preserve'] as const;
const FLAGS = [true, false] as const;

const AXES = [AROUND, ORDERED, MARKERS, FENCES, PUNCT, PAREN, FLAGS, FLAGS];
const TOTAL = AXES.reduce((product, axis) => product * axis.length, 1);
const SAMPLE = 256;

function variant(n: number): FormatOptionsInput {
  let rest = n;
  const take = <T>(values: readonly T[]): T => {
    const value = values[rest % values.length] as T;
    rest = Math.floor(rest / values.length);
    return value;
  };
  return {
    blankLines: { aroundBlocks: take(AROUND) },
    list: { orderedStyle: take(ORDERED), unorderedMarker: take(MARKERS) },
    codeBlock: { fenceChar: take(FENCES) },
    typography: {
      punctuationStyle: take(PUNCT),
      parenStyle: take(PAREN),
      hashtag: take(FLAGS),
      semicolon: take(FLAGS),
    },
  };
}

describe('the option surface in combination', () => {
  test('every sampled combination preserves semantics and settles in one pass', () => {
    const step = Math.max(1, Math.floor(TOTAL / SAMPLE));
    let checked = 0;

    for (let n = 0; n < TOTAL; n += step) {
      const options = variant(n);
      for (const source of DOCS) {
        checked++;
        const first = format(source, options);
        const label = 'options ' + JSON.stringify(options);

        assert.deepEqual(first.diagnostics, [], 'guard withheld a result for ' + label);

        const second = format(first.output, options);
        assert.equal(second.output, first.output, 'did not settle in one pass for ' + label);
      }
    }

    assert.ok(checked >= 500, 'expected a meaningful sample, checked ' + String(checked));
  });
});
