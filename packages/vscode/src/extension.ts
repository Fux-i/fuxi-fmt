import * as vscode from 'vscode';
import { defaultOptions, loadOptionsFor } from '../../core/src/index.ts';
import type { FormatOptionsInput } from '../../core/src/index.ts';
import { mergeOptions } from '../../core/src/config.ts';
import { documentEdits, editsInRange, type Edit } from './edits.ts';
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

function optionsFor(document: vscode.TextDocument): FormatOptionsInput {
  let fromFile: FormatOptionsInput = {};
  try {
    fromFile = loadOptionsFor(document.uri.fsPath).options;
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
  return mergeOptions(mergeOptions(fromIndividualSettings(document), fromFile), override ?? {});
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

export function activate(context: vscode.ExtensionContext): void {
  const formatting: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits(document) {
      if (!enabled()) return [];
      return toTextEdits(document, documentEdits(document.getText(), optionsFor(document)));
    },
  };

  // A range provider is also a document formatter as far as VS Code is
  // concerned, and Format Selection requires one: without it Ctrl+K Ctrl+F
  // silently does nothing.
  const rangeFormatting: vscode.DocumentRangeFormattingEditProvider = {
    provideDocumentRangeFormattingEdits(document, range) {
      if (!enabled()) return [];
      const edits = documentEdits(document.getText(), optionsFor(document));
      return toTextEdits(document, editsInRange(edits, range.start.line, range.end.line));
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, formatting),
    vscode.languages.registerDocumentRangeFormattingEditProvider(SELECTOR, rangeFormatting),
  );
}

export function deactivate(): void {
  // Nothing to release: the providers are disposed through subscriptions.
}
