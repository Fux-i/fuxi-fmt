import { classifyContent, quotePrefix, segment, type AtomicRange, type BlockKind } from './blocks.ts';
import { detect, type Detection } from './detect.ts';
import { normalizeFrontMatter } from './front-matter.ts';
import { checkSemantics } from './guard.ts';
import { english, type MessageArgs, type MessageId } from './messages.ts';
import { severityOf, type RuleId, type Severity } from './rules.ts';
import { hasIgnoreFile, ignoreLines, ignoreRanges, type CharRange } from './ignores.ts';
import { applyEndOfLine, normalizeInput, trimTrailingWhitespace, type Eol } from './hygiene.ts';
import { renumberOrderedLists } from './lists.ts';
import { normalizeFences, trimFenceBlanks } from './fences.ts';
import { normalizeMarkers, normalizeThematicBreak, normalizeUnorderedMarker } from './markers.ts';
import {
  resolveOptions,
  type FormatOptions,
  type FormatOptionsInput,
  type ListOptions,
} from './options.ts';
import {
  assignParents,
  excludedListLines,
  findExcludedLists,
  planListIndent,
  scanListItems,
} from './list-scan.ts';
import {
  atomicRanges,
  lineIndexOf,
  looksLikeYamlKey,
  proseLines,
  protectedLines,
  protectedMask,
  scanRegions,
  splitSourceLines,
  type SourceLine,
} from './scan.ts';
import { normalizeQuotes } from './quotes.ts';
import { applyTypography } from './typography.ts';
import { normalizeEmphasis } from './emphasis.ts';
import { normalizeTables, scanTables } from './tables.ts';
import { applyBlankPolicy } from './blank-policy.ts';
import { normalizeFullwidthAlphanumerics, normalizeParens, normalizePunctuation } from './widths.ts';

/** The two characters a block marker may be separated by (BLK-09). */
const SPACE = 32;
const TAB = 9;

export interface Diagnostic {
  readonly ruleId: RuleId;
  /** The catalogue entry this sentence came from (CFG-08). */
  readonly messageId: MessageId;
  /** The values its placeholders take, so a translation can place them too. */
  readonly args: MessageArgs;
  /** The English rendering, for an adapter that does not localise. */
  readonly message: string;
  /**
   * 0-based line in the *input*, or `undefined` when the complaint is about the
   * document as a whole: a refused document is refused in one piece, not at a
   * line, and pretending otherwise pointed every refusal at line 1.
   *
   * The location is data. It used to be written into the message as well, which
   * printed it twice in two different bases, and it was taken from the text the
   * formatter had already moved lines in, so a rule could name the line it had
   * moved a problem to rather than the line the author wrote it on.
   */
  readonly line: number | undefined;
  /**
   * 'error' means the document was refused and the input is the output.
   * 'warning' means the document was formatted and something in it wants a look,
   * so a caller that fails a build on 'error' must not fail it on 'warning' - the
   * difference between the two is the whole point of having them. 'info' reports
   * what the formatter did rather than anything wrong with the document, and no
   * caller fails a build on it either.
   */
  readonly severity: Severity;
}

export interface FormatResult {
  readonly output: string;
  readonly changed: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

function blankCount(existing: number, options: FormatOptions): number {
  const { aroundBlocks, maxConsecutive } = options.blankLines;
  const cap = maxConsecutive === null ? Number.POSITIVE_INFINITY : Math.max(1, maxConsecutive);
  if (aroundBlocks === 'exact') return Math.min(1, cap);
  return Math.min(Math.max(1, existing), cap);
}

/**
 * Build a diagnostic from a catalogue entry.
 *
 * The English is rendered here, once, from the entry and its arguments; nothing
 * else is allowed to spell a message out. An adapter that speaks another language
 * takes the entry and the arguments and renders its own.
 */
function diagnostic(
  ruleId: RuleId,
  messageId: MessageId,
  args: MessageArgs,
  line: number | undefined,
): Diagnostic {
  // CFG-02: the level is a property of the rule, so it comes from the table
  // rather than from the caller.
  return {
    ruleId,
    messageId,
    args,
    message: english(messageId, args),
    line,
    severity: severityOf(ruleId),
  };
}

const asDiagnostic = (detection: Detection): Diagnostic =>
  diagnostic(detection.ruleId, detection.messageId, detection.args, detection.line);

/**
 * Errors first, then warnings, then notes; within a severity, by line.
 *
 * The order has to be total. "Error against everything else, and a constant for
 * the rest" is not antisymmetric once there are three severities, and an unstable
 * sort would shuffle warnings among notes.
 */
const SEVERITY_RANK: Readonly<Record<Diagnostic['severity'], number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

function orderedDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.severity !== b.severity) return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    const left = a.line ?? -1;
    const right = b.line ?? -1;
    if (left !== right) return left - right;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

/**
 * Whether a '-' run written directly under this line would be a setext underline.
 *
 * The paragraph may be inside a list item or a block quote, so the marker chain is
 * peeled first - and only the marker chain: a heading or a table row above a break
 * is a different block, and a break under either is still a break. Being wrong in
 * the safe direction costs a rewrite that did not happen.
 */
function opensParagraph(text: string): boolean {
  if (text.trim().length === 0) return false;
  const afterQuote = text.slice(quotePrefix(text).end);
  const item = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/.exec(afterQuote);
  const body = item === null ? afterQuote : afterQuote.slice(item[0].length);
  if (body.trim().length === 0) return false;
  return classifyContent(body) === 'paragraph';
}

/**
 * Where every line of a rebuilt text came from.
 *
 * The blank-line policy inserts and removes lines, so an index into the text the
 * later passes hold is not an index into the input. A line reported to the author
 * has to be the line they wrote, so this carries the mapping and gives up
 * (undefined) rather than guess.
 *
 * It is the only such mapping. It used to be two closures inside format() with two
 * different give-up rules, and the one fact they shared was written down twice.
 */
export interface LineMap {
  /** The input line a line of the rebuilt text came from, or undefined. */
  lineAt(index: number): number | undefined;
  /** The input line an offset into the rebuilt text sits on, or undefined. */
  offsetAt(offset: number): number | undefined;
}

/**
 * Build the map for a rebuilt text whose line `i` came from input line `from[i]`.
 *
 * A negative entry is a line the policy invented, and an index past the end of
 * `from` is one the journal does not cover - which is the empty line a trailing
 * newline produces. Both answer undefined rather than name a line that is not the
 * author's.
 */
export function lineProvenance(lines: readonly SourceLine[], from: readonly number[]): LineMap {
  const source = (index: number): number | undefined => {
    const mapped = from[index];
    return mapped === undefined || mapped < 0 ? undefined : mapped;
  };
  return {
    lineAt: source,
    offsetAt: (offset) => {
      const index = lineIndexOf(lines, offset);
      return index < 0 ? undefined : source(index);
    },
  };
}

/**
 * The character-level rewrites, in the only order that settles.
 *
 * TYPO-12 runs first so the width passes see the final delimiters. Width runs
 * before punctuation so that spacing sees ordinary digits, and punctuation before
 * spacing so that TYPO-07 can remove the gaps a conversion leaves behind. Every
 * step but the last is a character-for-character rewrite, which is what lets one
 * protected mask serve the whole chain: offsets never move. widths.length.test.ts
 * pins the property that makes that sound rather than hopeful.
 *
 * The chain is a module of its own so it can be run over a text and a mask
 * directly - the passes were each tested, and the order they run in could only be
 * exercised through a whole document.
 */
export function rewriteInline(
  text: string,
  options: FormatOptions,
  mask: Uint8Array,
) {
  const typography = options.typography;
  const emphasised = normalizeEmphasis(text, typography.emphasis, mask);
  const widths = normalizeFullwidthAlphanumerics(emphasised, typography, mask);
  const punctuation = normalizePunctuation(widths, typography, mask);
  const parens = normalizeParens(punctuation, typography, mask);
  const quoted = normalizeQuotes(parens, typography, mask);
  return {
    text: applyTypography(quoted.text, typography, ignoreRanges(quoted.text, options.ignore)),
    unpaired: quoted.unpaired,
  };
}

/**
 * TBL-01, then BLK-12, then the trailing whitespace, in the order they require.
 *
 * TBL-01 pads table cells and is the first pass here that reports a line; BLK-12
 * drops the blank lines at the edges of a fence body and is the only rule that
 * removes lines. Run the other way round, a notice would name the line the
 * removals left behind rather than the line the author wrote - which is the whole
 * reason the table pass does not run earlier either, where it would measure a cell
 * before the spacing rules had widened it.
 *
 * Trimming trailing whitespace closes the stage because it is about the file
 * rather than the document, and a Markdown hard break is two spaces at the end of
 * a line: it has to see the lines as they will be written.
 */
/**
 * BLK-08 normalises list indentation, and DET-12 says when it must not.
 *
 * This runs on the line array rather than on source offsets, which is what makes
 * it safe at this point in the pipeline: it keeps the line count, so every
 * line-indexed range the fence pass and the segmenter use stays valid.
 *
 * A list that holds a protected block is left alone entirely. BLK-08 refuses to
 * reindent it, and the blank-line policy has to refuse too, because a deeply
 * indented item after an inserted blank line is an indented code block: the tidy
 * version of the document would parse differently from the one the author wrote,
 * and the guard would refuse it. Moving code the author placed at a fixed
 * indentation is what SAFE-02 exists to prevent.
 */
/**
 * The per-line normalisation, before anything is segmented.
 *
 * BLK-11 expands the hard tabs, BLK-04, BLK-05, BLK-07 and BLK-09 write the
 * markers, BLK-06 renumbers the ordered ones and BLK-10 sets the fence character
 * and length. Every one of them keeps the line count, which is what lets them run
 * on the line array at this point: the ranges the fence pass and the segmenter
 * hold are line indices, and they stay valid.
 *
 * A protected line is copied byte for byte (SAFE-01), which is why the predicate
 * is passed in rather than re-derived here.
 */
export function normalizeLines(
  lines: readonly SourceLine[],
  protectedLine: readonly boolean[],
  options: FormatOptions,
  ranges: readonly AtomicRange[],
): readonly string[] {
  const tabWidth = options.list.tabWidth;
  // A list holding a protected block is not reindented (DET-12), so its lines keep
  // the whitespace they were written with: expanding a tab above a fence but not
  // inside it moves the fence out of the container the scanner found.
  const held =
    tabWidth === 0
      ? new Set<number>()
      : excludedListLines(
          lines.map((line) => line.text),
          (index) => protectedLine[index] === true,
        );
  const marked = lines.map((line, index) => {
    if (protectedLine[index] === true || held.has(index)) return line.text;
    const expanded = tabWidth === 0 ? line.text : line.text.split('\t').join(' '.repeat(tabWidth));
    return normalizeUnorderedMarker(
      normalizeMarkers(expanded, options.typography.cjkClasses),
      options.list.unorderedMarker,
    );
  });
  // BLK-06 then BLK-10: the ordered markers are what the fence pass measures the
  // text around, so the fences are written last.
  return normalizeFences(
    renumberOrderedLists(marked, protectedLine, options.list),
    ranges,
    options.codeBlock,
  );
}

export function planLists(
  texts: readonly string[],
  protectedLine: readonly boolean[],
  list: ListOptions,
): {
  readonly reindented: readonly string[];
  readonly excludedItemLines: ReadonlySet<number>;
  readonly diagnostics: readonly Detection[];
} {
  const listItems = scanListItems(texts, (index) => protectedLine[index] === true);
  const listBrokeOut: boolean[] = [];
  const listParents = assignParents(listItems, listBrokeOut);
  const excludedLists = new Set(findExcludedLists(texts, listItems, listParents, protectedLine));

  // Which list items belong to a list that holds a protected block, by walking each
  // item up to the root of its chain.
  const excludedItemLines = new Set<number>();
  for (let i = 0; i < listItems.length; i++) {
    const item = listItems[i];
    if (item === undefined) continue;
    let at = i;
    const seen = new Set<number>();
    for (;;) {
      const parent = listParents[at];
      if (parent === undefined || parent === -1 || seen.has(at)) break;
      seen.add(at);
      at = parent;
    }
    if (excludedLists.has(at)) excludedItemLines.add(item.line);
  }

  const diagnostics: Detection[] = [];
  for (const root of excludedLists) {
    const item = listItems[root];
    if (item === undefined) continue;
    diagnostics.push({
      ruleId: 'DET-12',
      messageId: 'det.listExcluded',
      args: [],
      line: item.line,
    });
  }

  const reindented = [...texts];
  const orderedMin = list.orderedIndent === 'aligned' ? 0 : list.orderedIndent;
  const unorderedMin = list.unorderedIndent === 'aligned' ? 0 : list.unorderedIndent;
  for (const change of planListIndent(
    texts,
    listItems,
    listParents,
    excludedLists,
    orderedMin,
    unorderedMin,
    listBrokeOut,
  )) {
    reindented[change.line] = change.text;
  }
  return { reindented, excludedItemLines, diagnostics };
}

export function closeContent(
  spaced: string,
  options: FormatOptions,
  provenance: LineMap,
): { readonly text: string; readonly diagnostics: readonly Diagnostic[] } {
  const tableLines = splitSourceLines(spaced);
  // TBL-01 runs last of the content rules, so the mask the earlier passes carried
  // is gone: protected regions and ignored ranges are re-derived for the text this
  // pass is actually holding.
  const tableProtected = protectedLines(spaced, tableLines, scanRegions(spaced));
  const tableIgnored = ignoreLines(spaced, options.ignore);
  const tabled = normalizeTables(
    tableLines.map((line) => line.text),
    options.table,
    (index) => tableProtected[index] === true || tableIgnored[index] === true,
  );
  const diagnostics = tabled.notices.map((notice) =>
    diagnostic('TBL-01', notice.messageId, notice.args, provenance.lineAt(notice.line)),
  );
  // splitSourceLines keeps the empty line a trailing newline produces, so joining
  // is enough: adding one back would double it.
  const tabledText = tabled.lines.join('\n');
  const edged = options.codeBlock.trimBlankLines ? trimFenceBlanks(tabledText) : tabledText;
  return { text: trimTrailingWhitespace(edged, ignoreRanges(edged, options.ignore)), diagnostics };
}

/**
 * FM-03. Hand a closed YAML front matter block to the serializer.
 *
 * The substitution is a prefix replacement rather than an edit inside the text
 * the pipeline is holding, which is safe for the reason no rule needed to touch
 * the block: it starts at offset 0 and every pass treats its lines as protected.
 *
 * A block that does not parse is kept exactly as written and reported (FM-05).
 * The TOML form is not parsed here at all; FM-06 owns it and reports separately.
 */
function applyFrontMatter(
  text: string,
  options: FormatOptions,
): { readonly text: string; readonly diagnostics: Detection[] } {
  if (options.frontMatter.format === 'preserve') return { text, diagnostics: [] };
  const region = scanRegions(text).find(
    (candidate) => candidate.kind === 'frontMatter' && candidate.start === 0,
  );
  if (region === undefined || region.closed !== true) return { text, diagnostics: [] };
  const block = text.slice(0, region.end);
  if (!block.startsWith('---')) return { text, diagnostics: [] };
  const normalized = normalizeFrontMatter(
    block,
    options.frontMatter.typography ? options.typography : null,
  );
  if (normalized.malformed) {
    return {
      text,
      diagnostics: [{ ruleId: 'FM-05', messageId: 'fm.unparseable', args: [], line: 0 }],
    };
  }
  if (normalized.text === null) return { text, diagnostics: [] };
  return { text: normalized.text + text.slice(region.end), diagnostics: [] };
}

export function format(source: string, input?: FormatOptionsInput): FormatResult {
  const options = resolveOptions(input);

  // A document can opt out entirely. Returning the source rather than the
  // normalised text keeps the promise that an ignored file is untouched - byte
  // order mark and line endings included.
  if (hasIgnoreFile(source, options.ignore.file)) {
    return { output: source, changed: false, diagnostics: [] };
  }

  // BLK-11: the byte order mark and the line ending belong to the file, not the
  // document, so they are settled before anything else looks at the text.
  const normalized = normalizeInput(source);
  const base = normalized.text;

  const lines = splitSourceLines(base);
  const regions = scanRegions(base);
  const ranges = atomicRanges(lines, regions);

  // DET-*: what the parse had to guess. An unterminated block swallowed the rest
  // of the file, so the document is refused before any rule touches a text we
  // already know we misread (GRT-04).
  const detections = detect(base, lines, regions, ignoreRanges(base, options.ignore));
  if (detections.some((detection) => severityOf(detection.ruleId) === 'error')) {
    return { output: source, changed: false, diagnostics: orderedDiagnostics(detections.map(asDiagnostic)) };
  }

  const protectedLine = protectedLines(base, lines, regions);
  // SAFE-03. The lines a code span or a comment crosses are protected, and a
  // protected run used to be read as a block - which split the paragraph it sat in.
  const proseLine = proseLines(base, lines, regions);
  // CFG-03: an ignored range is copied verbatim, like a protected region.
  const ignoredLines = ignoreLines(base, options.ignore);
  for (let i = 0; i < protectedLine.length; i++) {
    if (ignoredLines[i] === true) protectedLine[i] = true;
  }

  const texts = normalizeLines(lines, protectedLine, options, ranges);
  const listPlan = planLists(texts, protectedLine, options.list);
  detections.push(...listPlan.diagnostics);
  const reindented = listPlan.reindented;
  const excludedItemLines = listPlan.excludedItemLines;

  // TBL-01 used to run here, and it had to move below the inline passes: padding
  // is measured in display columns, and the spacing rules that insert a space
  // between Han and Latin change a cell's width after the fact. A table measured
  // before them came out one column short - and one column wider on the next pass,
  // which is not idempotent. Segmentation does not need the padding either way.
  // A table is one block, not a run of lines that happen to share a kind: the
  // header may open a list item ('- | a | b |'), and the delimiter row under it
  // reads as a table line of its own. Without this the blank-line policy saw two
  // blocks there and inserted a blank line between them - the one line that stops
  // the two being a table at all.
  const tableRanges: AtomicRange[] = scanTables(
    reindented,
    (index) => protectedLine[index] === true,
  ).map((table) => ({
    start: table.header,
    end: (table.rows[table.rows.length - 1] ?? table.delimiter) + 1,
    kind: 'table' as BlockKind,
  }));
  const blocks = segment(reindented, [...ranges, ...tableRanges]);

  // BLK-01/02/03. The policy is applied one level at a time: a block quote is a
  // prefix, so the lines inside it are a document of their own (BLK-14) and a
  // blank line there is written with that level's chain - which is what lets a
  // quoted list's blanks be managed without merging two quotes into one.
  const assembled = applyBlankPolicy(reindented, {
    options,
    protectedLine,
    proseLine,
    excludedItemLines,
    ranges: [...ranges, ...tableRanges],
  });
  const parts = assembled.lines;
  // Where every emitted line came from: the input line index, or -1 for a blank
  // the blank-line policy invented. Diagnostics describe the input, so a rule
  // that reports a line maps back through this instead of counting the lines of
  // whatever text it happens to be holding.
  const partLines = assembled.from;

  /**
   * BLK-13. A thematic break is three of the chosen character.
   *
   * This runs on the assembled lines rather than in the per-line pass above,
   * because the blank-line policy is what decides whether the rewrite is safe.
   * Three dashes directly under a paragraph is a setext heading underline (which is
   * why segment() keeps those two lines together) and three dashes on line 1 above
   * a YAML key open front matter; both would turn a break into a different node.
   * Once the policy has put a blank line between two separate blocks, the first
   * hazard is gone - and inside a block quote, where the policy stands down, it is
   * not, so the check stays.
   */
  const trimmed = options.thematicBreak === 'preserve' ? parts : parts.map((text, index) => {
    const inputLine = partLines[index];
    if (inputLine === undefined || inputLine < 0 || protectedLine[inputLine] === true) return text;
    // A break inside a block quote is still a break - the marker chain is a prefix,
    // not a wall - so it is peeled, checked and put back byte for byte.
    const quote = quotePrefix(text);
    const after = text.charCodeAt(quote.end);
    const head =
      quote.depth > 0 && (after === SPACE || after === TAB)
        ? text.slice(0, quote.end + 1)
        : text.slice(0, quote.end);
    const body = text.slice(head.length);
    if (classifyContent(body) !== 'break') return text;
    if (options.thematicBreak === 'dashes') {
      const above = index > 0 ? parts[index - 1] : undefined;
      if (above !== undefined && above.trim().length > 0 && opensParagraph(above)) return text;
      if (index === 0) {
        const below = parts.slice(1).find((line) => line.trim().length > 0);
        if (below !== undefined && looksLikeYamlKey(below)) return text;
      }
    }
    return head + normalizeThematicBreak(body, options.thematicBreak);
  });

  const structural = trimmed.length === 0 ? '' : trimmed.join('\n') + '\n';
  const structuralLines = splitSourceLines(structural);
  // Everything from here on is indexed against `structural`, whose lines the
  // blank-line policy may have inserted or removed, so a line reported to the
  // author is mapped back through `parts`.
  const provenance = lineProvenance(structuralLines, partLines);
  // Width first, so that spacing sees ordinary digits; punctuation before
  // spacing, so that TYPO-07 can remove the gaps a conversion leaves behind.
  // The three width passes each rewrite one character for one character, so
  // offsets never move and one mask serves all three - two of the four full
  // region scans per format, measured at about 6%. widths.length.test.ts pins
  // the property that makes this sound rather than hopeful.
  const widthMask = protectedMask(structural, ignoreRanges(structural, options.ignore));
  const inline = rewriteInline(structural, options, widthMask);
  const spaced = inline.text;
  const closed = closeContent(spaced, options, provenance);
  const frontMatter = applyFrontMatter(closed.text, options);
  const candidate = frontMatter.text;
  const tableDiagnostics = closed.diagnostics;

  // GRT-01: never hand back a document that parses differently. If the guard
  // trips we return the input untouched and say why (GRT-04).
  const violations = checkSemantics(base, candidate, options.codeBlock.trimBlankLines, {
    format: options.frontMatter.format,
    typography: options.frontMatter.typography,
  });
  if (violations.length > 0) {
    return {
      output: source,
      changed: false,
      diagnostics: violations.map((violation) =>
        diagnostic(violation.ruleId, violation.messageId, violation.args, violation.line),
      ),
    };
  }

  const eol: Eol = options.endOfLine === 'auto' ? normalized.eol : options.endOfLine;
  const output = applyEndOfLine(candidate, eol);
  // TYPO-11: an unpaired quote is a warning, never a failure. The line keeps what
  // the author wrote, and the author is told which line to look at.
  const diagnostics: Diagnostic[] = inline.unpaired.map((offset) =>
    diagnostic('TYPO-11', 'typo.unpairedQuote', [], provenance.offsetAt(offset)),
  );
  return {
    output,
    changed: output !== source,
    diagnostics: orderedDiagnostics([
      ...detections.map(asDiagnostic),
      ...tableDiagnostics,
      ...frontMatter.diagnostics.map(asDiagnostic),
      ...diagnostics,
    ]),
  };
}