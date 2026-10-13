/**
 * CFG-01: one vocabulary for the option surface.
 *
 * Every closed vocabulary - the markers, the styles, the widths - is declared once,
 * and the config reader walks that declaration instead of re-listing the members.
 * Before this the members lived twice, as a union type and again as an array inside
 * the reader, which is how an option came to exist in the defaults and never be
 * parsed from a file: the suite's own note says that happened four times, and one
 * of them sat dead for twenty releases.
 *
 * Spec references: CFG-01, CFG-02.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OPTION_VOCABULARY, defaultOptions, resolveOptions } from './options.ts';

const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Set);

/** Every leaf path of a nested table, as 'section.leaf' (or 'leaf' at the root). */
function leaves(node: unknown, prefix = ''): string[] {
  if (!isPlain(node)) return prefix === '' ? [] : [prefix];
  if ('kind' in node) return [prefix];
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    out.push(...leaves(value, prefix === '' ? key : prefix + '.' + key));
  }
  return out;
}

function at(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const part of path.split('.')) {
    if (!isPlain(node)) return undefined;
    node = node[part];
  }
  return node;
}

describe('CFG-01 the option vocabulary', () => {
  test('it names every leaf of the resolved options, and no others', () => {
    assert.deepEqual(leaves(OPTION_VOCABULARY).sort(), leaves(defaultOptions).sort());
  });

  test('resolving nothing yields every leaf the vocabulary names', () => {
    assert.deepEqual(leaves(resolveOptions({})).sort(), leaves(OPTION_VOCABULARY).sort());
  });

  test('every closed vocabulary admits its own default', () => {
    const walk = (node: unknown, path: string): void => {
      if (isPlain(node) && 'kind' in node) {
        if (node.kind !== 'oneOf') return;
        const values = node.values as readonly unknown[];
        const fallback = at(defaultOptions, path);
        assert.ok(
          values.includes(fallback),
          path + ': default ' + String(fallback) + ' is not one of ' + values.join(' | '),
        );
        return;
      }
      if (!isPlain(node)) return;
      for (const [key, value] of Object.entries(node)) {
        walk(value, path === '' ? key : path + '.' + key);
      }
    };
    walk(OPTION_VOCABULARY, '');
  });
});
