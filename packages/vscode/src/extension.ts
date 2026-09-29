import * as vscode from 'vscode';
import { loadOptionsFor } from '../../core/src/index.ts';
import type { FormatOptionsInput } from '../../core/src/index.ts';
import { mergeOptions } from '../../core/src/config.ts';
import { documentEdits, editsInRange, type Edit } from './edits.ts';
import { offsetToPosition } from './positions.ts';

const SELECTOR: vscode.DocumentSelector = [{ language: 'markdown' }];

function optionsFor(document: vscode.TextDocument): FormatOptionsInput {
  let fromFile: FormatOptionsInput = {};
  try {
    fromFile = loadOptionsFor(document.uri.fsPath).options;
  } catch {
    // An unreadable config must not stop the formatter from working.
    fromFile = {};
  }
  // CFG-01: editor settings are an override layer above the project config, so
  // a personal preference does not require editing a committed file.
  const fromSettings = vscode.workspace
    .getConfiguration('fuxiFmt')
    .get<FormatOptionsInput>('config', {});
  return mergeOptions(fromFile, fromSettings ?? {});
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
