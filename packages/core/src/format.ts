import { quotePrefix, segment, type AtomicRange, type BlockKind } from './blocks.ts';
import { detect, type Detection } from './detect.ts';
import { checkSemantics } from './guard.ts';
import { english, type MessageArgs, type MessageId } from './messages.ts';
import { hasIgnoreFile, ignoreLines, ignoreRanges, type CharRange } from './ignores.ts';
import { applyEndOfLine, normalizeInput, trimTrailingWhitespace, type Eol } from './hygiene.ts';
import { renumberOrderedLists } from './lists.ts';
import { normalizeFences, trimFenceBlanks } from './fences.ts';
import { normalizeMarkers, normalizeUnorderedMarker } from './markers.ts';
import { resolveOptions, type FormatOptions, type FormatOptionsInput } from './options.ts';
import { assignParents, findExcludedLists, planListIndent, scanListItems } from './list-scan.ts';
import { protectedMask, scanRegions, splitSourceLines, type Region, type SourceLine } from './scan.ts';
import { normalizeQuotes } from './quotes.ts';
import { applyTypography } from './typography.ts';
import { normalizeFullwidthAlphanumerics, normalizeParens, normalizePunctuation } from './widths.ts';

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
   * difference between the two is the whole point of having them.
   */
  readonly severity: 'error' | 'warning';
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
  severity: 'error' | 'warning',
): Diagnostic {
  return { ruleId, messageId, args, message: english(messageId, args), line, severity };
}

const asDiagnostic = (detection: Detection): Diagnostic =>
  diagnostic(detection.ruleId, detection.messageId, detection.args, detection.line, detection.severity);

/** Errors first, then by line: a reader wants the refusal before the nits. */
function orderedDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    const left = a.line ?? -1;
    const right = b.line ?? -1;
    if (left !== right) return left - right;
    return a.ruleId.localeCompare(b.ruleId);
  });
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

  const protectedLine = new Array<boolean>(lines.length).fill(false);
  for (const range of ranges) {
    for (let i = range.start; i < range.end; i++) protectedLine[i] = true;
  }
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
  const listItems = scanListItems(texts);
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

  const blocks = segment(reindented, ranges);

  // BLK-03. A blank line between list items decides how the list renders, so the
  // policy is explicit. Removing one is only safe between items of the *same*
  // list: a blank between different markers separates two lists, and collapsing
  // it would merge them.
  const listBlanks = options.blankLines.insideLists;
  const isItem = (line: number): boolean => itemLines.has(line) && protectedLine[line] !== true;
  const listMarkOf = (index: number): string | null => {
    const block = blocks[index];
    if (block === undefined) return null;
    for (let j = block.start; j < block.end; j++) {
      if (!isItem(j)) continue;
      const item = listItems.find((candidate) => candidate.line === j);
      return item === undefined ? null : item.marker;
    }
    return null;
  };
  const sameList = (a: number, b: number): boolean => {
    const left = listMarkOf(a);
    const right = listMarkOf(b);
    return left !== null && left === right;
  };

  /**
   * A gap between two blocks that both sit inside a block quote.
   *
   * A blank line ends a block quote, so a blank line inserted between two quoted
   * blocks splits one quote into two - and an invented blank is an *empty* line,
   * which the guard's non-blank line count cannot see. The blank-line policy
   * therefore stands down inside quotes and leaves the author's spacing exactly
   * as written. Section 7 item 0 records why the alternative - writing a quoted
   * blank line - is the guard's business rather than this pass's.
   */
  const gapInsideQuote = (index: number): boolean => {
    const block = blocks[index];
    const previous = blocks[index - 1];
    if (block === undefined || previous === undefined) return false;
    const before = reindented[previous.end - 1] ?? '';
    const after = reindented[block.start] ?? '';
    return quotePrefix(before).depth > 0 && quotePrefix(after).depth > 0;
  };

  /** A gap between two blocks that lies inside a list containing a protected block. */
  const gapIsExcluded = (index: number): boolean => {
    const block = blocks[index];
    const previous = blocks[index - 1];
    if (block === undefined || previous === undefined) return false;
    return excludedItemLines.has(previous.end - 1) || excludedItemLines.has(block.start);
  };

  const parts: string[] = [];
  // Where every emitted line came from: the input line index, or -1 for a blank
  // the blank-line policy invented. Diagnostics describe the input, so a rule
  // that reports a line maps back through this instead of counting the lines of
  // whatever text it happens to be holding.
  const partLines: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === undefined) continue;
    if (i > 0) {
      const untouched = gapIsExcluded(i) || gapInsideQuote(i);
      let blanks = untouched ? block.blanksBefore : blankCount(block.blanksBefore, options);
      if (!untouched && listBlanks !== 'preserve' && sameList(i - 1, i)) {
        blanks = listBlanks === 'remove' ? 0 : 1;
      }
      for (let k = 0; k < blanks; k++) {
        parts.push('');
        partLines.push(-1);
      }
    }
    for (let j = block.start; j < block.end; j++) {
      // BLK-03 is opt-in: a blank line between items flips a tight list to loose,
      // so it never happens unless asked for. The j > block.start guard is what
      // keeps this idempotent - on a second pass each item is already its own
      // block with its own blank before it.
      if (listBlanks === 'one' && j > block.start && isItem(j) && !excludedItemLines.has(j)) {
        parts.push('');
        partLines.push(-1);
      }
      parts.push(reindented[j] ?? texts[j] ?? '');
      partLines.push(j);
    }
  }

  const structural = parts.length === 0 ? '' : parts.join('\n') + '\n';
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
  const widths = normalizeFullwidthAlphanumerics(structural, options.typography, widthMask);
  const punctuation = normalizePunctuation(widths, options.typography, widthMask);
  const parens = normalizeParens(punctuation, options.typography, widthMask);
  const quoted = normalizeQuotes(parens, options.typography, widthMask);
  const spaced = applyTypography(quoted.text, options.typography, ignoreRanges(quoted.text, options.ignore));
  // BLK-12 runs last of the content rules and before the guard, and it is the only
  // one that removes lines - which is why it is here rather than among the passes
  // that index by line. It is also the only rule the guard has an exception for,
  // passed to the guard explicitly so the exception is readable where the
  // guarantee is checked.
  const edged = options.codeBlock.trimBlankLines ? trimFenceBlanks(spaced) : spaced;
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
    diagnostics: orderedDiagnostics([...detections.map(asDiagnostic), ...diagnostics]),
  };
}
