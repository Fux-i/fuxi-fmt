/**
 * BLK-14 × BLK-01/02/03: blank lines inside a block quote.
 *
 * The policy is applied per level, because a blank line's level is structure: a
 * '>' line is a blank inside the quote, an empty line ends it, and only a blank
 * of the same level as the two blocks it separates may be added or removed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options: FormatOptionsInput = {}): string => format(src, options).output;

describe('BLK-03 inside a block quote', () => {
  test('the blank between two items of one quoted list is removed', () => {
    assert.equal(out('> 1. a\n>\n> 1. b\n'), '> 1. a\n> 1. b\n');
  });

  test('the minimal repro: a quoted list with a quoted blank in the middle', () => {
    const src = '> 1. 1\n> 1. 00\n>\n> 1. 333\n>    1. 22\n>    2. 22\n> hello\n';
    assert.equal(out(src), '> 1. 1\n> 1. 00\n> 1. 333\n>    1. 22\n>    2. 22\n> hello\n');
  });

  test('the same at depth two', () => {
    assert.equal(out('> > 1. a\n> >\n> > 1. b\n'), '> > 1. a\n> > 1. b\n');
  });

  test('preserve leaves the quoted blank alone', () => {
    const src = '> 1. a\n>\n> 1. b\n';
    assert.equal(out(src, { blankLines: { insideLists: 'preserve' } }), src);
  });

  test('an empty line between two quotes is never removed', () => {
    // Two blockquotes, each with one item. Removing the empty line would merge
    // them into one quote holding a loose list - a different document, and one
    // the guard cannot see, because a blank line is not a line it counts.
    const src = '> 1. a\n\n> 1. b\n';
    assert.equal(out(src), src);
  });

  test('a blank between two different markers is kept, quoted like anywhere else', () => {
    assert.equal(out('> - a\n>\n> 1. b\n'), '> - a\n>\n> 1. b\n');
  });

  test('the result settles in one pass', () => {
    const once = out('> 1. a\n>\n> 1. b\n>\n> 1. c\n');
    assert.equal(out(once), once);
  });
});
describe('BLK-03 inside a block quote, the other direction', () => {
  test('one inserts a quoted blank between two quoted items', () => {
    assert.equal(
      out('> - a\n> - b\n', { blankLines: { insideLists: 'one' } }),
      '> - a\n>\n> - b\n',
    );
  });

  test('one inserts the blank at the depth the list lives at', () => {
    assert.equal(
      out('> > 1. a\n> > 1. b\n', { blankLines: { insideLists: 'one' } }),
      '> > 1. a\n> >\n> > 1. b\n',
    );
  });

  test('the inserted blank settles in one pass', () => {
    const options = { blankLines: { insideLists: 'one' as const } };
    const once = out('> - a\n> - b\n> - c\n', options);
    assert.equal(out(once, options), once);
  });
});

describe('BLK-01 inside a block quote', () => {
  test('a heading and the paragraph under it get a quoted blank', () => {
    assert.equal(out('> # 标题\n> 正文\n'), '> # 标题\n>\n> 正文\n');
  });

  test('the same one level deeper', () => {
    assert.equal(out('> > # 标题\n> > 正文\n'), '> > # 标题\n> >\n> > 正文\n');
  });

  test('a paragraph and the list under it too', () => {
    assert.equal(out('> 正文\n> - a\n'), '> 正文\n>\n> - a\n');
  });

  test('the blank that ends a quote is an empty line, not a quoted one', () => {
    assert.equal(out('> a\n>\n- list\n'), '> a\n\n- list\n');
    assert.equal(
      out('> a\n>\n- list\n', { blankLines: { insideBlockquotes: 'preserve' } }),
      '> a\n>\n\n- list\n',
    );
  });
});

describe('BLK-02 inside a block quote', () => {
  test('consecutive quoted blanks are capped', () => {
    assert.equal(out('> a\n>\n>\n> b\n'), '> a\n>\n> b\n');
  });

  test('an empty line is a quote boundary and is left alone', () => {
    assert.equal(out('> a\n>\n\n> b\n'), '> a\n\n> b\n');
  });
});

describe('BLK-14 insideBlockquotes', () => {
  test('trim drops the blank at the head and tail of the quote content', () => {
    assert.equal(out('>\n> a\n>\n'), '> a\n');
    assert.equal(out('> >\n> > a\n> >\n'), '> > a\n');
  });

  test('preserve keeps them where the author wrote them', () => {
    const options = { blankLines: { insideBlockquotes: 'preserve' as const } };
    assert.equal(out('>\n> a\n>\n', options), '>\n> a\n>\n');
    assert.equal(out('> >\n> > a\n> >\n', options), '> >\n> > a\n> >\n');
  });

  test('an empty line between two quotes is never an edge blank', () => {
    const preserve = { blankLines: { insideBlockquotes: 'preserve' as const } };
    assert.equal(out('> a\n\n> b\n'), '> a\n\n> b\n');
    assert.equal(out('> a\n\n> b\n', preserve), '> a\n\n> b\n');
  });
});

describe('BLK-14 the blank a rule keeps is byte for byte the author’s', () => {
  test('a quoted blank between two nested quotes is not re-spelled', () => {
    // '>' and '> >' are different documents: one splits the inner quote in two,
    // the other keeps it whole. Only the count is the policy's business.
    assert.equal(out('> > a\n>\n> > b\n'), '> > a\n>\n> > b\n');
    assert.equal(out('> > a\n> >\n> > b\n'), '> > a\n> >\n> > b\n');
  });

  test('the result settles in one pass', () => {
    for (const src of ['> a\n>\n> b\n', '> > a\n>\n> > b\n', '> # h\n> p\n']) {
      const once = out(src);
      assert.equal(out(once), once, 'not idempotent: ' + JSON.stringify(src));
    }
  });
});
