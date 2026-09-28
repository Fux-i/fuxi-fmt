import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../../core/src/index.ts';
import { applyEdits, computeEdits, documentEdits, editsInRange } from './edits.ts';

const CORPUS = [
  '#介绍\n\n\n本项目 使用Vue3开发,性能提升50%。\n\n1. 安装\n5. 启动\n',
  '---\ntitle: 标题\n---\n\n#标题\n',
  '```js\nconst a=1;// 中文\n```\n',
  '>quote\n>>nested\n',
  '- [ ]  待办\n- [x]  已完成\n',
  '~~~js\nx\n~~~\n',
  'a\n\ntext\n\n5. b\n',
];

describe('GRT-06 minimal edits', () => {
  test('a clean document yields no edits at all', () => {
    assert.deepEqual(computeEdits('# A\n', '# A\n'), []);
  });
  test('a localised change does not span the untouched tail', () => {
    const before = '#标题\n\nbody line one\n\nbody line two\n';
    const after = '# 标题\n\nbody line one\n\nbody line two\n';
    const edits = computeEdits(before, after);
    assert.equal(edits.length, 1);
    const edit = edits[0];
    assert.ok(edit !== undefined);
    assert.ok(edit.end <= 3, 'the edit must not reach into the body, got end=' + String(edit.end));
  });
  test('applying the edits reproduces what format() returns exactly', () => {
    for (const source of CORPUS) {
      assert.equal(applyEdits(source, documentEdits(source, {})), format(source).output);
    }
  });
  test('a selection only receives the edits inside it', () => {
    const edits = documentEdits('#标题\n\nbody\n', {});
    assert.equal(editsInRange(edits, 0, 0).length, 1);
    assert.equal(editsInRange(edits, 2, 2).length, 0);
  });
  test('formatted output needs no further edits', () => {
    for (const source of CORPUS) {
      const once = applyEdits(source, documentEdits(source, {}));
      assert.deepEqual(
        documentEdits(once, {}),
        [],
        'format on save must settle in one pass: ' + JSON.stringify(source),
      );
    }
  });
  test('edits are ordered and do not overlap', () => {
    for (const source of CORPUS) {
      const edits = documentEdits(source, {});
      for (let i = 1; i < edits.length; i++) {
        const previous = edits[i - 1];
        const current = edits[i];
        assert.ok(previous !== undefined && current !== undefined);
        assert.ok(previous.end <= current.start, 'edits overlap');
      }
    }
  });
  test('a document needing no change produces no edits', () => {
    assert.deepEqual(documentEdits('# A\n\ntext\n', {}), []);
  });
  test('options reach the formatter', () => {
    const edits = documentEdits('- item\n', { list: { unorderedMarker: 'asterisks' } });
    assert.equal(applyEdits('- item\n', edits), '* item\n');
  });
});
