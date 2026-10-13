/**
 * Generate the editor settings from the core option vocabulary (CFG-01).
 *
 * The manifest used to re-list every option by hand: its type, its default, the
 * members it accepts and the localised description key. That is the same fact the
 * core declares, written a second time, and the audit in settings.test.ts existed
 * to catch the two drifting. This script removes the second writing instead: a
 * leaf added to OPTION_VOCABULARY is contributed by construction, and one removed
 * disappears from the manifest.
 *
 * The editor own settings - enable, config and the per-diagnostic switches - are
 * not core options, so they are read from the manifest and written back untouched.
 *
 * The file is written canonical (two-space JSON), because from here on its
 * formatting belongs to this script rather than to a person.
 *
 *   npm run manifest             rewrite package.json
 *   node generate-manifest.mjs --check    fail when package.json is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPTION_VOCABULARY, UNEXPOSED_OPTIONS, defaultOptions } from '../core/src/options.ts';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'package.json');
const PREFIX = 'fuxiFmt.';
const KEYWORDS = ['fuxi', 'fuxi-fmt'];

/** Every leaf of the vocabulary, in declaration order. */
function leafPaths(node, prefix = '') {
  const out = [];
  for (const [key, child] of Object.entries(node)) {
    const path = prefix === '' ? key : prefix + '.' + key;
    if (typeof child.kind === 'string') out.push([path, child]);
    else out.push(...leafPaths(child, path));
  }
  return out;
}

function defaultAt(path) {
  let node = defaultOptions;
  for (const part of path.split('.')) node = node?.[part];
  return node instanceof Set ? [...node] : node;
}

function descriptionsFor(path, count) {
  return Array.from({ length: count }, (_, i) => '%' + PREFIX + path + '.enum.' + i + '%');
}

/** The settings row one leaf contributes, in one canonical key order. */
function rowFor(path, spec) {
  const values = spec.values ?? [];
  const row = { keywords: KEYWORDS };
  if (spec.kind === 'oneOf') {
    // A vocabulary of strings is a string setting; one that mixes a word and a
    // number (aligned or 4) is left untyped, which is how VS Code documents it.
    if (values.every((value) => typeof value === 'string')) row.type = 'string';
  } else if (spec.kind === 'bool') {
    row.type = 'boolean';
  } else if (spec.kind === 'int') {
    row.type = 'integer';
  } else if (spec.kind === 'nullableInt') {
    row.type = ['integer', 'null'];
  } else if (spec.kind === 'stringList' || spec.kind === 'stringSet' || spec.kind === 'oneOfList') {
    row.type = 'array';
  } else if (spec.kind === 'nonEmptyString') {
    row.type = 'string';
  }
  row.default = defaultAt(path);
  row.scope = 'resource';
  if (spec.kind === 'oneOf') {
    row.enum = [...values];
    row.enumDescriptions = descriptionsFor(path, values.length);
  } else if (spec.kind === 'oneOfList') {
    row.items = { enum: [...values], enumDescriptions: descriptionsFor(path, values.length) };
  } else if (spec.kind === 'stringList' || spec.kind === 'stringSet') {
    row.items = { type: 'string' };
  }
  if (spec.min !== undefined) row.minimum = spec.min;
  row.markdownDescription = '%' + PREFIX + path + '.description%';
  return row;
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const existing = manifest.contributes.configuration.properties;
const leaves = leafPaths(OPTION_VOCABULARY).filter(([path]) => !(path in UNEXPOSED_OPTIONS));
const contributed = new Set(leaves.map(([path]) => PREFIX + path));

const kept = Object.fromEntries(Object.entries(existing).filter(([key]) => !contributed.has(key)));
const generated = Object.fromEntries(
  leaves.map(([path, spec]) => [PREFIX + path, rowFor(path, spec)]),
);
manifest.contributes.configuration.properties = { ...kept, ...generated };

const next = JSON.stringify(manifest, null, 2) + '\n';

if (process.argv.includes('--check')) {
  if (readFileSync(manifestPath, 'utf8') !== next) {
    console.error('package.json is stale: run the manifest script to rewrite it');
    process.exit(1);
  }
  console.log('package.json matches the option vocabulary (' + leaves.length + ' settings)');
} else {
  writeFileSync(manifestPath, next);
  console.log('wrote package.json (' + (Object.keys(kept).length + leaves.length) + ' settings)');
}
