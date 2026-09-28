export type AroundBlocks = 'exact' | 'atLeast';

export interface BlankLinesOptions {
  /** Whether blocks are separated by exactly one blank line, or at least one. */
  readonly aroundBlocks: AroundBlocks;
  /** Cap on consecutive blank lines; null means unbounded. */
  readonly maxConsecutive: number | null;
}

export interface TypographyOptions {
  /** Insert one space at every CJK to non-CJK boundary (TYPO-01). */
  readonly cjkSpacing: boolean;
}

export interface FormatOptions {
  readonly blankLines: BlankLinesOptions;
  readonly typography: TypographyOptions;
}

export interface BlankLinesInput {
  readonly aroundBlocks?: AroundBlocks;
  readonly maxConsecutive?: number | null;
}

export interface TypographyInput {
  readonly cjkSpacing?: boolean;
}

export interface FormatOptionsInput {
  readonly blankLines?: BlankLinesInput;
  readonly typography?: TypographyInput;
}

export const defaultOptions: FormatOptions = {
  blankLines: { aroundBlocks: 'exact', maxConsecutive: 1 },
  typography: { cjkSpacing: true },
};

export function resolveOptions(input?: FormatOptionsInput): FormatOptions {
  const max = input?.blankLines?.maxConsecutive;
  return {
    blankLines: {
      aroundBlocks: input?.blankLines?.aroundBlocks ?? defaultOptions.blankLines.aroundBlocks,
      // null is a meaningful value here, so it must not be swallowed by ??.
      maxConsecutive: max === undefined ? defaultOptions.blankLines.maxConsecutive : max,
    },
    typography: {
      cjkSpacing: input?.typography?.cjkSpacing ?? defaultOptions.typography.cjkSpacing,
    },
  };
}
