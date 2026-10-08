/**
 * CFG-07: retired names are read for one release and reported.
 *
 * Renaming an option is cheap for the code and expensive for the user: a key that
 * silently stops working produces no error, no change, and no clue. Each entry in
 * the table gets a test that the old name still has an effect, and one that the
 * effect is the effect the new name would have had - an alias that parses but
 * means something else is worse than no alias.
 *
 * Spec references: CFG-07.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, parseConfigDetailed } from './config.ts';
import { defaultOptions, resolveOptions } from './options.ts';

const noticesOf = (json: string) => parseConfigDetailed(json).notices;

describe('CFG-07 retired configuration names', () => {
  test('typography.symbolWhitelist still sets the symbol set', () => {
    const old = parseConfig('{"typography":{"symbolWhitelist":["§"]}}');
    const next = parseConfig('{"typography":{"spacingSymbols":["§"]}}');
    assert.deepEqual(old.typography?.spacingSymbols, ['§']);
    assert.deepEqual(old, next);
  });

  test('typography.punctuationAllowlist still sets the change list', () => {
    const old = parseConfig('{"typography":{"punctuationAllowlist":[","]}}');
    assert.deepEqual(old.typography?.punctuationChangeList, [',']);
  });

  test('codeBlock.normalizeLength still sets the fence length flag', () => {
    const old = parseConfig('{"codeBlock":{"normalizeLength":false}}');
    assert.equal(resolveOptions(old).codeBlock.fenceLength, false);
  });

  test('blankLines.insideLists true becomes one and false becomes remove', () => {
    assert.equal(
      resolveOptions(parseConfig('{"blankLines":{"insideLists":true}}')).blankLines.insideLists,
      'one',
    );
    assert.equal(
      resolveOptions(parseConfig('{"blankLines":{"insideLists":false}}')).blankLines.insideLists,
      'remove',
    );
  });

  test('typography.semicolon is folded into the change list', () => {
    const off = parseConfig('{"typography":{"semicolon":false}}');
    assert.ok(!(off.typography?.punctuationChangeList ?? []).includes(';'));
    const on = parseConfig('{"typography":{"semicolon":true}}');
    assert.ok((on.typography?.punctuationChangeList ?? []).includes(';'));
  });

  test('list.indentWidth becomes the two indents that mean the same thing', () => {
    const four = resolveOptions(parseConfig('{"list":{"indentWidth":4}}')).list;
    assert.equal(four.orderedIndent, 4);
    assert.equal(four.unorderedIndent, 4);
    const two = resolveOptions(parseConfig('{"list":{"indentWidth":2}}')).list;
    assert.equal(two.orderedIndent, 'aligned');
    assert.equal(two.unorderedIndent, 'aligned');
  });

  test('a retired name is reported, naming both names', () => {
    const notices = noticesOf('{"typography":{"symbolWhitelist":["§"]}}');
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.kind, 'renamed');
    assert.equal(notices[0]?.key, 'typography.symbolWhitelist');
    assert.match(notices[0]?.message ?? '', /typography\.spacingSymbols/);
  });

  test('the new name wins when both are present, and the old one is still reported', () => {
    const parsed = parseConfigDetailed(
      '{"typography":{"symbolWhitelist":["§"],"spacingSymbols":["%"]}}',
    );
    assert.deepEqual(parsed.options.typography?.spacingSymbols, ['%']);
    assert.equal(parsed.notices.length, 1);
  });

  test('an unknown key is reported and does not stop the configuration loading', () => {
    const parsed = parseConfigDetailed('{"typography":{"cjkSpacing":false},"typo":{"x":1}}');
    assert.equal(parsed.options.typography?.cjkSpacing, false);
    assert.equal(parsed.notices.length, 1);
    assert.equal(parsed.notices[0]?.kind, 'unknown');
    assert.equal(parsed.notices[0]?.key, 'typo');
  });

  test('an unknown leaf is reported with its section', () => {
    const notices = noticesOf('{"typography":{"cjkSpacings":true}}');
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.key, 'typography.cjkSpacings');
  });

  test('a configuration with nothing wrong reports nothing', () => {
    assert.deepEqual(noticesOf('{"typography":{"cjkSpacing":false}}'), []);
  });

  test('the preset key is an option, not a typo', () => {
    assert.deepEqual(noticesOf('{"preset":"default"}'), []);
  });

  test('every top-level option the resolver knows is an option, not a typo', () => {
    const stated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaultOptions)) {
      stated[key] = typeof value === 'object' && value !== null ? {} : value;
    }
    const parsed = parseConfigDetailed(JSON.stringify(stated));
    assert.deepEqual(parsed.notices.map((notice) => notice.key), []);
  });
});
