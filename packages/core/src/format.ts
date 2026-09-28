import { segment, type AtomicRange, type BlockKind } from './blocks.ts';
import { normalizeMarkers } from './markers.ts';
import { resolveOptions, type FormatOptions, type FormatOptionsInput } from './options.ts';
import { scanRegions, splitSourceLines, type Region, type SourceLine } from './scan.ts';
import { applyTypography } from './typography.ts';
import { renumberOrderedLists } from './lists.ts';
import { checkSemantics } from './guard.ts';

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
  const lines = splitSourceLines(source);
  const ranges = atomicRanges(lines, scanRegions(source));

  const protectedLine = new Array<boolean>(lines.length).fill(false);
  for (const range of ranges) {
    for (let i = range.start; i < range.end; i++) protectedLine[i] = true;
  }

  const normalized = lines.map((line, index) =>
    protectedLine[index] === true ? line.text : normalizeMarkers(line.text),
  );

  const texts = renumberOrderedLists(normalized, protectedLine, options.list);
  const blocks = segment(texts, ranges);

  const parts: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === undefined) continue;
    if (i > 0) {
      const blanks = blankCount(block.blanksBefore, options);
      for (let k = 0; k < blanks; k++) parts.push('');
    }
    for (let j = block.start; j < block.end; j++) parts.push(texts[j] ?? '');
  }

  const structural = parts.length === 0 ? '' : parts.join('\n') + '\n';
  const candidate = applyTypography(structural, options.typography);

  // GRT-01: never hand back a document that parses differently. If the guard
  // trips we return the input untouched and say why (GRT-04).
  const violations = checkSemantics(source, candidate);
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

  return { output: candidate, changed: candidate !== source, diagnostics: [] };
}
