import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('BLK-06 ordered list renumbering', () => {
  test('renumbers a broken sequence', () => {
    assert.equal(out('1. a\n5. b\n9. c\n'), '1. a\n2. b\n3. c\n');
  });
  test('honours a declared start', () => {
    assert.equal(out('3. a\n4. b\n'), '3. a\n4. b\n');
    assert.equal(out('3. a\n9. b\n'), '3. a\n4. b\n');
  });
  test('preserves the lazy all-ones style', () => {
    assert.equal(out('1. a\n1. b\n1. c\n'), '1. a\n1. b\n1. c\n');
  });
  test('renumbers at every nesting level', () => {
    assert.equal(out('1. a\n   1. x\n   5. y\n2. b\n'), '1. a\n   1. x\n   2. y\n2. b\n');
  });
  test('keeps numbering across a loose list', () => {
    assert.equal(out('1. a\n\n7. b\n'), '1. a\n\n2. b\n');
  });
  test('starts a new list after a paragraph', () => {
    assert.equal(out('1. a\n\ntext\n\n5. b\n'), '1. a\n\ntext\n\n5. b\n');
  });
  test('an all-ones list is left alone by default', () => {
    assert.equal(out('1. a\n1. b\n'), '1. a\n1. b\n');
  });

  test('renumber numbers an all-ones list anyway', () => {
    assert.equal(
      out('1. a\n1. b\n', { list: { orderedStyle: 'renumber' } }),
      '1. a\n2. b\n',
    );
  });

  test('preserve changes no number at all', () => {
    assert.equal(
      out('1. a\n5. b\n9. c\n', { list: { orderedStyle: 'preserve' } }),
      '1. a\n5. b\n9. c\n',
    );
    assert.equal(
      out('1. a\n1. b\n', { list: { orderedStyle: 'preserve' } }),
      '1. a\n1. b\n',
    );
  });
  test('delimiter can be normalised', () => {
    assert.equal(out('1) a\n2) b\n', { list: { orderedDelimiter: '.' } }), '1. a\n2. b\n');
  });
  test('delimiter is preserved by default', () => {
    assert.equal(out('1) a\n2) b\n'), '1) a\n2) b\n');
  });
  test('never renumbers inside a code fence', () => {
    const src = '```\n1. a\n9. b\n```\n';
    assert.equal(out(src), src);
  });
  test('does not disturb unordered lists', () => {
    assert.equal(out('- a\n- b\n'), '- a\n- b\n');
  });

  // A blockquote prefix hid the whole list from this pass: ORDERED anchors at
  // the start of the line, so '> 1. a' matched nothing and a broken sequence
  // inside a quote was never renumbered. The prefix is now split off, matched
  // against, and put back.
  describe('inside a blockquote', () => {
    test('renumbers a broken sequence', () => {
      assert.equal(out('> 1. a\n> 3. b\n'), '> 1. a\n> 2. b\n');
    });
    test('keeps the lazy all-ones style', () => {
      assert.equal(out('> 1. a\n> 1. b\n'), '> 1. a\n> 1. b\n');
    });
    test('honours a declared start', () => {
      assert.equal(out('> 5. a\n> 9. b\n'), '> 5. a\n> 6. b\n');
    });
    test('keeps an indented quote marker', () => {
      assert.equal(out('  > 1. a\n  > 3. b\n'), '  > 1. a\n  > 2. b\n');
    });
    test('a quoted list and a top-level list are different lists', () => {
      assert.equal(
        out('> 1. a\n> 3. b\n\n1. c\n3. d\n'),
        '> 1. a\n> 2. b\n\n1. c\n2. d\n',
      );
    });
    test('each quote depth is its own list', () => {
      assert.equal(
        out('> > 1. a\n> > 3. b\n> 1. c\n> 3. d\n'),
        '> > 1. a\n> > 2. b\n> 1. c\n> 2. d\n',
      );
    });
    test('a quoted paragraph ends the list', () => {
      assert.equal(
        out('> 1. a\n> 3. b\n>\n> text\n>\n> 1. c\n> 3. d\n'),
        '> 1. a\n> 2. b\n>\n> text\n>\n> 1. c\n> 2. d\n',
      );
    });
    test('is idempotent', () => {
      const once = out('> 1. a\n> 3. b\n');
      assert.equal(out(once), once);
    });
  });
});
