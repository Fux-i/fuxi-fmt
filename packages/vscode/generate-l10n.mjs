/**
 * Generate the editor's localisation bundles from the core catalogue (CFG-08).
 *
 * vscode.l10n looks up the English string an extension hands it, so a bundle is
 * keyed by English rather than by our message ids - and only the editor can load
 * one. The CLI reads the catalogue directly, so there are two formats and one
 * source: this script writes the formats, and a test fails when the committed
 * files differ from what the catalogue implies. A translation added to
 * messages.ts therefore cannot fail to reach the editor, and a bundle edited here
 * cannot drift out of the catalogue.
 *
 *   npm run l10n
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from '../core/src/messages.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'l10n');

/** English identity map, so the source language is in the bundle too. */
const english = {};
/** English key -> Chinese sentence. */
const chinese = {};
for (const entry of Object.values(MESSAGES)) {
  english[entry.en] = entry.en;
  chinese[entry.en] = entry.zh;
}

function write(name, value) {
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = value[key];
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(sorted, null, 2) + '\n');
  console.log('wrote ' + name + ' (' + String(Object.keys(sorted).length) + ' strings)');
}

write('bundle.l10n.json', english);
write('bundle.l10n.zh-cn.json', chinese);
