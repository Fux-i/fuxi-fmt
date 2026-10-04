import * as vscode from 'vscode';
import { defaultOptions, loadOptionsFor } from '../../core/src/index.ts';
import type { ConfigNotice, Diagnostic, FormatOptionsInput } from '../../core/src/index.ts';
import { mergeOptions } from '../../core/src/config.ts';
import { documentFormat, editsInRange, type Edit } from './edits.ts';
import { offsetToPosition } from './positions.ts';

const SELECTOR: vscode.DocumentSelector = [{ language: 'markdown' }];

/**
 * CFG-01. The individual `fuxiFmt.*` settings are a layer BELOW the project's
 * `fuxi-fmt.json`, and the `fuxiFmt.config` object is a layer ABOVE it. The
 * contributed defaults are what VS Code already puts at the very bottom.
 *
 * A setting counts as set only when someone actually set it. `get()` returns the
 * contributed default, so reading it alone would make every setting override the
 * project file; `inspect()` is what tells the two apart. Reading the effective
 * value through `get()` is also what makes `[markdown]`-scoped overrides work,
 * since VS Code has already resolved them by then.
 */
function isSet(configuration: vscode.WorkspaceConfiguration, key: string): boolean {
  const info = configuration.inspect(key);
  if (info === undefined || info === null) return false;
  return [
    info.globalValue,
    info.workspaceValue,
    info.workspaceFolderValue,
    info.globalLanguageValue,
    info.workspaceLanguageValue,
    info.workspaceFolderLanguageValue,
  ].some((value) => value !== undefined);
}

function fromIndividualSettings(document: vscode.TextDocument): FormatOptionsInput {
  const configuration = vscode.workspace.getConfiguration('fuxiFmt');
  const out: Record<string, unknown> = {};

  // Driven by the core's own option surface, so a new option is picked up here
  // without a second list to keep in step with it.
  for (const [section, value] of Object.entries(defaultOptions)) {
    if (value !== null && typeof value === 'object') {
      const bag: Record<string, unknown> = {};
      for (const leaf of Object.keys(value as Record<string, unknown>)) {
        const key = section + '.' + leaf;
        if (!isSet(configuration, key)) continue;
        bag[leaf] = configuration.get(key) as unknown;
      }
      if (Object.keys(bag).length > 0) out[section] = bag;
    } else if (isSet(configuration, section)) {
      out[section] = configuration.get(section) as unknown;
    }
  }

  // The one option deliberately not contributed as a fuxi-fmt setting: VS Code
  // already has editor.tabSize, and a second place to set the same thing is a
  // second truth. A value set through fuxi-fmt.json still wins, because it is
  // merged above this layer.
  const tabSize = vscode.workspace
    .getConfiguration('editor', document.uri)
    .get<number>('tabSize');
  if (typeof tabSize === 'number' && tabSize > 0) {
    const list = (out.list as Record<string, unknown> | undefined) ?? {};
    if (!('tabWidth' in list)) list.tabWidth = tabSize;
    out.list = list;
  }

  return out as FormatOptionsInput;
}

interface EffectiveOptions {
  readonly options: FormatOptionsInput;
  readonly notices: readonly ConfigNotice[];
}

/**
 * The options for a document, and what its configuration had to say.
 *
 * The notices are the reason this returns a pair: a renamed key or a typo
 * produces a configuration that quietly does less than its author asked for, and
 * the editor is the one place that can say so while they are looking at the file.
 */
function loadOptions(document: vscode.TextDocument): EffectiveOptions {
  let fromFile: FormatOptionsInput = {};
  let notices: readonly ConfigNotice[] = [];
  try {
    const loaded = loadOptionsFor(document.uri.fsPath);
    fromFile = loaded.options;
    notices = loaded.notices;
  } catch {
    // An unreadable config must not stop the formatter from working.
    fromFile = {};
  }
  // Lowest first: individual settings, then the project file, then the explicit
  // object override. The file beats the granular settings on purpose - the CLI
  // can never see editor settings, so letting them win would make the editor and
  // `fuxi-fmt --check` disagree about the same document.
  const override = vscode.workspace
    .getConfiguration('fuxiFmt')
    .get<FormatOptionsInput>('config', {});
  return {
    options: mergeOptions(mergeOptions(fromIndividualSettings(document), fromFile), override ?? {}),
    notices,
  };
}

function toTextEdits(document: vscode.TextDocument, edits: readonly Edit[]): vscode.TextEdit[] {
  const text = document.getText();
  return edits.map((edit) => {
    const from = offsetToPosition(text, edit.start);
    const to = offsetToPosition(text, edit.end);
    return vscode.TextEdit.replace(
      new vscode.Range(
        new vscode.Position(from.line, from.character),
        new vscode.Position(to.line, to.character),
      ),
      edit.newText,
    );
  });
}

function enabled(): boolean {
  return vscode.workspace.getConfiguration('fuxiFmt').get<boolean>('enable', true);
}

/**
 * `path:line: severity: RULE message` - deliberately the same shape the CLI
 * prints, so a reader who has read one log has read both. The diagnostic in the
 * Problems panel carries the file already; this is the log's copy.
 */
function locate(file: string, diagnostic: Diagnostic): string {
  const where = diagnostic.line === undefined ? file : file + ':' + String(diagnostic.line + 1);
  return where + ': ' + diagnostic.severity + ': ' + diagnostic.ruleId + ' ' + diagnostic.message;
}

/** Map a core diagnostic to the editor's, at its line. */
function toDiagnostic(diagnostic: Diagnostic): vscode.Diagnostic {
  const severity =
    diagnostic.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;
  // A document-level diagnostic has no line. The editor has no way to attach a
  // comment to a whole file, so it goes on the first line - but the message and
  // the output channel both say the line is unknown rather than pretend.
  const line = diagnostic.line ?? 0;
  return new vscode.Diagnostic(
    new vscode.Range(
      new vscode.Position(line, 0),
      new vscode.Position(line, Number.MAX_SAFE_INTEGER),
    ),
    diagnostic.ruleId + ': ' + diagnostic.message,
    severity,
  );
}

/**
 * Format, then tell the author what happened.
 *
 * Before this existed the adapter computed diagnostics and threw them away, so a
 * document the guard refused simply did not format and nothing said why - which is
 * how two of this round's five reports arrived as "it does nothing".
 *
 * The output panel is revealed only when something was refused or warned about.
 * Popping it open on every save would be a reason to uninstall the extension.
 */
function formatAndReport(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
  output: vscode.OutputChannel,
): readonly Edit[] {
  const loaded = loadOptions(document);
  const outcome = documentFormat(document.getText(), loaded.options);
  collection.set(document.uri, outcome.diagnostics.map(toDiagnostic));

  for (const notice of loaded.notices) {
    output.appendLine('config: ' + notice.message);
  }
  for (const diagnostic of outcome.diagnostics) {
    output.appendLine(locate(document.uri.fsPath, diagnostic));
  }
  const tripped = outcome.diagnostics.length > 0 || loaded.notices.length > 0;
  if (tripped) output.show(true);
  return outcome.edits;
}

export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('fuxi-fmt');
  const output = vscode.window.createOutputChannel('Fuxi Fmt');

  const formatting: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits(document) {
      if (!enabled()) return [];
      return toTextEdits(document, formatAndReport(document, collection, output));
    },
  };

  // A range provider is also a document formatter as far as VS Code is
  // concerned, and Format Selection requires one: without it Ctrl+K Ctrl+F
  // silently does nothing.
  const rangeFormatting: vscode.DocumentRangeFormattingEditProvider = {
    provideDocumentRangeFormattingEdits(document, range) {
      if (!enabled()) return [];
      const edits = formatAndReport(document, collection, output);
      return toTextEdits(document, editsInRange(edits, range.start.line, range.end.line));
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, formatting),
    vscode.languages.registerDocumentRangeFormattingEditProvider(SELECTOR, rangeFormatting),
    collection,
    output,
  );
}

export function deactivate(): void {
  // Nothing to release: the providers are disposed through subscriptions.
}
