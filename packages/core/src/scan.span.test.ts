import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanRegions } from './scan.ts';

const slices = (src: string) =>
  scanRegions(src).map((region) => [region.kind, src.slice(region.start, region.end)] as const);

describe('scan: inline code span boundaries', () => {
  test('never pairs backticks across a blank line', () => {
    const src = 'an unmatched ` tick\n\nmore text and a closing ` tick\n';
    assert.deepEqual(slices(src), []);
  });
  test('still pairs across a single line break', () => {
    const src = 'a `spans\ntwo lines` b\n';
    assert.deepEqual(slices(src), [['inlineCode', '`spans\ntwo lines`']]);
  });
});

describe('scan: a span never opens on a block region', () => {
  // A fence delimiter is three backticks, which the span matcher read as a span
  // opener. The pair it found was rejected because a fence already claimed those
  // bytes, but the matcher still jumped to the end of the pair - skipping every
  // backtick in between, so a real span there was left to the prose rules.
  test('a failed span does not skip the prose between two fences', () => {
    const src = '```\na\n\nb\n```\n把 `x` 中文写好看\n```\nc\n```\n';
    assert.deepEqual(slices(src), [
      ['fencedCode', '```\na\n\nb\n```'],
      ['inlineCode', '`x`'],
      ['fencedCode', '```\nc\n```'],
    ]);
  });

  test('a backtick inside a fence opens nothing', () => {
    const src = '```\n`a\n```\n';
    assert.deepEqual(slices(src), [['fencedCode', '```\n`a\n```']]);
  });
});
