import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { defaultOptions, normalizeFullwidthAlphanumerics, normalizePunctuation } from './index.ts';
import { normalizeParens } from './widths.ts';

/**
 * The three width passes rewrite one character for one character. That property
 * is what makes it possible to compute one protected-region mask and use it for
 * all three: offsets never move, so the mask stays aligned.
 *
 * The property is asserted rather than assumed because a future pass that
 * changed a length would silently shift the mask and corrupt whatever followed
 * it - and the failure would look like a bug in the pass, not in the sharing.
 */
describe('the width passes preserve offsets', () => {
  const typo = defaultOptions.typography;
  const CASES = [
    '中文abc,中文',
    '他说"你好"。',
    '（括号）and (parens)',
    '１２３ and 123',
    'a——b……c',
    '1,000 and 2.5 and e.g.',
    '《书名》「引用」',
    '<a href="x">链接</a>',
    '#标题\n\n中文abc,中文\n',
    '>quote 中文abc\n',
    '- 项目 one, 二\n',
    '```js\nconst a=1;// 中文\n```\n',
  ];

  test('every pass returns the same number of characters', () => {
    for (const source of CASES) {
      assert.equal(
        normalizeFullwidthAlphanumerics(source, typo).length,
        source.length,
        'normalizeFullwidthAlphanumerics changed the length of ' + JSON.stringify(source),
      );
      assert.equal(
        normalizePunctuation(source, typo).length,
        source.length,
        'normalizePunctuation changed the length of ' + JSON.stringify(source),
      );
      assert.equal(
        normalizeParens(source, typo).length,
        source.length,
        'normalizeParens changed the length of ' + JSON.stringify(source),
      );
    }
  });

  test('the passes actually do something, so the property is not vacuous', () => {
    const source = '中文abc,中文（括号）１２３';
    const touched =
      normalizeFullwidthAlphanumerics(source, typo) !== source ||
      normalizePunctuation(source, typo) !== source ||
      normalizeParens(source, typo) !== source;
    assert.ok(touched, 'if no pass ever rewrites anything, length preservation means nothing');
  });
});
