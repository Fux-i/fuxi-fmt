import { classifyContent, quotePrefix, segment, type AtomicRange, type BlockKind } from './blocks.ts';
import { detect, type Detection } from './detect.ts';
import { checkSemantics } from './guard.ts';
import { english, type MessageArgs, type MessageId } from './messages.ts';
import { hasIgnoreFile, ignoreLines, ignoreRanges, type CharRange } from './ignores.ts';
import { applyEndOfLine, normalizeInput, trimTrailingWhitespace, type Eol } from './hygiene.ts';
import { renumberOrderedLists } from './lists.ts';
import { normalizeFences, trimFenceBlanks } from './fences.ts';
import { normalizeMarkers, normalizeThematicBreak, normalizeUnorderedMarker } from './markers.ts';
import { resolveOptions, type FormatOptions, type FormatOptionsInput } from './options.ts';
import { assignParents, findExcludedLists, planListIndent, scanListItems } from './list-scan.ts';
import {
  isBlockRegionKind,
  looksLikeYamlKey,
  protectedMask,
  scanRegions,
  splitSourceLines,
  type Region,
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

/** 0-based line number containing `offset`. */
function lineOf(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charAt(i) === '\n') line++;
  }
  return line;
}

export interface Diagnostic {
  readonly ruleId: string;
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
  readonly severity: 'error' | 'warning' | 'info';
}

export interface FormatResult {
  readonly output: string;
  readonly changed: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

const ATOMIC_KINDS: Readonly<Record<string, BlockKind>> = {
  frontMatter: 'frontMatter',
  fencedCode: 'code',
  indentedCode: 'code',
  htmlBlock: 'html',
  mathBlock: 'code',
};

function blankCount(existing: number, options: FormatOptions): number {
  const { aroundBlocks, maxConsecutive } = options.blankLines;
  const cap = maxConsecutive === null ? Number.POSITIVE_INFINITY : Math.max(1, maxConsecutive);
  if (aroundBlocks === 'exact') return Math.min(1, cap);
  return Math.min(Math.max(1, existing), cap);
}

/** Index of the line containing `offset`, or -1. */
function lineAt(lines: readonly SourceLine[], offset: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid];
    if (line === undefined) break;
    if (line.start <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Build a diagnostic from a catalogue entry.
 *
 * The English is rendered here, once, from the entry and its arguments; nothing
 * else is allowed to spell a message out. An adapter that speaks another language
 * takes the entry and the arguments and renders its own.
 */
function diagnostic(
  ruleId: string,
  messageId: MessageId,
  args: MessageArgs,
  line: number | undefined,
  severity: 'error' | 'warning' | 'info',
): Diagnostic {
  return { ruleId, messageId, args, message: english(messageId, args), line, severity };
}

const asDiagnostic = (detection: Detection): Diagnostic =>
  diagnostic(detection.ruleId, detection.messageId, detection.args, detection.line, detection.severity);

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
 * The lines a protected region covers.
 *
 * A block region (SAFE-01 – SAFE-04, FM-01) occupies whole lines. A region that
 * is not a block kind can still contain a line ending - an HTML comment, a code
 * span the author wrapped across lines - and every structural pass decides by
 * line, so those lines are protected too. SAFE-01 is a promise about bytes; this
 * is its line-level reading, and the only one, so no two passes can disagree
 * about which lines the formatter must not touch.
 */
function protectedLines(
  text: string,
  lines: readonly SourceLine[],
  regions: readonly Region[],
): boolean[] {
  const out = new Array<boolean>(lines.length).fill(false);
  for (const region of regions) {
    const start = lineAt(lines, region.start);
    const last = lineAt(lines, Math.max(region.start, region.end - 1));
    if (start < 0 || last < 0 || last < start) continue;
    const newline = text.indexOf('\n', region.start);
    const spansLines = newline !== -1 && newline < region.end;
    if (!isBlockRegionKind(region.kind) && !spansLines) continue;
    for (let i = start; i <= last; i++) out[i] = true;
  }
  return out;
}

function atomicRanges(lines: readonly SourceLine[], regions: readonly Region[]): AtomicRange[] {
  const ranges: AtomicRange[] = [];
  for (const region of regions) {
    const kind = ATOMIC_KINDS[region.kind];
    if (kind === undefined) continue;
    const start = lineAt(lines, region.start);
    const last = lineAt(lines, Math.max(region.start, region.end - 1));
    if (start < 0 || last < 0 || last < start) continue;
    ranges.push({ start, end: last + 1, kind });
  }
  return ranges;
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
  if (detections.some((diagnostic) => diagnostic.severity === 'error')) {
    return { output: source, changed: false, diagnostics: orderedDiagnostics(detections.map(asDiagnostic)) };
  }

  const protectedLine = protectedLines(base, lines, regions);
  // CFG-03: an ignored range is copied verbatim, like a protected region.
  const ignoredLines = ignoreLines(base, options.ignore);
  for (let i = 0; i < protectedLine.length; i++) {
    if (ignoredLines[i] === true) protectedLine[i] = true;
  }

  const tabWidth = options.list.tabWidth;
  const normalizedTexts = lines.map((line, index) => {
    if (protectedLine[index] === true) return line.text;
    const expanded = tabWidth === 0 ? line.text : line.text.split('\t').join(' '.repeat(tabWidth));
    return normalizeUnorderedMarker(normalizeMarkers(expanded), options.list.unorderedMarker);
  });

  const renumbered = renumberOrderedLists(normalizedTexts, protectedLine, options.list);
  const texts = normalizeFences(renumbered, ranges, options.codeBlock);
  // BLK-08: normalise list indentation. This runs on the line array rather than
  // on source offsets, which is what makes it safe here: it keeps the line count,
  // so every line-indexed range the segmenter and fence pass use stays valid.
  // Lists containing a protected block are excluded from the plan (option b).
  const listItems = scanListItems(texts, (index) => protectedLine[index] === true);
  const itemLines = new Set(listItems.map((item) => item.line));
  const listBrokeOut: boolean[] = [];
  const listParents = assignParents(listItems, listBrokeOut);
  const excludedLists = new Set(
    findExcludedLists(texts, listItems, listParents, protectedLine),
  );
  // Which list items belong to a list that contains a protected block. Such a
  // list is left alone entirely: BLK-08 already refuses to reindent it, and the
  // blank-line policy has to refuse too. Inserting a blank line inside that list
  // is not cosmetic - a deeply indented item after a blank line is an indented
  // code block, so the "tidy" version of the document parses differently from the
  // version the author wrote, and the guard refuses it. That refusal was real:
  // a list with a code block and an over-indented child would not format at all.
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
  for (const root of excludedLists) {
    const item = listItems[root];
    if (item === undefined) continue;
    detections.push({
      ruleId: 'DET-12',
      messageId: 'det.listExcluded',
      args: [],
      line: item.line,
      severity: 'warning',
    });
  }

  const reindented = [...texts];
  const orderedMin = options.list.orderedIndent === 'aligned' ? 0 : options.list.orderedIndent;
  const unorderedMin =
    options.list.unorderedIndent === 'aligned' ? 0 : options.list.unorderedIndent;
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
  /**
   * The input line an offset into the rebuilt text sits on.
   *
   * Everything from here on is indexed against `structural`, whose lines the
   * blank-line policy may have inserted or removed. A line reported to the author
   * has to be the line they wrote, so this maps through `partLines` and gives up
   * (undefined) rather than guess when the offset lands on an invented blank.
   */
  const inputLineOf = (offset: number): number | undefined => {
    const index = lineAt(structuralLines, offset);
    if (index < 0) return undefined;
    const mapped = partLines[index];
    return mapped === undefined || mapped < 0 ? undefined : mapped;
  };
  // Width first, so that spacing sees ordinary digits; punctuation before
  // spacing, so that TYPO-07 can remove the gaps a conversion leaves behind.
  // The three width passes each rewrite one character for one character, so
  // offsets never move and one mask serves all three - two of the four full
  // region scans per format, measured at about 6%. widths.length.test.ts pins
  // the property that makes this sound rather than hopeful.
  const widthMask = protectedMask(structural, ignoreRanges(structural, options.ignore));
  // TYPO-12 runs before the width passes so that they see the final delimiters;
  // it is a character-for-character rewrite of runs the parser pairs, so nothing
  // downstream can be surprised by it.
  const emphasised = normalizeEmphasis(structural, options.typography.emphasis, widthMask);
  const widths = normalizeFullwidthAlphanumerics(emphasised, options.typography, widthMask);
  const punctuation = normalizePunctuation(widths, options.typography, widthMask);
  const parens = normalizeParens(punctuation, options.typography, widthMask);
  const quoted = normalizeQuotes(parens, options.typography, widthMask);
  const spaced = applyTypography(quoted.text, options.typography, ignoreRanges(quoted.text, options.ignore));
  // BLK-12 runs last of the content rules and before the guard, and it is the only
  // one that removes lines - which is why it is here rather than among the passes
  // that index by line. It is also the only rule the guard has an exception for,
  /**
   * TBL-01 pads table cells, and it runs here because it is the one pass that
   * measures display width: the inline spacing rules have already run, so a cell
   * is measured as the text it finally is. It rewrites lines and adds none.
   *
   * It runs *before* BLK-12 because it is the first pass here that reports a line:
   * BLK-12 is the only rule that removes lines, and a notice has to name the line
   * the author wrote rather than the line the removals left behind. The two do not
   * interact - a fence body is a protected region to this pass.
   */
  const tableLines = splitSourceLines(spaced);
  const tableProtected = protectedLines(spaced, tableLines, scanRegions(spaced));
  // TBL-01 runs last of the content rules, so the mask the earlier passes carry
  // is not in front of it: protected regions and ignored ranges are re-derived
  // here, for the text it is actually holding.
  const tableIgnored = ignoreLines(spaced, options.ignore);
  const tabled = normalizeTables(
    tableLines.map((line) => line.text),
    options.table,
    (index) => tableProtected[index] === true || tableIgnored[index] === true,
  );
  /**
   * The input line a line of `spaced` came from.
   *
   * `spaced` is `structural` after character-level rewrites only, and NG-01 forbids
   * joining or splitting a line, so the two line arrays run parallel and an index
   * is enough. If they ever stop running parallel this gives up the line rather
   * than name the wrong one, which is what `inputLineOf` does for an offset that
   * lands on an invented blank.
   */
  const inputLineAt = (index: number): number | undefined => {
    if (tableLines.length !== parts.length + 1) return undefined;
    const line = partLines[index];
    return line === undefined || line < 0 ? undefined : line;
  };
  const tableDiagnostics: Diagnostic[] = tabled.notices.map((notice) =>
    diagnostic('TBL-01', notice.messageId, notice.args, inputLineAt(notice.line), 'info'),
  );
  // splitSourceLines keeps the empty line a trailing newline produces, so joining
  // is enough: adding one back would double it.
  const tabledText = tabled.lines.join('\n');
  // BLK-12 removes lines, so it runs once every pass that indexes by line is done.
  const edged = options.codeBlock.trimBlankLines ? trimFenceBlanks(tabledText) : tabledText;
  const candidate = trimTrailingWhitespace(edged, ignoreRanges(edged, options.ignore));

  // GRT-01: never hand back a document that parses differently. If the guard
  // trips we return the input untouched and say why (GRT-04).
  const violations = checkSemantics(base, candidate, options.codeBlock.trimBlankLines);
  if (violations.length > 0) {
    return {
      output: source,
      changed: false,
      diagnostics: violations.map((violation) =>
        diagnostic(violation.ruleId, violation.messageId, violation.args, violation.line, 'error'),
      ),
    };
  }

  const eol: Eol = options.endOfLine === 'auto' ? normalized.eol : options.endOfLine;
  const output = applyEndOfLine(candidate, eol);
  // TYPO-11: an unpaired quote is a warning, never a failure. The line keeps what
  // the author wrote, and the author is told which line to look at.
  const diagnostics: Diagnostic[] = quoted.unpaired.map((offset) =>
    diagnostic('TYPO-11', 'typo.unpairedQuote', [], inputLineOf(offset), 'warning'),
  );
  return {
    output,
    changed: output !== source,
    diagnostics: orderedDiagnostics([
      ...detections.map(asDiagnostic),
      ...tableDiagnostics,
      ...diagnostics,
    ]),
  };
}
