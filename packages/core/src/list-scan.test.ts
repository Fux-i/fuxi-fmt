import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanListItems } from './list-scan.ts';

describe('BLK-08 list item scanning', () => {
  test('records the marker and content columns of a flat item', () => {
    assert.deepEqual(scanListItems(['- a']), [
      { line: 0, prefix: '', indent: 0, marker: '-', contentColumn: 2, ordered: false, content: 'a' },
    ]);
  });

  test('reads an item from inside its block quote, indent relative to the prefix', () => {
    // BLK-14: a quoted list is a list. The indentation is measured from the
    // content, so a nested quoted item keeps its nesting rather than being read as
    // a flat item at the column the '>' happens to occupy.
    const items = scanListItems(['> - a', '>   - b']);
    assert.equal(items[0]?.indent, 0);
    assert.equal(items[1]?.indent, 2);
    assert.equal(items[1]?.prefix, '> ');
    assert.equal(items[1]?.contentColumn, 4);
  });

  test('keeps the indentation rather than inferring depth from it', () => {
    const items = scanListItems(['  - nested']);
    assert.equal(items[0]?.indent, 2);
    assert.equal(items[0]?.contentColumn, 4);
  });

  test('measures an ordered marker by its width, not its value', () => {
    assert.equal(scanListItems(['9. nine'])[0]?.contentColumn, 3);
    assert.equal(scanListItems(['10. ten'])[0]?.contentColumn, 4);
    assert.equal(scanListItems(['10) ten'])[0]?.contentColumn, 4);
    assert.equal(scanListItems(['10. ten'])[0]?.ordered, true);
  });

  test('treats a task box as content', () => {
    assert.equal(scanListItems(['- [ ] todo'])[0]?.contentColumn, 2);
    assert.equal(scanListItems(['- [ ] todo'])[0]?.content, '[ ] todo');
  });

  test('every bullet character is a marker', () => {
    for (const bullet of ['-', '*', '+']) {
      assert.equal(scanListItems([bullet + ' x'])[0]?.marker, bullet);
    }
  });

  test('prose is not a list', () => {
    assert.deepEqual(scanListItems(['# Heading', 'text', '> quote', '']), []);
  });

  test('emphasis is not a marker, because the grammar wants a space', () => {
    assert.deepEqual(scanListItems(['*emphasis*', '**strong**', '2.5 is not a list']), []);
  });

  test('a marker with no trailing space is not recognised, as documented', () => {
    assert.deepEqual(scanListItems(['-', '1.']), []);
  });

  test('records the source line of each item', () => {
    const items = scanListItems(['text', '- one', 'more text', '  - two']);
    assert.deepEqual(
      items.map((item) => item.line),
      [1, 3],
    );
  });
});
