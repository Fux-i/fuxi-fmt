import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOptions, parseConfig } from './config.ts';
import { format } from './format.ts';

/**
 * CFG-03. The ignore directive names are configuration, but readSections and
 * mergeOptions had no branch for them: a fuxi-fmt.json could not set them, and
 * the editor's settings layer dropped them on the way through. Four options that
 * only worked when format() was called directly.
 */
describe('the ignore section is configurable', () => {
  test('a config file can name every directive', () => {
    const parsed = parseConfig(
      '{"ignore":{"file":"f","start":"s","end":"e","line":"l"}}',
    );
    assert.deepEqual(parsed.ignore, { file: 'f', start: 's', end: 'e', line: 'l' });
  });

  test('only the keys that are present are read', () => {
    assert.deepEqual(parseConfig('{"ignore":{"line":"l"}}').ignore, { line: 'l' });
  });

  test('an empty directive name is rejected rather than silently ignored', () => {
    assert.throws(() => parseConfig('{"ignore":{"line":""}}'), /non-empty string/);
    assert.throws(() => parseConfig('{"ignore":{"line":42}}'), /non-empty string/);
  });

  test('a non-object ignore section is rejected', () => {
    assert.throws(() => parseConfig('{"ignore":"nope"}'), /must be an object/);
  });

  test('merge keeps ignore from both layers, key by key', () => {
    const merged = mergeOptions({ ignore: { file: 'a', line: 'b' } }, { ignore: { line: 'c' } });
    assert.deepEqual(merged.ignore, { file: 'a', line: 'c' });
  });

  test('a configured directive name reaches the formatter', () => {
    const source = '<!-- skip-me -->\n#标题\n';
    assert.equal(format(source, { ignore: { line: 'skip-me' } }).output, source);
    assert.notEqual(format(source, {}).output, source);
  });

  test('typography.spacingSymbols is readable from a config file too', () => {
    // Added in 0.21.0 and equally absent from readSections.
    const parsed = parseConfig('{"typography":{"spacingSymbols":["+","§"]}}');
    assert.deepEqual(parsed.typography?.spacingSymbols, ['+', '§']);
  });
});
