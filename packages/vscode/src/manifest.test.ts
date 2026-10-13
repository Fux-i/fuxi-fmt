import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * The manifest is generated from the core option vocabulary (CFG-01).
 *
 * A generated file that nothing regenerates drifts silently, and the audit in
 * settings.test.ts exists precisely because it did. This asserts the committed
 * file is what the generator would write, so forgetting to regenerate is a
 * failing test rather than a Settings panel that quietly lies.
 */
test('CFG-01 package.json is what the option vocabulary implies', () => {
  const script = new URL('../generate-manifest.mjs', import.meta.url);
  const out = execFileSync(process.execPath, [script.pathname, '--check'], { encoding: 'utf8' });
  assert.match(out, /matches the option vocabulary/);
});
