export { format } from './format.ts';
export type { Diagnostic, FormatResult } from './format.ts';
export { resolveOptions, defaultOptions } from './options.ts';
export type {
  AroundBlocks,
  BlankLinesInput,
  BlankLinesOptions,
  FormatOptions,
  FormatOptionsInput,
} from './options.ts';
export { scanRegions } from './scan.ts';
export type { Region, RegionKind } from './scan.ts';
export { classifyContent, classifyLine, segment } from './blocks.ts';
export type { Block, BlockKind, ContentKind, LineKind } from './blocks.ts';
