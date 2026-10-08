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

  interface PublishedDiagnostic {
  /** The rule id, which the extension puts in the diagnostic's own field. */
  code?: string;
    readonly message: string;
    readonly severity: number;
    readonly range: { readonly start: { readonly line: number } };
  }
  interface Host {
    publishedDiagnostics: Array<{ uri: unknown; diagnostics: PublishedDiagnostic[] }>;
    outputLines: string[];
    revealed: number;
  }
  const host = vscode as unknown as Host;
  function clean(target: Host): void {
    target.publishedDiagnostics.length = 0;
    target.outputLines.length = 0;
    target.revealed = 0;
  }
  function lastPublished(target: Host) {
    return target.publishedDiagnostics[target.publishedDiagnostics.length - 1];
  }

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
    // Two providers, the diagnostic collection and the output channel.
    assert.equal(context.subscriptions.length, 4);
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

  test('editor.tabSize reaches the core, since it is not a fuxi-fmt setting', () => {
    assert.ok(documentProvider);
    const list = { getText: () => '- a\tb\n', uri: { fsPath: join(dist, 'tabs.md') } };

    vscode.settings = {};
    const without = documentProvider.provider.provideDocumentFormattingEdits(list);
    vscode.settings = { 'editor.tabSize': 4 };
    const withTabSize = documentProvider.provider.provideDocumentFormattingEdits(list);

    assert.notDeepEqual(withTabSize, without, 'editor.tabSize did not reach the formatter');
    vscode.settings = {};
  });

  test('the project file beats an individual setting, so the editor agrees with --check', () => {
    assert.ok(documentProvider);
    const file = join(dist, 'fuxi-fmt.json');
    const doc = join(dist, 'precedence.md');

    // The document uses asterisks, the project file asks for dashes, and the
    // editor setting asks for asterisks back. If the setting won, the document
    // would already be formatted and the edit list would be empty.
    writeFileSync(file, JSON.stringify({ list: { unorderedMarker: 'dashes' } }));
    writeFileSync(doc, '* item\n');
    try {
      const document = { getText: () => '* item\n', uri: { fsPath: doc } };
      vscode.settings = { 'fuxiFmt.list.unorderedMarker': 'asterisks' };
      const edits = documentProvider.provider.provideDocumentFormattingEdits(document) as
        | readonly { newText?: string }[]
        | undefined;
      // Edits are character ranges, so rewriting the marker yields '-', not a
      // whole line. What matters is that dashes appear and asterisks do not.
      const produced = (edits ?? []).map((edit) => edit.newText ?? '').join('');
      assert.ok(
        produced.includes('-') && !produced.includes('*'),
        'the editor setting overrode the project file; the edit was: ' + JSON.stringify(produced),
      );
    } finally {
      vscode.settings = {};
      rmSync(file, { force: true });
      rmSync(doc, { force: true });
    }
  });

  test('a warning is published at its line and does not stop the formatting', () => {
    assert.ok(documentProvider);
    clean(vscode);
    const warned = {
      getText: () => '#  标题\n\n他说 "你好 了\n',
      uri: { fsPath: join(dist, 'warning.md') },
    };
    const edits = documentProvider.provider.provideDocumentFormattingEdits(warned);

    assert.ok((edits as unknown[]).length > 0, 'a warning withheld the edits');
    const published = lastPublished(vscode);
    assert.equal(published?.diagnostics.length, 1);
    assert.equal(published?.diagnostics[0]?.severity, vscode.DiagnosticSeverity.Warning);
    assert.equal(published?.diagnostics[0]?.range.start.line, 2);
    // No bundle is installed in this test, which is what VS Code reports in the
    // default language: the sentence is the English one, and the rule id lives in
    // the diagnostic's own code field rather than glued to the sentence.
    assert.match(String(published?.diagnostics[0]?.message), /^unpaired straight quote/);
    assert.equal(published?.diagnostics[0]?.code, 'TYPO-11');
    assert.equal(vscode.revealed, 1, 'the output panel was not revealed for a warning');
  });

  test('a notice is published as information, logged as INFO, and does not open the panel', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.workspaceFolder = dist;
    vscode.settings = { 'fuxiFmt.table.maxWidth': 30 };
    const capped = {
      getText: () => '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n',
      uri: { fsPath: join(dist, 'capped.md') },
    };
    const edits = documentProvider.provider.provideDocumentFormattingEdits(capped);

    assert.ok((edits as unknown[]).length > 0, 'a notice withheld the edits');
    const published = lastPublished(vscode);
    assert.equal(published?.diagnostics[0]?.severity, vscode.DiagnosticSeverity.Information);
    assert.equal(published?.diagnostics[0]?.code, 'TBL-01');
    assert.equal(published?.diagnostics[0]?.range.start.line, 0);
    assert.match(String(vscode.outputLines[1]), /^INFO\[1\] TBL-01 /);
    // The log records it, but a note is not a reason to take the editor's focus:
    // opening the panel on every save is how a formatter gets uninstalled.
    assert.equal(vscode.revealed, 0, 'a notice opened the output panel');
    vscode.settings = {};
    vscode.workspaceFolder = undefined;
  });

  test('a notice the reader switched off is not published and not logged', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.settings = {
      'fuxiFmt.table.maxWidth': 30,
      'fuxiFmt.diagnostics.tableMaxWidth': false,
    };
    const capped = {
      getText: () => '| a very long cell indeed | b |\n| --- | --- |\n| 1 | 2 |\n| x | y |\n',
      uri: { fsPath: join(dist, 'capped-off.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(capped);

    assert.equal(lastPublished(vscode)?.diagnostics.length, 0);
    assert.deepEqual(vscode.outputLines, [], 'a switched-off notice was logged anyway');
    assert.equal(vscode.revealed, 0);
    vscode.settings = {};
  });

  test('the log is one header block per document, and only when it has something in it', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.workspaceFolder = dist;
    vscode.settings = {};
    const warned = {
      getText: () => '#  标题\n\n他说 "你好 了\n',
      uri: { fsPath: join(dist, 'docs', 'warning.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(warned);

    // The path is relative to the workspace folder, and the clock is short: it
    // separates one run from the next rather than being a timestamp of record.
    assert.match(String(vscode.outputLines[0]), /^=====docs\/warning\.md \d\d:\d\d:\d\d=====$/);
    assert.match(String(vscode.outputLines[1]), /^WARNING\[3\] TYPO-11 unpaired straight quote/);
    assert.equal(vscode.outputLines.length, 2, 'one header and one diagnostic line');

    clean(vscode);
    const tidy = {
      getText: () => '# Title\n\nSome text.\n',
      uri: { fsPath: join(dist, 'clean.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(tidy);
    assert.deepEqual(vscode.outputLines, [], 'a clean document wrote a header anyway');
    vscode.workspaceFolder = undefined;
  });

  test('a diagnostic is Chinese when the editor is, numbers and all', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.workspaceFolder = dist;
    // The bundle that ships, not a copy of it: if the generated file is wrong, this
    // is where it shows.
    vscode.l10nBundle = JSON.parse(
      readFileSync(join(pkgRoot, 'l10n', 'bundle.l10n.zh-cn.json'), 'utf8'),
    );
    const ragged = {
      getText: () => '| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n',
      uri: { fsPath: join(dist, 'table.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(ragged);

    const published = lastPublished(vscode);
    assert.match(String(published?.diagnostics[0]?.message), /单元格/);
    // The values survive the translation: three cells against a header of two.
    assert.match(String(published?.diagnostics[0]?.message), /3 个单元格/);
    assert.equal(published?.diagnostics[0]?.code, 'DET-10');
    // And the rule id stays Latin in the log, in either language.
    assert.match(String(vscode.outputLines[1]), /^WARNING\[3\] DET-10 /);
    assert.match(String(vscode.outputLines[1]), /3 个单元格/);
    vscode.l10nBundle = undefined;
    vscode.workspaceFolder = undefined;
  });

  test('an error line says ERROR and names the rule that refused the document', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.workspaceFolder = dist;
    const refused = {
      getText: () => '\u0060\u0060\u0060\u0060js\ncode\n\u0060\u0060\u0060\n',
      uri: { fsPath: join(dist, 'refused.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(refused);

    assert.match(String(vscode.outputLines[1]), /^ERROR\[1\] DET-01 /);
    // No line is printed for a complaint about the document as a whole - the form
    // is ERROR RULE message - but every reachable fixture has a line, because the
    // four error-class detections all fire at one. That branch belongs to the
    // guard, which these documents cannot reach.
    vscode.workspaceFolder = undefined;
  });

  test('a warning the reader switched off is not published and not logged', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.settings = { 'fuxiFmt.diagnostics.unmatchedBacktick': false };
    const warned = {
      getText: () => '用 \u0060 表示\n',
      uri: { fsPath: join(dist, 'switched-off.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(warned);

    assert.equal(lastPublished(vscode)?.diagnostics.length, 0);
    assert.equal(vscode.revealed, 0, 'the panel was revealed for a warning that is switched off');
    vscode.settings = {};
  });

  test('an error is published with every warning switched off', () => {
    assert.ok(documentProvider);
    clean(vscode);
    vscode.settings = {
      'fuxiFmt.diagnostics.unmatchedBacktick': false,
      'fuxiFmt.diagnostics.unmatchedDollarSign': false,
      'fuxiFmt.diagnostics.unclosedWikilink': false,
      'fuxiFmt.diagnostics.unclosedLinkDestination': false,
      'fuxiFmt.diagnostics.raggedTableRow': false,
      'fuxiFmt.diagnostics.listIndentJump': false,
      'fuxiFmt.diagnostics.excludedList': false,
    };
    const refused = {
      getText: () => '\u0060\u0060\u0060\u0060js\ncode\n\u0060\u0060\u0060\n',
      uri: { fsPath: join(dist, 'still-refused.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(refused);

    assert.equal(lastPublished(vscode)?.diagnostics[0]?.severity, vscode.DiagnosticSeverity.Error);
    vscode.settings = {};
  });

  test('a refused document publishes an error and withholds the edits', () => {
    assert.ok(documentProvider);
    clean(vscode);
    const refused = {
      getText: () => '\u0060\u0060\u0060\u0060js\ncode\n\u0060\u0060\u0060\n',
      uri: { fsPath: join(dist, 'refused.md') },
    };
    const edits = documentProvider.provider.provideDocumentFormattingEdits(refused);

    assert.deepEqual(edits, []);
    const published = lastPublished(vscode);
    assert.equal(published?.diagnostics[0]?.severity, vscode.DiagnosticSeverity.Error);
    assert.equal(vscode.revealed, 1);
  });

  test('a clean document publishes nothing and stays quiet', () => {
    assert.ok(documentProvider);
    clean(vscode);
    const clean1 = {
      getText: () => '# Title\n\nSome text.\n',
      uri: { fsPath: join(dist, 'clean.md') },
    };
    documentProvider.provider.provideDocumentFormattingEdits(clean1);

    assert.equal(lastPublished(vscode)?.diagnostics.length, 0);
    assert.equal(vscode.revealed, 0, 'the output panel was revealed for a clean document');
    assert.deepEqual(vscode.outputLines, []);
  });

  test('disposing the context releases every registration', () => {
    for (const subscription of context.subscriptions as Array<{ dispose(): void }>) {
      subscription.dispose();
    }
    assert.deepEqual(vscode.disposed, ['document', 'range', 'diagnostics', 'output']);
  });

  after(() => rmSync(join(dist, 'node_modules'), { recursive: true, force: true }));
});
