/**
 * Named option sets (CFG-01).
 *
 * A preset sits *below* the project's own settings: it supplies values, and
 * anything the config states explicitly wins. That ordering is the only one
 * that makes a preset useful, because the point of naming a preset is to avoid
 * restating a dozen options, not to hide them.
 *
 * Only presets whose meaning is unambiguous are shipped. The blog-platform
 * presets named in an early draft of the specification were removed rather than
 * guessed at: a preset called 'hugo' that does not match what a Hugo author
 * expects is worse than no preset.
 */

import type { FormatOptionsInput } from './options.ts';

export const PRESETS: Readonly<Record<string, FormatOptionsInput>> = {
  /** The shipped defaults, named so a config can state its intent. */
  default: {},

  /**
   * Change nothing that is not required for consistency.
   *
   * Every rule that rewrites an author's choice is switched off: markers, fence
   * characters, punctuation width and parenthesis width are all left alone.
   * Spacing stays on, because CJK boundary spacing is the point of the tool
   * rather than a style opinion.
   */
  'strict-commonmark': {
    list: { unorderedMarker: 'preserve' },
    codeBlock: { fenceChar: 'preserve' },
    typography: {
      punctuationStyle: 'off',
      parenStyle: 'preserve',
      halfwidthAlphanumerics: false,
      ideographicSpace: false,
      semicolon: false,
      hashtag: false,
    },
  },
};

export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

export function presetOptions(name: string): FormatOptionsInput {
  const preset = PRESETS[name];
  if (preset === undefined) {
    throw new Error(
      'config: unknown preset ' + name + '; known presets are ' + PRESET_NAMES.join(', '),
    );
  }
  return preset;
}
