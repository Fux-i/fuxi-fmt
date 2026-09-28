import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * The bundle built, parsed, and contained the expected strings - but it had
 * never RUN. Loading it needs a 'vscode' module, which only exists inside the
 * editor, so this writes a stub into the gitignored dist/node_modules and loads
 * the real bundle against it.
 *
 * This is the only way to execute the extension without installing VS Code.
 */

const here = new URL('.', import.meta.url).pathname;
const pkgRoot = join(here, '..');
const dist = join(pkgRoot, 'dist');
const bundle = join(dist, 'extension.cjs');
const stubDir = join(dist, 'node_modules', 'vscode');

const STUB_SOURCE = "const registrations = [];\nconst disposed = [];\nmodule.exports = {\n  registrations,\n  disposed,\n  languages: {\n    registerDocumentFormattingEditProvider(selector, provider) {\n      registrations.push({ kind: 'document', selector, provider });\n      return { dispose: () => disposed.push('document') };\n    },\n    registerDocumentRangeFormattingEditProvider(selector, provider) {\n      registrations.push({ kind: 'range', selector, provider });\n      return { dispose: () => disposed.push('range') };\n    },\n  },\n  workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },\n  Position: class Position { constructor(line, character) { this.line = line; this.character = character; } },\n  Range: class Range { constructor(start, end) { this.start = start; this.end = end; } },\n  TextEdit: { replace: (range, newText) => ({ range, newText }) },\n};\n";

describe('the extension bundle against a stubbed host', () => {
  if (!existsSync(bundle)) {
    const built = spawnSync(process.execPath, [join(pkgRoot, 'build.mjs')], {
      cwd: pkgRoot,
      encoding: 'utf8',
    });
    assert.equal(built.status, 0, 'build failed: ' + String(built.stderr));
  }

  mkdirSync(stubDir, { recursive: true });
  writeFileSync(join(stubDir, 'package.json'), JSON.stringify({ name: 'vscode', version: '0.0.0', main: 'index.js' }));
  writeFileSync(join(stubDir, 'index.js'), STUB_SOURCE);

  const requireFromDist = createRequire(join(dist, 'loader.cjs'));
  const vscode = requireFromDist(join(stubDir, 'index.js'));
  const extension = requireFromDist(bundle);
  const context = { subscriptions: [] };
  extension.activate(context);

  interface Provider {
    provideDocumentFormattingEdits(document: unknown): unknown[];
    provideDocumentRangeFormattingEdits(document: unknown, range: unknown): unknown[];
  }
  const registrations = vscode.registrations as Array<{ kind: string; provider: Provider }>;
  const documentProvider = registrations.find((r) => r.kind === 'document');
  const rangeProvider = registrations.find((r) => r.kind === 'range');

  const document = {
    getText: () => '#标题\n',
    uri: { fsPath: join(dist, 'sample.md') },
  };

  test('activate registers both providers and nothing is left undisposed', () => {
    assert.equal(registrations.length, 2);
    assert.equal(context.subscriptions.length, 2);
  });

  test('a range provider is registered, because Format Selection needs one', () => {
    assert.ok(rangeProvider, 'no range provider was registered');
  });

  test('the document provider returns the formatted edit', () => {
    assert.ok(documentProvider);
    const edits = documentProvider.provider.provideDocumentFormattingEdits(document) as Array<{
      newText: string;
    }>;
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.newText, ' ');
  });

  test('the range provider clips to the selection', () => {
    assert.ok(rangeProvider);
    const inside = rangeProvider.provider.provideDocumentRangeFormattingEdits(document, {
      start: { line: 0 },
      end: { line: 0 },
    });
    const outside = rangeProvider.provider.provideDocumentRangeFormattingEdits(document, {
      start: { line: 1 },
      end: { line: 1 },
    });
    assert.equal(inside.length, 1);
    assert.equal(outside.length, 0);
  });

  test('disposing the context releases both registrations', () => {
    for (const subscription of context.subscriptions as Array<{ dispose(): void }>) subscription.dispose();
    assert.deepEqual(vscode.disposed, ['document', 'range']);
  });

  after(() => rmSync(join(dist, 'node_modules'), { recursive: true, force: true }));
});
