import { CJK_CLASSES, DEFAULT_CJK_CLASSES, DEFAULT_SPACING_SYMBOLS, type CjkClass } from './chars.ts';

export const AROUND_BLOCKS = ['exact', 'atLeast'] as const;
export type AroundBlocks = (typeof AROUND_BLOCKS)[number];
export const LIST_BLANK_LINES = ['remove', 'one', 'preserve'] as const;
export type ListBlankLines = (typeof LIST_BLANK_LINES)[number];
export const BLOCKQUOTE_BLANK_LINES = ['trim', 'preserve'] as const;
export type BlockquoteBlankLines = (typeof BLOCKQUOTE_BLANK_LINES)[number];

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

export const PUNCTUATION_STYLES = ['fullwidth', 'halfwidth', 'mixed', 'off'] as const;
export type PunctuationStyle = (typeof PUNCTUATION_STYLES)[number];
export const PAREN_STYLES = ['mixed', 'fullwidth', 'halfwidth', 'preserve'] as const;
export type ParenStyle = (typeof PAREN_STYLES)[number];
/**
 * How "Chinese context" is decided.
 *
 * 'line' (the default) reads the whole line the mark sits on: a Chinese sentence
 * quoting an English term wants Chinese punctuation around it. 'adjacent' reads
 * only the nearest significant characters beside the mark, which keeps a mark
 * inside a Latin run half-width but cannot see a CJK character that a space or
 * an emphasis marker put out of reach.
 */
export const CONTEXT_MODES = ['line', 'adjacent'] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];
/**
 * Straight double quotes become paired Chinese quotation marks.
 *
 * Only '"' is converted. The apostrophe is never touched: ' and ’ are the same
 * codepoint family and no rule can tell "don't" from an opening single quote
 * without guessing, so nothing is guessed.
 */
export const QUOTE_STYLES = ['preserve', 'paired'] as const;
export type QuoteStyle = (typeof QUOTE_STYLES)[number];
/**
 * Which character a thematic break is written with (BLK-13).
 *
 * `preserve` leaves the author's choice of character and run length alone; the
 * other three normalise every break to exactly three of the chosen character,
 * because length and internal spaces carry no meaning.
 */
export const THEMATIC_BREAKS = ['dashes', 'asterisks', 'underscores', 'preserve'] as const;
export type ThematicBreak = (typeof THEMATIC_BREAKS)[number];
export const TABLE_MODES = ['preserve', 'normalize'] as const;
export type TableMode = (typeof TABLE_MODES)[number];
/**
 * How many Latin advances a wide character occupies (TBL-01).
 *
 * A real number between these two, not a choice: a font designed 1:2 is 2, while
 * an ideograph of 1 em against a 0.6 em Latin advance is about 1.67. The cell is
 * rounded once, after summing, so the table still pads to whole columns.
 */
export const CJK_WIDTH_RANGE = { min: 1, max: 2 } as const;
export type CjkWidth = number;
/**
 * What happens to a YAML front matter block (FM-03).
 *
 * There is no "off": turning protection off would format YAML as Markdown, which
 * is worse than either mode here. `normalize` is the serializer's output,
 * `preserve` is what the author wrote.
 */
export const FRONT_MATTER_FORMATS = ['normalize', 'preserve'] as const;
export type FrontMatterFormat = (typeof FRONT_MATTER_FORMATS)[number];

/**
 * Table padding and alignment (TBL-01).
 *
 * `normalize` is the default: a table is the one block whose source layout *is*
 * its presentation, which is exactly why a ragged one is worth fixing - a column
 * only lines up if every row starts at the same column. `preserve` hands the
 * layout back to the author. `maxWidth` caps the padded width: a row wider than
 * the cap on its own does not decide the column widths, and is padded only as far
 * as it stays on the grid, so a few long rows cannot make the rest long with them.
 * `cjkWidth` is how many Latin advances a wide character occupies in the font
 * being read, anywhere in 1 to 2: 2 is the convention for a code font (and what
 * a terminal, or the editor's `fullwidthCharacterWidth: "twoCells"`, centres each
 * one in), while a 1 em ideograph against a 0.6 em Latin advance is about 1.67.
 */
export interface TableOptions {
  readonly mode: TableMode;
  readonly maxWidth: number | null;
  readonly cjkWidth: CjkWidth;
}

export const STRONG_STYLES = ['asterisks', 'underscores', 'preserve'] as const;
export type StrongStyle = (typeof STRONG_STYLES)[number];
export const EM_STYLES = ['asterisk', 'underscore', 'preserve'] as const;
export type EmStyle = (typeof EM_STYLES)[number];
export const STRIKE_STYLES = ['double', 'single', 'preserve'] as const;
export type StrikeStyle = (typeof STRIKE_STYLES)[number];

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
  /** Merge a whitespace run at a boundary into one space (TYPO-02). */
  readonly collapseBoundarySpaces: boolean;
  /** Direction of punctuation width normalisation (TYPO-05). */
  readonly punctuationStyle: PunctuationStyle;
  /** Half-width marks eligible for conversion (TYPO-05). */
  readonly punctuationChangeList: readonly string[];
  /** Full-width alphanumerics become half-width (TYPO-06). */
  readonly halfwidthAlphanumerics: boolean;
  /** U+3000 becomes a normal space (TYPO-06). */
  readonly ideographicSpace: boolean;
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

export const END_OF_LINES = ['lf', 'crlf', 'auto'] as const;
export type EndOfLine = (typeof END_OF_LINES)[number];
/** How far a nested ORDERED item's marker sits past its parent's content. */
export const ORDERED_INDENTS = ['aligned', 4] as const;
export type OrderedIndent = (typeof ORDERED_INDENTS)[number];
/** The same for an unordered item. */
export const UNORDERED_INDENTS = ['aligned', 3, 4] as const;
export type UnorderedIndent = (typeof UNORDERED_INDENTS)[number];
export const UNORDERED_MARKERS = ['dashes', 'asterisks', 'preserve'] as const;
export type UnorderedMarker = (typeof UNORDERED_MARKERS)[number];
export const FENCE_CHARS = ['backticks', 'tildes', 'preserve'] as const;
export type FenceChar = (typeof FENCE_CHARS)[number];
export const ORDERED_STYLES = ['renumber', 'keep-all-ones', 'preserve'] as const;
export type OrderedStyle = (typeof ORDERED_STYLES)[number];
export const ORDERED_DELIMITERS = ['preserve', '.', ')'] as const;
export type OrderedDelimiter = (typeof ORDERED_DELIMITERS)[number];

export interface ListOptions {
  /**
   * 'renumber' numbers sequentially from the declared start.
   * 'keep-all-ones' is the default: the same, except that a list whose first
   * two markers are both '1.' is left that way - the lazy all-ones style, which
   * keeps diffs minimal. Prettier keys on the second marker alone, which is a
   * wider criterion; the rendered numbering is the same either way.
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

/** YAML front matter (FM-01 ... FM-05). */
export interface FrontMatterOptions {
  /** Whether the block is handed to the YAML serializer (FM-03). */
  readonly format: FrontMatterFormat;
  /**
   * Whether the typography spacing rules also apply inside the block (FM-04).
   *
   * On by default, like the body: CJK spacing should not stop at the second
   * `---` of a document. Only spaces are ever inserted or removed - punctuation,
   * quotes and widths are never converted in there, because those are data.
   *
   * It does change what a value says: `title: 使用Vite构建` becomes
   * `title: 使用 Vite 构建`, which is what a reader of the page sees. Turning it
   * off is explicit, and `format: preserve` keeps the whole block byte for byte.
   */
  readonly typography: boolean;
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
  /** YAML front matter, the block another tool reads (FM-03). */
  readonly frontMatter: FrontMatterOptions;
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
  readonly collapseBoundarySpaces?: boolean;
  readonly punctuationStyle?: PunctuationStyle;
  readonly punctuationChangeList?: readonly string[];
  readonly halfwidthAlphanumerics?: boolean;
  readonly ideographicSpace?: boolean;
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

export interface FrontMatterInput {
  readonly format?: FrontMatterFormat;
  readonly typography?: boolean;
}

export interface FormatOptionsInput {
  readonly blankLines?: BlankLinesInput;
  readonly typography?: TypographyInput;
  readonly list?: ListInput;
  readonly codeBlock?: CodeBlockInput;
  readonly thematicBreak?: ThematicBreak;
  readonly table?: TableInput;
  readonly frontMatter?: FrontMatterInput;
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
    collapseBoundarySpaces: true,
    punctuationStyle: 'fullwidth',
    punctuationChangeList: [',', '.', ':', '!', '?', ';'],
    halfwidthAlphanumerics: true,
    ideographicSpace: true,
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
  frontMatter: { format: 'normalize', typography: true },
  endOfLine: 'lf',
  ignore: {
    file: 'fuxi-fmt-ignore-file',
    start: 'fuxi-fmt-ignore-start',
    end: 'fuxi-fmt-ignore-end',
    line: 'fuxi-fmt-ignore',
  },
};

/**
 * Take the input's value where it has one, and the default where it does not.
 *
 * A leaf that is `null` is a value: `null` means unbounded for a cap, so the
 * fallback applies only to `undefined`. Walking the vocabulary rather than
 * spelling out every field means a leaf added there is resolved by construction.
 */
function resolveNode(
  spec: Record<string, unknown>,
  defaults: Record<string, unknown>,
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(spec)) {
    const leaf = child as Record<string, unknown>;
    const given = input?.[key];
    if (typeof leaf['kind'] === 'string') {
      out[key] = given === undefined ? defaults[key] : given;
      if (leaf['kind'] === 'stringSet') out[key] = new Set(out[key] as Iterable<string>);
      continue;
    }
    out[key] = resolveNode(
      leaf,
      (defaults[key] ?? {}) as Record<string, unknown>,
      given as Record<string, unknown> | undefined,
    );
  }
  return out;
}

export function resolveOptions(input?: FormatOptionsInput): FormatOptions {
  return resolveNode(
    OPTION_VOCABULARY as unknown as Record<string, unknown>,
    defaultOptions as unknown as Record<string, unknown>,
    input as unknown as Record<string, unknown> | undefined,
  ) as unknown as FormatOptions;
}

/** How one leaf of the option surface is read, and what it accepts (CFG-01). */
export interface LeafSpec {
  readonly kind:
    | 'oneOf'
    | 'oneOfList'
    | 'bool'
    | 'int'
    | 'nullableInt'
    | 'stringList'
    | 'stringSet'
    | 'nonEmptyString';
  /** For the closed vocabularies: every accepted member. */
  readonly values?: readonly (string | number)[];
  /** For 'int' and 'nullableInt': the smallest accepted value. */
  readonly min?: number;
  /** For 'int': the parenthetical the complaint ends with. */
  readonly hint?: string;
  /**
   * The reason this leaf is deliberately not contributed as an editor setting.
   * Absent means it is one: the editor exposes the whole option surface, and the
   * only exceptions are the ones that say why they are exceptions.
   */
  readonly unexposed?: string;
}

/**
 * The option surface, leaf by leaf.
 *
 * This is the one place a leaf is named, and the config reader walks it rather
 * than re-listing what it accepts. An option added here is parsed from a file by
 * construction, which is the property that was missing when four options existed
 * in the defaults and were never read.
 *
 * The resolved types and the defaults are still written out in this module, where
 * the compiler checks their shapes.
 */
export const OPTION_VOCABULARY = {
  blankLines: {
    aroundBlocks: { kind: 'oneOf', values: AROUND_BLOCKS },
    maxConsecutive: { kind: 'nullableInt', min: 1 },
    insideLists: { kind: 'oneOf', values: LIST_BLANK_LINES },
    insideBlockquotes: { kind: 'oneOf', values: BLOCKQUOTE_BLANK_LINES },
  },
  typography: {
    cjkSpacing: { kind: 'bool' },
    collapseBoundarySpaces: { kind: 'bool' },
    punctuationStyle: { kind: 'oneOf', values: PUNCTUATION_STYLES },
    punctuationChangeList: { kind: 'stringList' },
    halfwidthAlphanumerics: { kind: 'bool' },
    ideographicSpace: { kind: 'bool' },
    parenStyle: { kind: 'oneOf', values: PAREN_STYLES },
    context: { kind: 'oneOf', values: CONTEXT_MODES },
    quotes: { kind: 'oneOf', values: QUOTE_STYLES },
    emphasis: {
      strong: { kind: 'oneOf', values: STRONG_STYLES },
      em: { kind: 'oneOf', values: EM_STYLES },
      strikethrough: { kind: 'oneOf', values: STRIKE_STYLES },
    },
    cjkClasses: { kind: 'oneOfList', values: CJK_CLASSES },
    spacingSymbols: { kind: 'stringSet' },
  },
  list: {
    orderedStyle: { kind: 'oneOf', values: ORDERED_STYLES },
    orderedDelimiter: { kind: 'oneOf', values: ORDERED_DELIMITERS },
    orderedIndent: { kind: 'oneOf', values: ORDERED_INDENTS },
    unorderedIndent: { kind: 'oneOf', values: UNORDERED_INDENTS },
    tabWidth: {
      kind: 'int',
      min: 0,
      hint: '0 leaves tabs alone',
      unexposed: 'VS Code already has editor.tabSize; a second one would be a second truth',
    },
    unorderedMarker: { kind: 'oneOf', values: UNORDERED_MARKERS },
  },
  codeBlock: {
    fenceChar: { kind: 'oneOf', values: FENCE_CHARS },
    fenceLength: { kind: 'bool' },
    trimBlankLines: { kind: 'bool' },
  },
  thematicBreak: { kind: 'oneOf', values: THEMATIC_BREAKS },
  table: {
    mode: { kind: 'oneOf', values: TABLE_MODES },
    maxWidth: { kind: 'nullableInt', min: 1 },
    cjkWidth: { kind: 'number', min: CJK_WIDTH_RANGE.min, max: CJK_WIDTH_RANGE.max },
  },
  frontMatter: {
    format: { kind: 'oneOf', values: FRONT_MATTER_FORMATS },
    typography: { kind: 'bool' },
  },
  endOfLine: { kind: 'oneOf', values: END_OF_LINES },
  ignore: {
    file: { kind: 'nonEmptyString' },
    start: { kind: 'nonEmptyString' },
    end: { kind: 'nonEmptyString' },
    line: { kind: 'nonEmptyString' },
  },
} as const;

/**
 * The options deliberately not contributed as editor settings, and why.
 *
 * Derived from the vocabulary rather than kept as a list beside it: the decision
 * belongs where the option is declared, so adding an option forces the choice
 * there instead of in the test that used to hold the list. settings.test.ts reads
 * this to tell a deliberate exclusion from a forgotten setting.
 */
export const UNEXPOSED_OPTIONS: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const child = value as Record<string, unknown>;
      const path = prefix === '' ? key : prefix + '.' + key;
      if (typeof child['kind'] === 'string') {
        const why = child['unexposed'];
        if (typeof why === 'string') out[path] = why;
        continue;
      }
      walk(child, path);
    }
  };
  walk(OPTION_VOCABULARY as unknown as Record<string, unknown>, '');
  return out;
})();

