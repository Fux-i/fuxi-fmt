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

/**
 * Options deliberately not contributed as settings, with the reason.
 *
 * Each is asserted to still exist in the core, so a stale entry cannot hide an
 * option that was removed, and a new option still has to be decided about: make
 * it a setting or name it here.
 */
const NOT_SETTINGS: Record<string, string> = {
  'list.tabWidth': "VS Code already has editor.tabSize; a second one would be a second truth",
};

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
    .filter((path) => !NOT_OPTIONS.has(path) && !(path in NOT_SETTINGS))
    .sort();
}

function defaultOf(path: string): unknown {
  const [section, leaf] = path.split('.');
  const value = (defaultOptions as unknown as Record<string, unknown>)[section ?? ''];
  if (leaf === undefined) return value;
  return (value as Record<string, unknown>)[leaf];
}

function placeholders(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof node === 'string') {
    const match = /^%(\w[\w.]*)%$/.exec(node);
    if (match !== null) out.add(match[1] ?? '');
  } else if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) placeholders(value, out);
  }
  return out;
}

const LOCALES = ['package.nls.json', 'package.nls.zh-cn.json'];
const locale = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL('packages/vscode/' + name, root), 'utf8')) as Record<string, string>;

describe('the settings are localised, and stay localised', () => {
  test('every referenced string is defined in every locale', () => {
    // The manifest carries %keys%; a locale that is missing one shows the raw key
    // in the Settings panel, which is worse than English.
    const used = placeholders(manifest);
    assert.ok(used.size > 30, 'expected the manifest to reference many strings, saw ' + String(used.size));
    for (const name of LOCALES) {
      const table = locale(name);
      for (const key of used) {
        assert.ok(key in table, name + ' is missing ' + key);
      }
    }
  });

  test('no locale defines a string nothing references', () => {
    const used = placeholders(manifest);
    for (const name of LOCALES) {
      for (const key of Object.keys(locale(name))) {
        assert.ok(used.has(key), name + ' defines ' + key + ' but nothing uses it');
      }
    }
  });

  test('the locales define exactly the same keys', () => {
    const [first, ...rest] = LOCALES.map((name) => Object.keys(locale(name)).sort());
    for (let i = 0; i < rest.length; i++) {
      assert.deepEqual(rest[i], first, LOCALES[i + 1] + ' has drifted from ' + LOCALES[0]);
    }
  });

  test('the packaging whitelist ships every locale file', () => {
    // package-vsix.mjs stages an explicit file list rather than walking the
    // directory, so a new locale file is silently left out of the package - and
    // the extension still installs, showing every description as a raw %key%.
    const script = readFileSync(new URL('packages/vscode/package-vsix.mjs', root), 'utf8');
    const shipped = /const SHIPPED = \[([\s\S]*?)\]/.exec(script)?.[1] ?? '';
    assert.ok(shipped.length > 0, 'could not read the SHIPPED list');
    for (const name of LOCALES) {
      assert.ok(shipped.includes(name), 'package-vsix.mjs does not ship ' + name);
    }
  });

  test('the Chinese strings are actually Chinese', () => {
    // A copy-paste of the English file would satisfy every check above.
    const zh = locale('package.nls.zh-cn.json');
    const han = /[\u4e00-\u9fff]/;
    const untranslated = Object.entries(zh)
      .filter(([key, value]) => key !== 'extension.displayName' && !han.test(value))
      .map(([key]) => key);
    assert.deepEqual(untranslated, [], 'these strings have no Han characters');
  });
});

describe('every option is a setting, and every setting is an option', () => {
  test('every deliberately unexposed option still exists', () => {
    const core = new Set(corePaths());
    for (const path of Object.keys(NOT_SETTINGS)) {
      assert.ok(core.has(path), path + ' is excluded from the settings but is not a core option');
    }
  });

  test('the two lists are identical, once deliberate exclusions are removed', () => {
    const expected = corePaths().filter((path) => !(path in NOT_SETTINGS));
    assert.deepEqual(settingPaths(), expected);
  });

  test('each setting carries the core default', () => {
    for (const path of corePaths().filter((path) => !(path in NOT_SETTINGS))) {
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
