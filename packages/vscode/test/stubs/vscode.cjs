/**
 * A stand-in for the 'vscode' module, which exists only inside the editor.
 *
 * Kept as a real file rather than a string inside the test, because a string
 * has to be escaped to be edited and that is exactly how the previous attempt
 * to extend this stub broke the suite: the edit landed inside a string literal
 * instead of inside code.
 */

const registrations = [];
const disposed = [];

module.exports = {
  registrations,
  disposed,

  /** The `fuxiFmt.config` object, so a test can change what getConfiguration returns. */
  config: {},

  /**
   * Individual settings, keyed by full id, e.g. 'fuxiFmt.list.unorderedMarker'.
   * Only keys present here count as user-set, which is what inspect() reports.
   */
  settings: {},

  /** Diagnostics the extension published, keyed by the document uri. */
  publishedDiagnostics: [],

  /** Lines the extension wrote to its output channel. */
  outputLines: [],

  /** How many times the output channel was revealed. */
  revealed: 0,

  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },

  Diagnostic: class Diagnostic {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  },

  window: {
    createOutputChannel(name) {
      module.exports.outputName = name;
      return {
        name,
        appendLine: (line) => void module.exports.outputLines.push(line),
        show: () => void (module.exports.revealed += 1),
        dispose: () => void disposed.push('output'),
      };
    },
  },

  languages: {
    createDiagnosticCollection(name) {
      module.exports.collectionName = name;
      return {
        name,
        set: (uri, diagnostics) => void module.exports.publishedDiagnostics.push({ uri, diagnostics }),
        dispose: () => void disposed.push('diagnostics'),
      };
    },
    registerDocumentFormattingEditProvider(selector, provider) {
      registrations.push({ kind: 'document', selector, provider });
      return { dispose: () => disposed.push('document') };
    },
    registerDocumentRangeFormattingEditProvider(selector, provider) {
      registrations.push({ kind: 'range', selector, provider });
      return { dispose: () => disposed.push('range') };
    },
  },

  /**
   * The folder asRelativePath is relative to, for tests. Undefined means a window
   * with no folder open, where VS Code returns the absolute path - which the test
   * for it exercises.
   */
  workspaceFolder: undefined,

  workspace: {
    asRelativePath: (pathOrUri) => {
      const full =
        typeof pathOrUri === 'string' ? pathOrUri : (pathOrUri && pathOrUri.fsPath) || '';
      const root = module.exports.workspaceFolder;
      if (root && full.startsWith(root + '/')) return full.slice(root.length + 1);
      return full;
    },
    getConfiguration: (section) => ({
      get: (key, fallback) => {
        if (key === 'config') return module.exports.config;
        if (key === 'enable') return module.exports.enable ?? true;
        const id = section + '.' + key;
        if (Object.prototype.hasOwnProperty.call(module.exports.settings, id)) {
          return module.exports.settings[id];
        }
        return fallback;
      },
      inspect: (key) => {
        const id = section + '.' + key;
        if (Object.prototype.hasOwnProperty.call(module.exports.settings, id)) {
          return { key: id, defaultValue: undefined, globalValue: module.exports.settings[id] };
        }
        return { key: id, defaultValue: undefined };
      },
    }),
  },

  Position: class Position {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
  },

  Range: class Range {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  },

  TextEdit: {
    replace: (range, newText) => ({ range, newText }),
  },
};
