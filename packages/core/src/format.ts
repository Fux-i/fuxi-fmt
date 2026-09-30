import { segment, type AtomicRange, type BlockKind } from './blocks.ts';
import { checkSemantics } from './guard.ts';
import { hasIgnoreFile, ignoreLines, ignoreRanges, type CharRange } from './ignores.ts';
import { applyEndOfLine, normalizeInput, trimTrailingWhitespace, type Eol } from './hygiene.ts';
import { renumberOrderedLists } from './lists.ts';
import { normalizeFences } from './fences.ts';
import { normalizeMarkers, normalizeUnorderedMarker } from './markers.ts';
import { resolveOptions, type FormatOptions, type FormatOptionsInput } from './options.ts';
import { assignParents, findExcludedLists, planListIndent, scanListItems } from './list-scan.ts';
import { protectedMask, scanRegions, splitSourceLines, type Region, type SourceLine } from './scan.ts';
import { applyTypography } from './typography.ts';
import { normalizeFullwidthAlphanumerics, normalizeParens, normalizePunctuation } from './widths.ts';

export interface Diagnostic {
  readonly ruleId: string;
  readonly message: string;
  readonly line: number;
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
  const ranges = atomicRanges(lines, scanRegions(base));

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
  const listParents = assignParents(listItems);
  const excludedLists = new Set(
    findExcludedLists(texts, listItems, listParents, protectedLine),
  );
  const reindented = [...texts];
  const reindentWidth = options.list.indentWidth;
  for (const change of planListIndent(texts, listItems, listParents, excludedLists, reindentWidth)) {
    reindented[change.line] = change.text;
  }

  const blocks = segment(reindented, ranges);

  const parts: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === undefined) continue;
    if (i > 0) {
      const blanks = blankCount(block.blanksBefore, options);
      for (let k = 0; k < blanks; k++) parts.push('');
    }
    for (let j = block.start; j < block.end; j++) {
      // BLK-03 is opt-in: a blank line between items flips a tight list to loose,
      // so it never happens unless asked for. The j > block.start guard is what
      // keeps this idempotent - on a second pass each item is already its own
      // block with its own blank before it.
      if (
        options.blankLines.insideLists &&
        j > block.start &&
        itemLines.has(j) &&
        protectedLine[j] !== true
      ) {
        parts.push('');
      }
      parts.push(reindented[j] ?? texts[j] ?? '');
    }
  }

  const structural = parts.length === 0 ? '' : parts.join('\n') + '\n';
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
  const spaced = applyTypography(parens, options.typography, ignoreRanges(parens, options.ignore));
  const candidate = trimTrailingWhitespace(spaced, ignoreRanges(spaced, options.ignore));

  // GRT-01: never hand back a document that parses differently. If the guard
  // trips we return the input untouched and say why (GRT-04).
  const violations = checkSemantics(base, candidate);
  if (violations.length > 0) {
    return {
      output: source,
      changed: false,
      diagnostics: violations.map((violation) => ({
        ruleId: violation.ruleId,
        message: violation.message,
        line: 0,
      })),
    };
  }

  const eol: Eol = options.endOfLine === 'auto' ? normalized.eol : options.endOfLine;
  const output = applyEndOfLine(candidate, eol);
  return { output, changed: output !== source, diagnostics: [] };
}
