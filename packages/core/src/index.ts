export { format } from './format.ts';
export type { Diagnostic, FormatResult } from './format.ts';
export { resolveOptions, defaultOptions } from './options.ts';
export type {
  AroundBlocks,
  BlankLinesInput,
  BlankLinesOptions,
  FormatOptions,
  FormatOptionsInput,
  ListInput,
  ListOptions,
  OrderedDelimiter,
  OrderedStyle,
  TypographyInput,
  TypographyOptions,
} from './options.ts';
export { renumberOrderedLists } from './lists.ts';
export { applyTypography } from './typography.ts';
export { scanRegions } from './scan.ts';
export type { Region, RegionKind } from './scan.ts';
export { classifyContent, classifyLine, segment } from './blocks.ts';
export type { Block, BlockKind, ContentKind, LineKind } from './blocks.ts';
