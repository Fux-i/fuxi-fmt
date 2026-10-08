import { DEFAULT_CJK_CLASSES, DEFAULT_SPACING_SYMBOLS, type CjkClass } from './chars.ts';

export type AroundBlocks = 'exact' | 'atLeast';
export type ListBlankLines = 'remove' | 'one' | 'preserve';
export type BlockquoteBlankLines = 'trim' | 'preserve';

export interface BlankLinesOptions {
  /** Whether blocks are separated by exactly one blank line, or at least one. */
  readonly aroundBlocks: AroundBlocks;
  /** Cap on consecutive blank lines; null means unbounded. */
  readonly maxConsecutive: number | null;
  /** Blank lines between list items (BLK-03). `remove` flips a loose list to
   * tight, `one` flips a tight list to loose, and `preserve` does neither. */
  readonly insideLists: ListBlankLines;
  /**
   * The blank lines at the head and tail of a block quote's own content
   * (BLK-14). `trim` drops them, `preserve` keeps them where the author put
   * them. Only the edges: blanks between two blocks are BLK-01's business, and
   * the blank that *ends* a quote is an empty line, which no mode touches.
   */
  readonly insideBlockquotes: BlockquoteBlankLines;
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
/**
 * Straight double quotes become paired Chinese quotation marks.
 *
 * Only '"' is converted. The apostrophe is never touched: ' and ’ are the same
 * codepoint family and no rule can tell "don't" from an opening single quote
 * without guessing, so nothing is guessed.
 */
export type QuoteStyle = 'preserve' | 'paired';
/**
 * Which character a thematic break is written with (BLK-13).
 *
 * `preserve` leaves the author's choice of character and run length alone; the
 * other three normalise every break to exactly three of the chosen character,
 * because length and internal spaces carry no meaning.
 */
export type ThematicBreak = 'dashes' | 'asterisks' | 'underscores' | 'preserve';
export type TableMode = 'preserve' | 'normalize';
export type CjkWidth = 1 | 2;

/**
 * Table padding and alignment (TBL-01).
 *
 * `normalize` is the default: a table is the one block whose source layout *is*
 * its presentation, which is exactly why a ragged one is worth fixing - a column
 * only lines up if every row starts at the same column. `preserve` hands the
 * layout back to the author. `maxWidth` caps the padded width: a row that would
 * exceed it is left exactly as written, so a few long rows cannot make the rest
 * long with them.
 * `cjkWidth` is how many columns a wide character occupies in the font being
 * read - two in a fixed-pitch font, one in a proportional one.
 */
export interface TableOptions {
  readonly mode: TableMode;
  readonly maxWidth: number | null;
  readonly cjkWidth: CjkWidth;
}

export type StrongStyle = 'asterisks' | 'underscores' | 'preserve';
export type EmStyle = 'asterisk' | 'underscore' | 'preserve';
export type StrikeStyle = 'double' | 'single' | 'preserve';

/**
 * Which delimiter each emphasis kind is written with (TYPO-12).
 *
 * `preserve` for all three is the default, because a rewrite here changes bytes
 * the author typed deliberately and Markdown renders both spellings the same -
 * under a renderer that understands them. One tilde is strikethrough in some
 * dialects and literal text in others, which is why `strikethrough` says so in its
 * description rather than guessing.
 */
export interface EmphasisOptions {
  readonly strong: StrongStyle;
  readonly em: EmStyle;
  readonly strikethrough: StrikeStyle;
}

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
  /** Straight double quotes to paired Chinese marks (TYPO-11). */
  readonly quotes: QuoteStyle;
  /** Which delimiter each emphasis kind is written with (TYPO-12). */
  readonly emphasis: EmphasisOptions;
  /** Which scripts count as CJK. Defaults to Han alone. */
  readonly cjkClasses: readonly CjkClass[];
  /**
   * Symbols CJK spacing treats as word characters (TYPO-01). Named for what they
   * do rather than for what they are: the old name, `symbolWhitelist`, said
   * nothing about spacing and had to be read twice.
   */
  readonly spacingSymbols: ReadonlySet<string>;
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
  /**
   * How many delimiter characters the fence is written with: as many as its body
   * requires, and no more (BLK-10). The old name, `normalizeLength`, read as
   * "tidy the block up" and a user reasonably expected it to trim blank lines -
   * that is `trimBlankLines`, a different job on different bytes.
   */
  readonly fenceLength: boolean;
  /**
   * Drop blank lines at the edges of a fence body (BLK-12). The only rule in the
   * tool that changes protected bytes, and therefore the only entry in the
   * specification's intentional-differences list.
   */
  readonly trimBlankLines: boolean;
}

export interface CodeBlockInput {
  readonly fenceChar?: FenceChar;
  readonly fenceLength?: boolean;
  readonly trimBlankLines?: boolean;
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
  /** The character a thematic break is written with (BLK-13). */
  readonly thematicBreak: ThematicBreak;
  /** Table padding, alignment and width (TBL-01). */
  readonly table: TableOptions;
  readonly endOfLine: EndOfLine;
  readonly ignore: IgnoreOptions;
}

export interface BlankLinesInput {
  readonly aroundBlocks?: AroundBlocks;
  readonly maxConsecutive?: number | null;
  readonly insideLists?: ListBlankLines;
  readonly insideBlockquotes?: BlockquoteBlankLines;
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
  readonly quotes?: QuoteStyle;
  readonly emphasis?: EmphasisInput;
  readonly cjkClasses?: readonly CjkClass[];
  readonly spacingSymbols?: readonly string[];
}

export interface TableInput {
  readonly mode?: TableMode;
  readonly maxWidth?: number | null;
  readonly cjkWidth?: CjkWidth;
}

export interface EmphasisInput {
  readonly strong?: StrongStyle;
  readonly em?: EmStyle;
  readonly strikethrough?: StrikeStyle;
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
  readonly thematicBreak?: ThematicBreak;
  readonly table?: TableInput;
  readonly endOfLine?: EndOfLine;
  readonly ignore?: IgnoreInput;
}

export const defaultOptions: FormatOptions = {
  blankLines: {
    aroundBlocks: 'exact',
    maxConsecutive: 1,
    insideLists: 'remove',
    insideBlockquotes: 'trim',
  },
  typography: {
    cjkSpacing: true,
    punctuationStyle: 'fullwidth',
    punctuationChangeList: [',', '.', ':', '!', '?', ';'],
    halfwidthAlphanumerics: true,
    ideographicSpace: true,
    hashtag: false,
    parenStyle: 'mixed',
    context: 'line',
    quotes: 'paired',
    emphasis: { strong: 'preserve', em: 'preserve', strikethrough: 'preserve' },
    cjkClasses: DEFAULT_CJK_CLASSES,
    spacingSymbols: new Set(DEFAULT_SPACING_SYMBOLS),
  },
  list: {
    orderedStyle: 'keep-all-ones',
    orderedDelimiter: 'preserve',
    orderedIndent: 'aligned',
    unorderedIndent: 'aligned',
    tabWidth: 2,
    unorderedMarker: 'dashes',
  },
  codeBlock: { fenceChar: 'backticks', fenceLength: true, trimBlankLines: true },
  thematicBreak: 'dashes',
  table: { mode: 'normalize', maxWidth: 80, cjkWidth: 2 },
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
      insideBlockquotes:
        input?.blankLines?.insideBlockquotes ?? defaultOptions.blankLines.insideBlockquotes,
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
      quotes: input?.typography?.quotes ?? defaultOptions.typography.quotes,
      emphasis: {
        strong: input?.typography?.emphasis?.strong ?? defaultOptions.typography.emphasis.strong,
        em: input?.typography?.emphasis?.em ?? defaultOptions.typography.emphasis.em,
        strikethrough:
          input?.typography?.emphasis?.strikethrough ??
          defaultOptions.typography.emphasis.strikethrough,
      },
      cjkClasses: input?.typography?.cjkClasses ?? defaultOptions.typography.cjkClasses,
      spacingSymbols: new Set(
        input?.typography?.spacingSymbols ?? defaultOptions.typography.spacingSymbols,
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
      fenceLength:
        input?.codeBlock?.fenceLength ?? defaultOptions.codeBlock.fenceLength,
      trimBlankLines:
        input?.codeBlock?.trimBlankLines ?? defaultOptions.codeBlock.trimBlankLines,
    },
    thematicBreak: input?.thematicBreak ?? defaultOptions.thematicBreak,
    table: {
      mode: input?.table?.mode ?? defaultOptions.table.mode,
      // null is a meaningful value here too: no cap at all.
      maxWidth:
        input?.table?.maxWidth === undefined
          ? defaultOptions.table.maxWidth
          : input.table.maxWidth,
      cjkWidth: input?.table?.cjkWidth ?? defaultOptions.table.cjkWidth,
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
