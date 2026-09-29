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

  /** Editor settings, so a test can change what getConfiguration returns. */
  config: {},

  languages: {
    registerDocumentFormattingEditProvider(selector, provider) {
      registrations.push({ kind: 'document', selector, provider });
      return { dispose: () => disposed.push('document') };
    },
    registerDocumentRangeFormattingEditProvider(selector, provider) {
      registrations.push({ kind: 'range', selector, provider });
      return { dispose: () => disposed.push('range') };
    },
  },

  workspace: {
    getConfiguration: () => ({
      get: (key, fallback) => (key === 'config' ? module.exports.config : fallback),
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
