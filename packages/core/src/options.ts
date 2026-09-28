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

export type OrderedStyle = 'increment' | 'lazy-one';
export type OrderedDelimiter = 'preserve' | '.' | ')';

export interface ListOptions {
  /**
   * 'increment' renumbers from the declared start but preserves a list the
   * author wrote with lazy all-ones markers, matching Prettier and dprint.
   * 'lazy-one' forces every item to 1.
   */
  readonly orderedStyle: OrderedStyle;
  readonly orderedDelimiter: OrderedDelimiter;
}

export interface FormatOptions {
  readonly blankLines: BlankLinesOptions;
  readonly typography: TypographyOptions;
  readonly list: ListOptions;
}

export interface BlankLinesInput {
  readonly aroundBlocks?: AroundBlocks;
  readonly maxConsecutive?: number | null;
}

export interface TypographyInput {
  readonly cjkSpacing?: boolean;
}

export interface ListInput {
  readonly orderedStyle?: OrderedStyle;
  readonly orderedDelimiter?: OrderedDelimiter;
}

export interface FormatOptionsInput {
  readonly blankLines?: BlankLinesInput;
  readonly typography?: TypographyInput;
  readonly list?: ListInput;
}

export const defaultOptions: FormatOptions = {
  blankLines: { aroundBlocks: 'exact', maxConsecutive: 1 },
  typography: { cjkSpacing: true },
  list: { orderedStyle: 'increment', orderedDelimiter: 'preserve' },
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
    list: {
      orderedStyle: input?.list?.orderedStyle ?? defaultOptions.list.orderedStyle,
      orderedDelimiter: input?.list?.orderedDelimiter ?? defaultOptions.list.orderedDelimiter,
    },
  };
}
