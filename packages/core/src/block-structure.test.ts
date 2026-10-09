/**
 * GRT-01 verified against a real parser.
 *
 * The runtime guard compares non-blank lines by kind. That is fast and
 * dependency-free, but it cannot see a paragraph move out of a block quote: the
 * lines are the same lines. This test renders the *block structure* with
 * markdown-it - the reference parser the benchmark report already uses - and
 * requires the structure of the output to be the structure of the input.
 *
 * markdown-it is a root devDependency for this file only. Nothing on the
 * formatting path imports it, and packages/core still ships with no
 * dependencies at all.
 *
 * Inline *content* is deliberately not compared: TYPO-01 and TYPO-07 rewrite
 * text, and a formatter is allowed to do that. What is compared is every block
 * and inline-container token, in order, with its nesting and depth.
 *
 * The check is deliberately strict: a document whose block structure changes on
 * purpose (TBL-01's join turns two paragraphs into a table; BLK-05 promotes a
 * paragraph to a heading) must be named in EXCEPTIONS with the rule that
 * explains it, so a new structural difference fails here instead of passing
 * silently.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { format } from './format.ts';

const md = new MarkdownIt();

/** The block skeleton: tokens in order, with nesting and depth, without inline content. */
function structure(source: string): string {
  return md
    .parse(source, {})
    .filter((token) => token.type !== 'inline')
    .map((token) => token.type + '|' + String(token.nesting) + '|' + String(token.level))
    .join('\n');
}

/** A fixture whose block structure changes on purpose, with the rule that says so. */
const EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  // Empty: every corpus fixture keeps its block structure. Add an entry here only
  // with the rule id that makes the difference intentional.
]);

const DIR = new URL('../test/fixtures/corpus/', import.meta.url);
const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.md') && !name.endsWith('.expected.md'))
  .sort();

const read = (name: string) => readFileSync(new URL(name, DIR), 'utf8');
const changesStructure = (name: string): boolean => {
  const input = read(name);
  return structure(format(input).output) !== structure(input);
};

describe('GRT-01 the block structure survives formatting', () => {
  for (const name of files) {
    test(name + ' keeps its block structure', () => {
      const input = read(name);
      assert.equal(structure(format(input).output), structure(input));
    });
  }

  test('the exception list is exactly the fixtures that change structure', () => {
    // Both directions, so a stale exception cannot hide a document that has since
    // settled, and a new difference cannot slip in unnamed.
    assert.deepEqual(
      files.filter((name) => changesStructure(name)),
      [...EXCEPTIONS.keys()],
      'a structural difference appeared or disappeared without the list saying so',
    );
  });

  const shapes: readonly (readonly [string, string])[] = [
    ['a lazy continuation inside a nested quote', '> > a\n> b\n'],
    ['a real block after a nested quote', '> > a\n> - b\n'],
    ['the reported nested-quote shape', '> 1. 333\n>    1. 2\n> > 1. 22\n> hello\n'],
    ['a multi-line HTML comment', '<!--\n- list\n# heading\n-->\n'],
    ['a code span wrapped across lines', '\u0060a\n# heading\nb\u0060\n'],
    ['a table row cut off by a blank line', '| a | b |\n| --- | --- |\n\n| 1 | 2 |\n'],
  ];
  for (const [name, input] of shapes) {
    test('the reported shape keeps its structure: ' + name, () => {
      assert.equal(structure(format(input).output), structure(input));
    });
  }

  test('TBL-01 is the documented exception: the join turns two paragraphs into a table', () => {
    // The one intentional block-structure change in the specification, named in
    // GRT-01's list. It is pinned here so the exception cannot quietly grow.
    const input = '| a | b |\n\n| --- | --- |\n';
    const output = format(input).output;
    assert.notEqual(structure(output), structure(input));
    assert.equal(output, '| a   | b   |\n| --- | --- |\n');
  });

  test('the blank the nested-quote report asked for would have changed the tree', () => {
    // This is why BLK-01 leaves '> hello' alone. Pinned against the parser, so
    // the decision is a measurement rather than an opinion.
    const input = '> > 1. 22\n> hello\n';
    const withBlank = '> > 1. 22\n>\n> hello\n';
    assert.notEqual(structure(withBlank), structure(input));
    assert.equal(structure(format(input).output), structure(input));
  });
});
