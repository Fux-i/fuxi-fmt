import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultOptions } from './options.ts';

/**
 * The extension's settings live in a static JSON manifest while the real option
 * surface lives here. Two lists maintained by hand drift; this is the same
 * two-way audit that caught a documented-but-nonexistent option and an
 * existing-but-undeclared one, pointed at package.json instead of the spec.
 */

const root = new URL('../../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('packages/vscode/package.json', root), 'utf8')) as {
  contributes?: { configuration?: { properties?: Record<string, unknown> } };
};
const properties = manifest.contributes?.configuration?.properties ?? {};
const PREFIX = 'fuxiFmt.';
const NOT_OPTIONS = new Set(['enable', 'config']);

interface Schema {
  readonly default?: unknown;
  readonly scope?: string;
  readonly markdownDescription?: string;
  readonly description?: string;
}

function corePaths(): string[] {
  const paths: string[] = [];
  for (const [section, value] of Object.entries(defaultOptions)) {
    if (value !== null && typeof value === 'object' && !(value instanceof Set)) {
      for (const leaf of Object.keys(value as Record<string, unknown>)) paths.push(section + '.' + leaf);
    } else {
      paths.push(section);
    }
  }
  return paths.sort();
}

function settingPaths(): string[] {
  return Object.keys(properties)
    .filter((id) => id.startsWith(PREFIX))
    .map((id) => id.slice(PREFIX.length))
    .filter((path) => !NOT_OPTIONS.has(path))
    .sort();
}

function defaultOf(path: string): unknown {
  const [section, leaf] = path.split('.');
  const value = (defaultOptions as unknown as Record<string, unknown>)[section ?? ''];
  if (leaf === undefined) return value;
  return (value as Record<string, unknown>)[leaf];
}

describe('every option is a setting, and every setting is an option', () => {
  test('the two lists are identical', () => {
    assert.deepEqual(settingPaths(), corePaths());
  });

  test('each setting carries the core default', () => {
    for (const path of corePaths()) {
      const schema = properties[PREFIX + path] as Schema | undefined;
      assert.ok(schema !== undefined, 'no setting for ' + path);
      const expected = defaultOf(path);
      assert.deepEqual(
        schema.default,
        expected instanceof Set ? [...expected] : expected,
        'default mismatch for ' + path,
      );
    }
  });

  test('every setting is resource-scoped, so per-folder and [markdown] overrides work', () => {
    for (const [id, value] of Object.entries(properties)) {
      assert.equal((value as Schema).scope, 'resource', id + ' is not resource-scoped');
    }
  });

  test('every setting is documented for the Settings UI', () => {
    for (const [id, value] of Object.entries(properties)) {
      const schema = value as Schema;
      assert.ok(
        schema.markdownDescription !== undefined || schema.description !== undefined,
        id + ' has no description',
      );
    }
  });
});
