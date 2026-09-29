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
