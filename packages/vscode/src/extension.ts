import * as vscode from 'vscode';
import { defaultOptions, loadOptionsFor, templateOf } from '../../core/src/index.ts';
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
 * The sentence in the editor's language (CFG-08).
 *
 * vscode.l10n looks a string up by its English text, which is why the catalogue's
 * English is handed over as the key and the bundle is keyed the same way. With no
 * bundle loaded - the default language, or an install that lost l10n/ - l10n
 * returns the key unchanged, so the fallback is the English sentence. Falling back
 * to English is the only acceptable failure here; the alternative is a reader
 * seeing raw keys or an id.
 */
function sentence(messageId: Diagnostic['messageId'], args: Diagnostic['args']): string {
  return vscode.l10n.t(templateOf(messageId), ...args);
}

/**
 * Which file, and when: `=====docs/guide.md 16:20:01=====`.
 *
 * The path is relative to the workspace folder, because a log read at a glance
 * wants the shortest name that is still unambiguous. The time is short because it
 * is there to separate one run from the next, not to be a timestamp of record.
 */
function headerFor(document: vscode.TextDocument, at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const clock = pad(at.getHours()) + ':' + pad(at.getMinutes()) + ':' + pad(at.getSeconds());
  return '=====' + vscode.workspace.asRelativePath(document.uri, false) + ' ' + clock + '=====';
}

/**
 * `WARNING[12] DET-06 message`, or `ERROR DET-02 message` when the complaint is
 * about the document as a whole: a refused document is refused whole, so there is
 * no line to name and an empty bracket would be worse than none.
 *
 * The level is one of the same two Latin words the CLI prints, so one search finds
 * a rule in either log, and the rule id stays where it is because the
 * documentation, the spec and --explain are all keyed on it.
 */
function lineFor(diagnostic: Diagnostic): string {
  const level = diagnostic.severity === 'error' ? 'ERROR' : 'WARNING';
  const where = diagnostic.line === undefined ? '' : '[' + String(diagnostic.line + 1) + ']';
  return level + where + ' ' + diagnostic.ruleId + ' ' + sentence(diagnostic.messageId, diagnostic.args);
}

/**
 * One switch per warning rule, because a warning that cannot be turned off is a
 * warning that gets the whole feature turned off. Errors have no switch: a
 * refused document is refused for a reason, and silencing the reason would put
 * the reader back where this round started.
 */
const WARNING_SWITCHES: Readonly<Record<string, string>> = {
  'DET-06': 'diagnostics.unmatchedBacktick',
  'DET-07': 'diagnostics.unmatchedDollarSign',
  'DET-08': 'diagnostics.unclosedWikilink',
  'DET-09': 'diagnostics.unclosedLinkDestination',
  'DET-10': 'diagnostics.raggedTableRow',
  'DET-11': 'diagnostics.listIndentJump',
  'DET-12': 'diagnostics.excludedList',
};

/** Drop the warnings the reader has switched off. Errors are never dropped. */
function visibleDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const configuration = vscode.workspace.getConfiguration('fuxiFmt');
  return diagnostics.filter((diagnostic) => {
    if (diagnostic.severity === 'error') return true;
    const key = WARNING_SWITCHES[diagnostic.ruleId];
    if (key === undefined) return true;
    return configuration.get<boolean>(key, true);
  });
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
  const editorDiagnostic = new vscode.Diagnostic(
    new vscode.Range(
      new vscode.Position(line, 0),
      new vscode.Position(line, Number.MAX_SAFE_INTEGER),
    ),
    sentence(diagnostic.messageId, diagnostic.args),
    severity,
  );
  // The rule id belongs in the panel's own field rather than glued to the
  // sentence: it stays Latin while the sentence does not, and the panel can show
  // and filter it.
  editorDiagnostic.code = diagnostic.ruleId;
  return editorDiagnostic;
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
  const diagnostics = visibleDiagnostics(outcome.diagnostics);
  collection.set(document.uri, diagnostics.map(toDiagnostic));

  const notices = loaded.notices;
  const tripped = diagnostics.length > 0 || notices.length > 0;
  // One block per document, and only when there is something under the header: a
  // header on every save would fill the panel with blocks that say nothing, which
  // is the state this replaced.
  if (tripped) {
    output.appendLine(headerFor(document, new Date()));
    for (const notice of notices) {
      output.appendLine(
        'NOTICE ' + notice.key + ' ' + sentence(notice.messageId, notice.args),
      );
    }
    for (const diagnostic of diagnostics) {
      output.appendLine(lineFor(diagnostic));
    }
    output.show(true);
  }
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
