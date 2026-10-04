/**
 * The catalogue holds the two languages together (CFG-08).
 *
 * Nothing here checks the *quality* of a translation - that is a reader's job -
 * but everything mechanical is checked, because the failures are silent: a
 * Chinese sentence that dropped {0} loses a number, and a bundle that was not
 * regenerated means the editor answers in the wrong language with no error
 * anywhere.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MESSAGES, placeholdersOf, translate } from './messages.ts';

const L10N = new URL('../../vscode/l10n/', import.meta.url);

const read = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(name, L10N), 'utf8')) as Record<string, string>;

const entries = Object.entries(MESSAGES);

describe('the message catalogue', () => {
  test('every message is in both languages', () => {
    for (const [id, entry] of entries) {
      assert.ok(entry.en.length > 0, id + ' has no English');
      assert.ok(entry.zh.length > 0, id + ' has no Chinese');
    }
    assert.ok(entries.length >= 20, 'the catalogue shrank to ' + String(entries.length));
  });

  test('a translation uses the same placeholders as its English', () => {
    // This is the one that costs a number rather than a sentence: "{0} cells where
    // the header has {1}" translated without its placeholders still reads fine and
    // reports nothing.
    for (const [id, entry] of entries) {
      assert.deepEqual(
        placeholdersOf(entry.zh),
        placeholdersOf(entry.en),
        id + ' uses different placeholders in Chinese: ' + entry.zh,
      );
    }
  });

  test('the Chinese is actually Chinese', () => {
    const han = /[\u4e00-\u9fff]/;
    for (const [id, entry] of entries) {
      assert.ok(han.test(entry.zh), id + ' has no Han characters: ' + entry.zh);
    }
  });

  test('the English reads as a clause, not a sentence', () => {
    // The adapter prints the level and the rule id before it, so "WARNING[3] DET-06
    // Unmatched backtick" would read as two sentences.
    for (const [id, entry] of entries) {
      assert.match(entry.en, /^[a-z{]/, id + ' starts with a capital: ' + entry.en);
    }
  });
});

describe('the editor bundles are generated from the catalogue', () => {
  test('the English bundle is the catalogue, identity-mapped', () => {
    const expected: Record<string, string> = {};
    for (const entry of Object.values(MESSAGES)) expected[entry.en] = entry.en;
    assert.deepEqual(read('bundle.l10n.json'), expected);
  });

  test('the Chinese bundle is the catalogue, translated', () => {
    const expected: Record<string, string> = {};
    for (const entry of Object.values(MESSAGES)) expected[entry.en] = entry.zh;
    assert.deepEqual(read('bundle.l10n.zh-cn.json'), expected);
  });

  test('the manifest points the editor at the bundles', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../vscode/package.json', import.meta.url), 'utf8'),
    ) as { l10n?: string };
    assert.equal(manifest.l10n, './l10n');
  });
});

describe('translate', () => {
  test('Chinese for a Chinese locale, English for everything else', () => {
    const id = 'typo.unpairedQuote';
    assert.equal(translate(id, [], 'zh'), MESSAGES[id].zh);
    assert.equal(translate(id, [], 'zh-CN'), MESSAGES[id].zh);
    assert.equal(translate(id, [], 'zh-Hans'), MESSAGES[id].zh);
    assert.equal(translate(id, [], 'en'), MESSAGES[id].en);
    assert.equal(translate(id, [], 'de'), MESSAGES[id].en);
  });

  test('the values are placed in the translated sentence', () => {
    const zh = translate('det.tableRowRagged', [3, 2], 'zh');
    assert.match(zh, /3/);
    assert.match(zh, /2/);
    assert.doesNotMatch(zh, /\{\d\}/, 'a placeholder survived translation: ' + zh);
  });
});
