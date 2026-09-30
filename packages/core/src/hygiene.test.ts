import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import type { FormatOptionsInput } from './options.ts';

const out = (src: string, options?: FormatOptionsInput) => format(src, options).output;

describe('BLK-11 byte order mark and line endings', () => {
  test('strips a byte order mark', () => {
    assert.equal(out('\uFEFF# A\n'), '# A\n');
  });
  test('normalises CRLF to LF by default', () => {
    assert.equal(out('# A\r\n\r\ntext\r\n'), '# A\n\ntext\n');
  });
  test('normalises a lone CR', () => {
    assert.equal(out('# A\rtext\r'), '# A\n\ntext\n');
  });
  test('emits CRLF when asked', () => {
    assert.equal(out('# A\n', { endOfLine: 'crlf' }), '# A\r\n');
  });
  test('auto preserves a detected CRLF', () => {
    assert.equal(out('# A\r\n\r\ntext\r\n', { endOfLine: 'auto' }), '# A\r\n\r\ntext\r\n');
  });
  test('auto preserves a detected LF', () => {
    assert.equal(out('# A\n\ntext\n', { endOfLine: 'auto' }), '# A\n\ntext\n');
  });
  test('adds a final newline when one is missing', () => {
    assert.equal(out('# A'), '# A\n');
  });
});

describe('BLK-11 whitespace', () => {
  test('trims trailing whitespace', () => {
    assert.equal(out('# A   \n\ntext  \n'), '# A\n\ntext\n');
  });
  test('preserves a hard break', () => {
    assert.equal(out('first  \nsecond\n'), 'first  \nsecond\n');
  });
  test('expands a hard tab that is not leading indentation', () => {
    assert.equal(out('- a\tb\n'), '- a  b\n');
  });
  test('honours a four space indent width', () => {
    assert.equal(out('- a\tb\n', { list: { tabWidth: 4 } }), '- a    b\n');
  });
  test('leaves tabs alone when the indent width is tab', () => {
    assert.equal(out('- a\tb\n', { list: { tabWidth: 0 } }), '- a\tb\n');
  });
  test('leaves a tab that already opens an indented code block alone', () => {
    const src = '\t- item\n';
    assert.equal(out(src), src);
  });
  test('never trims inside a fence', () => {
    const src = '```\ncode   \n```\n';
    assert.equal(out(src), src);
  });
  test('never expands tabs inside a fence', () => {
    const src = '```\na\tb\n```\n';
    assert.equal(out(src), src);
  });
  test('never touches front matter', () => {
    const src = '---\na:\tb  \n---\n\ntext\n';
    assert.equal(out(src), src);
  });
});
