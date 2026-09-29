import { DEFAULT_CJK_CLASSES, DEFAULT_SPACING_SYMBOLS, type CjkClass } from './chars.ts';

export type AroundBlocks = 'exact' | 'atLeast';

export interface BlankLinesOptions {
  /** Whether blocks are separated by exactly one blank line, or at least one. */
  readonly aroundBlocks: AroundBlocks;
  /** Cap on consecutive blank lines; null means unbounded. */
  readonly maxConsecutive: number | null;
}

export type PunctuationStyle = 'fullwidth' | 'halfwidth' | 'mixed' | 'off';
export type ParenStyle = 'mixed' | 'fullwidth' | 'halfwidth' | 'preserve';

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
  /** Parenthesis width, by the script of the contents (TYPO-08). */
  readonly parenStyle: ParenStyle;
  /** Also convert ';' beside CJK; off by default (TYPO-05). */
  readonly semicolon: boolean;
  /** Which scripts count as CJK. Defaults to Han alone. */
  readonly cjkClasses: readonly CjkClass[];
  /** Symbols CJK spacing treats as word characters (TYPO-01). */
  readonly symbolWhitelist: ReadonlySet<string>;
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

export interface IgnoreOptions {
  /** Comment body that opts a whole document out (CFG-03). */
  readonly file: string;
  /** Comment body that opens an ignored range. */
  readonly start: string;
  /** Comment body that closes an ignored range. */
  readonly end: string;
  /** Comment body that ignores the next block. */
  readonly line: string;
}

export interface IgnoreInput {
  readonly file?: string;
  readonly start?: string;
  readonly end?: string;
  readonly line?: string;
}

export interface FormatOptions {
  readonly blankLines: BlankLinesOptions;
  readonly typography: TypographyOptions;
  readonly list: ListOptions;
  readonly codeBlock: CodeBlockOptions;
  readonly endOfLine: EndOfLine;
  readonly ignore: IgnoreOptions;
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
  readonly parenStyle?: ParenStyle;
  readonly semicolon?: boolean;
  readonly cjkClasses?: readonly CjkClass[];
  readonly symbolWhitelist?: readonly string[];
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
  readonly ignore?: IgnoreInput;
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
    parenStyle: 'mixed',
    semicolon: false,
    cjkClasses: DEFAULT_CJK_CLASSES,
    symbolWhitelist: new Set(DEFAULT_SPACING_SYMBOLS),
  },
  list: {
    orderedStyle: 'increment',
    orderedDelimiter: 'preserve',
    indentWidth: 2,
    unorderedMarker: 'dashes',
  },
  codeBlock: { fenceChar: 'backticks', normalizeLength: true },
  endOfLine: 'lf',
  ignore: {
    file: 'fuxi-fmt-ignore-file',
    start: 'fuxi-fmt-ignore-start',
    end: 'fuxi-fmt-ignore-end',
    line: 'fuxi-fmt-ignore',
  },
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
      parenStyle: input?.typography?.parenStyle ?? defaultOptions.typography.parenStyle,
      semicolon: input?.typography?.semicolon ?? defaultOptions.typography.semicolon,
      cjkClasses: input?.typography?.cjkClasses ?? defaultOptions.typography.cjkClasses,
      symbolWhitelist: new Set(
        input?.typography?.symbolWhitelist ?? defaultOptions.typography.symbolWhitelist,
      ),
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
    ignore: {
      file: input?.ignore?.file ?? defaultOptions.ignore.file,
      start: input?.ignore?.start ?? defaultOptions.ignore.start,
      end: input?.ignore?.end ?? defaultOptions.ignore.end,
      line: input?.ignore?.line ?? defaultOptions.ignore.line,
    },
  };
}
