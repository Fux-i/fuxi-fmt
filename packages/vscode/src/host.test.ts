import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * The bundle built, parsed and contained the expected strings - but it had
 * never RUN. Loading it needs a 'vscode' module, which exists only inside the
 * editor, so this writes the stub from test/stubs/ into the gitignored
 * dist/node_modules and loads the real bundle against it.
 *
 * The stub is a real file rather than a string inside this test, because a
 * string has to be escaped to be edited - and editing inside a string literal
 * instead of inside code is exactly how an earlier attempt broke the suite.
 */

const here = new URL('.', import.meta.url).pathname;
const pkgRoot = join(here, '..');
const dist = join(pkgRoot, 'dist');
const bundle = join(dist, 'extension.cjs');
const stubSource = join(pkgRoot, 'test', 'stubs', 'vscode.cjs');
const stubDir = join(dist, 'node_modules', 'vscode');

describe('the extension bundle against a stubbed host', () => {
  // Always rebuild. Guarding on the bundle's absence meant this test could run
  // against a stale build and silently verify the previous revision - which is
  // exactly what happened when the settings override was first added.
  const built = spawnSync(process.execPath, [join(pkgRoot, 'build.mjs')], {
    cwd: pkgRoot,
    encoding: 'utf8',
  });
  assert.equal(built.status, 0, 'build failed: ' + String(built.stderr));

  assert.ok(existsSync(stubSource), 'the vscode stub fixture is missing: ' + stubSource);
  mkdirSync(stubDir, { recursive: true });
  writeFileSync(
    join(stubDir, 'package.json'),
    JSON.stringify({ name: 'vscode', version: '0.0.0', main: 'index.js' }),
  );
  writeFileSync(join(stubDir, 'index.js'), readFileSync(stubSource, 'utf8'));

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
  const documentProvider = registrations.find((entry) => entry.kind === 'document');
  const rangeProvider = registrations.find((entry) => entry.kind === 'range');

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

  test('editor settings override the project config', () => {
    assert.ok(documentProvider);
    const list = { getText: () => '- item\n', uri: { fsPath: join(dist, 'list.md') } };

    vscode.config = {};
    const without = documentProvider.provider.provideDocumentFormattingEdits(list);
    vscode.config = { list: { unorderedMarker: 'asterisks' } };
    const withSetting = documentProvider.provider.provideDocumentFormattingEdits(list);

    assert.notDeepEqual(withSetting, without, 'the setting did not reach the formatter');
    vscode.config = {};
  });

  test('an individual setting reaches the formatter', () => {
    assert.ok(documentProvider);
    const list = { getText: () => '- item\n', uri: { fsPath: join(dist, 'list.md') } };

    vscode.settings = {};
    const without = documentProvider.provider.provideDocumentFormattingEdits(list);
    vscode.settings = { 'fuxiFmt.list.unorderedMarker': 'asterisks' };
    const withSetting = documentProvider.provider.provideDocumentFormattingEdits(list);

    assert.notDeepEqual(withSetting, without, 'the individual setting did not reach the formatter');
    vscode.settings = {};
  });

  test('disposing the context releases both registrations', () => {
    for (const subscription of context.subscriptions as Array<{ dispose(): void }>) {
      subscription.dispose();
    }
    assert.deepEqual(vscode.disposed, ['document', 'range']);
  });

  after(() => rmSync(join(dist, 'node_modules'), { recursive: true, force: true }));
});
