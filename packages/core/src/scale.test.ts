import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';
import { checkSemantics } from './guard.ts';
import { scanRegions } from './scan.ts';

/**
 * The hand written tests are all small. This one builds a document the size of
 * a real Chinese technical article and pushes it through the whole pipeline.
 *
 * It is deterministic: a fixed generator, no randomness, so a failure is
 * reproducible.
 */

function buildDocument(sections: number): string {
  const parts: string[] = ['---', 'title: 规模测试', 'tags:', '  - perf', '---', ''];
  for (let s = 1; s <= sections; s++) {
    parts.push('## ' + String(s) + ' 第' + String(s) + '节说明');
    parts.push('');
    parts.push('本节讨论' + 'Kubernetes'.repeat(1) + '中的调度问题,以及' + String(s) + '个节点的容量规划。');
    parts.push('常用取值有100%、3.5和state-of-the-art几种写法。');
    parts.push('');
    parts.push('- 要点一' + String(s));
    parts.push('- 要点二，含`inline code`与`s`');
    parts.push('');
    parts.push('1. 第一步');
    parts.push('9. 第二步');
    parts.push('');
    parts.push('```yaml');
    parts.push('replicas: ' + String(s) + '   # 中文注释保留');
    parts.push('image: nginx:1.25');
    parts.push('```');
    parts.push('');
    parts.push('| 参数 | 说明 |');
    parts.push('| --- | --- |');
    parts.push('| replicas | 副本数' + String(s) + ' |');
    parts.push('');
    parts.push('> 引用一段' + String(s) + '，保持原样。');
    parts.push('');
  }
  return parts.join('\n') + '\n';
}

describe('scale: a document the size of a real article', () => {
  const source = buildDocument(200);

  test('the fixture is large enough to be meaningful', () => {
    const lines = source.split('\n').length;
    assert.ok(lines > 3000, 'expected a few thousand lines, got ' + String(lines));
  });

  test('the guard holds', () => {
    const result = format(source);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(checkSemantics(source, result.output), []);
  });

  test('it settles in one pass', () => {
    const once = format(source).output;
    const twice = format(once).output;
    assert.equal(twice, once);
  });

  test('every protected region survives byte for byte', () => {
    const before = scanRegions(source);
    const after = scanRegions(format(source).output);
    assert.equal(after.length, before.length);
  });

  test('it finishes in reasonable time', () => {
    const started = Date.now();
    format(source);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 3000, 'formatting took ' + String(elapsed) + ' ms');
  });
});
