import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findConfigFile, loadOptionsFor, mergeOptions, parseConfig } from './config.ts';
import { format } from './format.ts';
import { resolveOptions } from './options.ts';

const fixtures = new URL('../test/fixtures/', import.meta.url).pathname;
const fixture = (rel: string) => fixtures + rel;

describe('CFG-01 parsing a configuration document', () => {
  test('parses a plain JSON config', () => {
    assert.deepEqual(parseConfig('{"list": {"unorderedMarker": "asterisks"}}'), {
      list: { unorderedMarker: 'asterisks' },
    });
  });
  test('accepts comments and a trailing comma', () => {
    assert.deepEqual(parseConfig('{\n  // which endings\n  "endOfLine": "crlf",\n}'), {
      endOfLine: 'crlf',
    });
  });
  test('does not treat a comment marker inside a string as a comment', () => {
    assert.deepEqual(
      parseConfig('{"typography": {"punctuationAllowlist": ["//", "/*"]}}'),
      { typography: { punctuationAllowlist: ['//', '/*'] } },
    );
  });
  test('rejects a malformed document', () => {
    assert.throws(() => parseConfig('{'), /config/i);
  });
  test('rejects an unknown value for a known key', () => {
    assert.throws(() => parseConfig('{"endOfLine": "bogus"}'), /endOfLine/);
    assert.throws(() => parseConfig('{"blankLines": {"maxConsecutive": "lots"}}'), /maxConsecutive/);
    assert.throws(() => parseConfig('{"list": {"indentWidth": 3}}'), /indentWidth/);
  });
  test('ignores unknown keys', () => {
    assert.deepEqual(parseConfig('{"nope": 1, "endOfLine": "lf"}'), { endOfLine: 'lf' });
  });
  test('accepts an explicit null cap', () => {
    assert.deepEqual(parseConfig('{"blankLines": {"maxConsecutive": null}}'), {
      blankLines: { maxConsecutive: null },
    });
  });
});

describe('CFG-01 presets', () => {
  test('a preset supplies values the config did not state', () => {
    const resolved = resolveOptions(parseConfig('{ "preset": "strict-commonmark" }'));
    assert.equal(resolved.list.unorderedMarker, 'preserve');
    assert.equal(resolved.typography.punctuationStyle, 'off');
    assert.equal(resolved.typography.cjkSpacing, true, 'spacing is the point of the tool');
  });
  test('explicit options win over the preset', () => {
    const resolved = resolveOptions(
      parseConfig('{ "preset": "strict-commonmark", "list": { "unorderedMarker": "dashes" } }'),
    );
    assert.equal(resolved.list.unorderedMarker, 'dashes');
  });
  test('an unknown preset is rejected rather than ignored', () => {
    assert.throws(() => parseConfig('{ "preset": "hugo" }'), /unknown preset/);
  });
  test('the default preset is the shipped defaults', () => {
    assert.deepEqual(parseConfig('{ "preset": "default" }'), {});
  });
});

describe('CFG-01 merging layers', () => {
  test('later layers win key by key', () => {
    assert.deepEqual(
      mergeOptions(
        { list: { unorderedMarker: 'asterisks', indentWidth: 4 } },
        { list: { unorderedMarker: 'dashes' } },
      ),
      { list: { unorderedMarker: 'dashes', indentWidth: 4 } },
    );
  });
  test('an empty override changes nothing', () => {
    assert.deepEqual(mergeOptions({ endOfLine: 'crlf' }, {}), { endOfLine: 'crlf' });
  });
  test('sections are merged, not replaced', () => {
    const merged = mergeOptions({ typography: { cjkSpacing: false } }, { typography: {} });
    assert.deepEqual(merged, { typography: { cjkSpacing: false } });
  });
});

describe('CFG-01 discovering a configuration file', () => {
  test('finds the nearest file while walking upwards', () => {
    assert.equal(findConfigFile(fixture('config/nested/deep'), fixtures), fixture('config/fuxi-fmt.json'));
  });
  test('returns null when there is none', () => {
    assert.equal(findConfigFile(fixture('noconfig'), fixtures), null);
  });
  test('loads the options that apply to a file', () => {
    const loaded = loadOptionsFor(fixture('config/nested/deep/doc.md'));
    assert.equal(loaded.configPath, fixture('config/fuxi-fmt.json'));
    assert.deepEqual(loaded.options, { list: { unorderedMarker: 'asterisks' } });
  });
  test('a loaded config actually drives the formatter', () => {
    const loaded = loadOptionsFor(fixture('config/nested/deep/doc.md'));
    assert.equal(format('- item\n', loaded.options).output, '* item\n');
  });
  test('a file with no config gets the defaults', () => {
    const loaded = loadOptionsFor(fixture('noconfig/doc.md'));
    assert.deepEqual(loaded, { options: {}, configPath: null });
  });
});
