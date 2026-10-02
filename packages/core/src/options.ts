import { DEFAULT_CJK_CLASSES, DEFAULT_SPACING_SYMBOLS, type CjkClass } from './chars.ts';

export type AroundBlocks = 'exact' | 'atLeast';
export type ListBlankLines = 'remove' | 'one' | 'preserve';

export interface BlankLinesOptions {
  /** Whether blocks are separated by exactly one blank line, or at least one. */
  readonly aroundBlocks: AroundBlocks;
  /** Cap on consecutive blank lines; null means unbounded. */
  readonly maxConsecutive: number | null;
  /** Blank lines between list items (BLK-03). `remove` flips a loose list to
   * tight, `one` flips a tight list to loose, and `preserve` does neither. */
  readonly insideLists: ListBlankLines;
}

export type PunctuationStyle = 'fullwidth' | 'halfwidth' | 'mixed' | 'off';
export type ParenStyle = 'mixed' | 'fullwidth' | 'halfwidth' | 'preserve';
/**
 * How "Chinese context" is decided.
 *
 * 'line' (the default) reads the whole line the mark sits on: a Chinese sentence
 * quoting an English term wants Chinese punctuation around it. 'adjacent' reads
 * only the nearest significant characters beside the mark, which keeps a mark
 * inside a Latin run half-width but cannot see a CJK character that a space or
 * an emphasis marker put out of reach.
 */
export type ContextMode = 'line' | 'adjacent';

export interface TypographyOptions {
  /** Insert one space at every CJK to non-CJK boundary (TYPO-01). */
  readonly cjkSpacing: boolean;
  /** Direction of punctuation width normalisation (TYPO-05). */
  readonly punctuationStyle: PunctuationStyle;
  /** Half-width marks eligible for conversion (TYPO-05). */
  readonly punctuationChangeList: readonly string[];
  /** Full-width alphanumerics become half-width (TYPO-06). */
  readonly halfwidthAlphanumerics: boolean;
  /** U+3000 becomes a normal space (TYPO-06). */
  readonly ideographicSpace: boolean;
  /** Space a mid-text '#' from CJK; off by default (TYPO-09). */
  readonly hashtag: boolean;
  /** Parenthesis width, by the script of the contents (TYPO-08). */
  readonly parenStyle: ParenStyle;
  /** How Chinese context is decided for every width rule (TYPO-05, TYPO-08). */
  readonly context: ContextMode;
  /** Which scripts count as CJK. Defaults to Han alone. */
  readonly cjkClasses: readonly CjkClass[];
  /** Symbols CJK spacing treats as word characters (TYPO-01). */
  readonly symbolWhitelist: ReadonlySet<string>;
}

export type EndOfLine = 'lf' | 'crlf' | 'auto';
/** How far a nested ORDERED item's marker sits past its parent's content. */
export type OrderedIndent = 'aligned' | 4;
/** The same for an unordered item. */
export type UnorderedIndent = 'aligned' | 3 | 4;
export type UnorderedMarker = 'dashes' | 'asterisks' | 'preserve';
export type FenceChar = 'backticks' | 'tildes' | 'preserve';
export type OrderedStyle = 'renumber' | 'keep-all-ones' | 'preserve';
export type OrderedDelimiter = 'preserve' | '.' | ')';

export interface ListOptions {
  /**
   * 'renumber' numbers sequentially from the declared start.
   * 'keep-all-ones' is the default: the same, except that a list the author
   * wrote with lazy all-ones markers is left that way, matching Prettier and
   * dprint and keeping diffs minimal for the git-diff-friendly style.
   * 'preserve' leaves every number exactly as written.
   */
  readonly orderedStyle: OrderedStyle;
  readonly orderedDelimiter: OrderedDelimiter;
  /** Width used when expanding hard tabs; 'tab' leaves them alone (BLK-11). */
  readonly orderedIndent: OrderedIndent;
  readonly unorderedIndent: UnorderedIndent;
  /** Width hard tabs are expanded to. 0 leaves them exactly as written. The
   * editor's own `editor.tabSize` governs this in VS Code, so it is deliberately
   * not contributed as a fuxi-fmt setting. */
  readonly tabWidth: number;
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
  readonly insideLists?: ListBlankLines;
}

export interface TypographyInput {
  readonly cjkSpacing?: boolean;
  readonly punctuationStyle?: PunctuationStyle;
  readonly punctuationChangeList?: readonly string[];
  readonly halfwidthAlphanumerics?: boolean;
  readonly ideographicSpace?: boolean;
  readonly hashtag?: boolean;
  readonly parenStyle?: ParenStyle;
  readonly context?: ContextMode;
  readonly cjkClasses?: readonly CjkClass[];
  readonly symbolWhitelist?: readonly string[];
}

export interface ListInput {
  readonly orderedStyle?: OrderedStyle;
  readonly orderedDelimiter?: OrderedDelimiter;
  readonly orderedIndent?: OrderedIndent;
  readonly unorderedIndent?: UnorderedIndent;
  readonly tabWidth?: number;
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
  blankLines: { aroundBlocks: 'exact', maxConsecutive: 1, insideLists: 'remove' },
  typography: {
    cjkSpacing: true,
    punctuationStyle: 'fullwidth',
    punctuationChangeList: [',', '.', ':', '!', '?', ';'],
    halfwidthAlphanumerics: true,
    ideographicSpace: true,
    hashtag: false,
    parenStyle: 'mixed',
    context: 'line',
    cjkClasses: DEFAULT_CJK_CLASSES,
    symbolWhitelist: new Set(DEFAULT_SPACING_SYMBOLS),
  },
  list: {
    orderedStyle: 'keep-all-ones',
    orderedDelimiter: 'preserve',
    orderedIndent: 'aligned',
    unorderedIndent: 'aligned',
    tabWidth: 2,
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
      insideLists: input?.blankLines?.insideLists ?? defaultOptions.blankLines.insideLists,
    },
    typography: {
      cjkSpacing: input?.typography?.cjkSpacing ?? defaultOptions.typography.cjkSpacing,
      punctuationStyle:
        input?.typography?.punctuationStyle ?? defaultOptions.typography.punctuationStyle,
      punctuationChangeList:
        input?.typography?.punctuationChangeList ??
        defaultOptions.typography.punctuationChangeList,
      halfwidthAlphanumerics:
        input?.typography?.halfwidthAlphanumerics ??
        defaultOptions.typography.halfwidthAlphanumerics,
      ideographicSpace:
        input?.typography?.ideographicSpace ?? defaultOptions.typography.ideographicSpace,
      hashtag: input?.typography?.hashtag ?? defaultOptions.typography.hashtag,
      parenStyle: input?.typography?.parenStyle ?? defaultOptions.typography.parenStyle,
      context: input?.typography?.context ?? defaultOptions.typography.context,
      cjkClasses: input?.typography?.cjkClasses ?? defaultOptions.typography.cjkClasses,
      symbolWhitelist: new Set(
        input?.typography?.symbolWhitelist ?? defaultOptions.typography.symbolWhitelist,
      ),
    },
    list: {
      orderedStyle: input?.list?.orderedStyle ?? defaultOptions.list.orderedStyle,
      orderedDelimiter: input?.list?.orderedDelimiter ?? defaultOptions.list.orderedDelimiter,
      orderedIndent: input?.list?.orderedIndent ?? defaultOptions.list.orderedIndent,
      unorderedIndent: input?.list?.unorderedIndent ?? defaultOptions.list.unorderedIndent,
      tabWidth: input?.list?.tabWidth ?? defaultOptions.list.tabWidth,
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
