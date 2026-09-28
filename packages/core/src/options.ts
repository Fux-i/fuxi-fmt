export type AroundBlocks = 'exact' | 'atLeast';

export interface BlankLinesOptions {
  /** Whether blocks are separated by exactly one blank line, or at least one. */
  readonly aroundBlocks: AroundBlocks;
  /** Cap on consecutive blank lines; null means unbounded. */
  readonly maxConsecutive: number | null;
}

export type PunctuationStyle = 'fullwidth' | 'halfwidth' | 'mixed' | 'off';

export interface TypographyOptions {
  /** Insert one space at every CJK to non-CJK boundary (TYPO-01). */
  readonly cjkSpacing: boolean;
  /** Direction of punctuation width normalisation (TYPO-05). */
  readonly punctuationStyle: PunctuationStyle;
  /** Half-width marks eligible for conversion (TYPO-05). */
  readonly punctuationAllowlist: readonly string[];
  /** Full-width alphanumerics become half-width (TYPO-06). */
  readonly halfwidthAlphanumerics: boolean;
  /** U+3000 becomes a normal space (TYPO-06). */
  readonly ideographicSpace: boolean;
  /** Space a mid-text '#' from CJK; off by default (TYPO-09). */
  readonly hashtag: boolean;
}

export type EndOfLine = 'lf' | 'crlf' | 'auto';
export type IndentWidth = 2 | 4 | 'tab';
export type UnorderedMarker = 'dashes' | 'asterisks' | 'preserve';
export type FenceChar = 'backticks' | 'tildes' | 'preserve';
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
  /** Width used when expanding hard tabs; 'tab' leaves them alone (BLK-11). */
  readonly indentWidth: IndentWidth;
  /** Marker to use for unordered lists (BLK-07). */
  readonly unorderedMarker: UnorderedMarker;
}

export interface CodeBlockOptions {
  /** Fence character to use (BLK-10). */
  readonly fenceChar: FenceChar;
  /** Lengthen the fence past the longest run in its body (BLK-10). */
  readonly normalizeLength: boolean;
}

export interface CodeBlockInput {
  readonly fenceChar?: FenceChar;
  readonly normalizeLength?: boolean;
}

export interface FormatOptions {
  readonly blankLines: BlankLinesOptions;
  readonly typography: TypographyOptions;
  readonly list: ListOptions;
  readonly codeBlock: CodeBlockOptions;
  readonly endOfLine: EndOfLine;
}

export interface BlankLinesInput {
  readonly aroundBlocks?: AroundBlocks;
  readonly maxConsecutive?: number | null;
}

export interface TypographyInput {
  readonly cjkSpacing?: boolean;
  readonly punctuationStyle?: PunctuationStyle;
  readonly punctuationAllowlist?: readonly string[];
  readonly halfwidthAlphanumerics?: boolean;
  readonly ideographicSpace?: boolean;
  readonly hashtag?: boolean;
}

export interface ListInput {
  readonly orderedStyle?: OrderedStyle;
  readonly orderedDelimiter?: OrderedDelimiter;
  readonly indentWidth?: IndentWidth;
  readonly unorderedMarker?: UnorderedMarker;
}

export interface FormatOptionsInput {
  readonly blankLines?: BlankLinesInput;
  readonly typography?: TypographyInput;
  readonly list?: ListInput;
  readonly codeBlock?: CodeBlockInput;
  readonly endOfLine?: EndOfLine;
}

export const defaultOptions: FormatOptions = {
  blankLines: { aroundBlocks: 'exact', maxConsecutive: 1 },
  typography: {
    cjkSpacing: true,
    punctuationStyle: 'fullwidth',
    punctuationAllowlist: [',', '.', ':', '!', '?'],
    halfwidthAlphanumerics: true,
    ideographicSpace: true,
    hashtag: false,
  },
  list: {
    orderedStyle: 'increment',
    orderedDelimiter: 'preserve',
    indentWidth: 2,
    unorderedMarker: 'dashes',
  },
  codeBlock: { fenceChar: 'backticks', normalizeLength: true },
  endOfLine: 'lf',
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
      punctuationStyle:
        input?.typography?.punctuationStyle ?? defaultOptions.typography.punctuationStyle,
      punctuationAllowlist:
        input?.typography?.punctuationAllowlist ?? defaultOptions.typography.punctuationAllowlist,
      halfwidthAlphanumerics:
        input?.typography?.halfwidthAlphanumerics ??
        defaultOptions.typography.halfwidthAlphanumerics,
      ideographicSpace:
        input?.typography?.ideographicSpace ?? defaultOptions.typography.ideographicSpace,
      hashtag: input?.typography?.hashtag ?? defaultOptions.typography.hashtag,
    },
    list: {
      orderedStyle: input?.list?.orderedStyle ?? defaultOptions.list.orderedStyle,
      orderedDelimiter: input?.list?.orderedDelimiter ?? defaultOptions.list.orderedDelimiter,
      indentWidth: input?.list?.indentWidth ?? defaultOptions.list.indentWidth,
      unorderedMarker: input?.list?.unorderedMarker ?? defaultOptions.list.unorderedMarker,
    },
    codeBlock: {
      fenceChar: input?.codeBlock?.fenceChar ?? defaultOptions.codeBlock.fenceChar,
      normalizeLength:
        input?.codeBlock?.normalizeLength ?? defaultOptions.codeBlock.normalizeLength,
    },
    endOfLine: input?.endOfLine ?? defaultOptions.endOfLine,
  };
}
