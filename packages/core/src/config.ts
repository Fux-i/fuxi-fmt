/**
 * Configuration loading (CFG-01).
 *
 * A project ships one `fuxi-fmt.json`; the nearest one above the file being
 * formatted wins. The format is JSON with comments and trailing commas, since
 * a configuration file that cannot explain itself is a configuration file
 * nobody maintains.
 *
 * Unknown keys are ignored rather than rejected, so a config written for a
 * later version still loads. A known key with an unknown value is an error,
 * because silently ignoring it would hide a typo for the life of the project.
 */

import type { CjkClass } from './chars.ts';
import { presetOptions } from './presets.ts';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  IgnoreInput,
  BlankLinesInput,
  CodeBlockInput,
  EndOfLine,
  FormatOptionsInput,
  ListInput,
  TypographyInput,
} from './options.ts';

export const CONFIG_FILENAME = 'fuxi-fmt.json';

type Raw = Record<string, unknown>;

interface Sections {
  blankLines?: BlankLinesInput;
  typography?: TypographyInput;
  list?: ListInput;
  codeBlock?: CodeBlockInput;
  endOfLine?: EndOfLine;
  ignore?: IgnoreInput;
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new Error('config: ' + key + ' must be one of ' + allowed.join(' | '));
}

function bool(value: unknown, key: string): boolean {
  if (typeof value === 'boolean') return value;
  throw new Error('config: ' + key + ' must be true or false');
}

function strings(value: unknown, key: string): readonly string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as readonly string[];
  }
  throw new Error('config: ' + key + ' must be an array of strings');
}

function section(value: unknown, key: string): Raw {
  if (isRecord(value)) return value;
  throw new Error('config: ' + key + ' must be an object');
}

/** Remove // and /* *​/ comments, respecting string literals. */
function stripComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const next = text.charAt(i + 1);
    if (inLine) {
      if (ch === '\n') {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next;
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function stripTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text.charAt(i + 1);
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text.charAt(j))) j++;
      const following = text.charAt(j);
      if (following === '}' || following === ']') continue;
    }
    out += ch;
  }
  return out;
}

export function parseConfig(text: string): FormatOptionsInput {
  let raw: unknown;
  try {
    raw = JSON.parse(stripTrailingCommas(stripComments(text)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('config: invalid JSON. ' + message);
  }
  if (!isRecord(raw)) throw new Error('config: the document must be an object');

  const stated = readSections(raw);
  // A preset supplies values; anything the config states explicitly wins.
  if (raw.preset === undefined) return stated;
  if (typeof raw.preset !== 'string') throw new Error('config: preset must be a string');
  return mergeOptions(presetOptions(raw.preset), stated);
}

function readSections(raw: Raw): FormatOptionsInput {
  const out: Sections = {};

  if (raw.endOfLine !== undefined) {
    out.endOfLine = oneOf(raw.endOfLine, 'endOfLine', ['lf', 'crlf', 'auto']);
  }

  if (raw.blankLines !== undefined) {
    const from = section(raw.blankLines, 'blankLines');
    const to: {
      aroundBlocks?: 'exact' | 'atLeast';
      maxConsecutive?: number | null;
      insideLists?: 'remove' | 'one' | 'preserve';
    } = {};
    if (from.aroundBlocks !== undefined) {
      to.aroundBlocks = oneOf(from.aroundBlocks, 'blankLines.aroundBlocks', ['exact', 'atLeast']);
    }
    if (from.maxConsecutive !== undefined) {
      const cap = from.maxConsecutive;
      if (cap !== null && (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 1)) {
        throw new Error('config: blankLines.maxConsecutive must be a positive integer or null');
      }
      to.maxConsecutive = cap as number | null;
    }
    if (from.insideLists !== undefined) {
      to.insideLists = oneOf(from.insideLists, 'blankLines.insideLists', [
        'remove',
        'one',
        'preserve',
      ]);
    }
    out.blankLines = to;
  }

  if (raw.list !== undefined) {
    const from = section(raw.list, 'list');
    const to: {
      orderedStyle?: 'renumber' | 'keep-all-ones' | 'preserve';
      orderedDelimiter?: 'preserve' | '.' | ')';
      orderedIndent?: 'aligned' | 4;
      unorderedIndent?: 'aligned' | 3 | 4;
      tabWidth?: number;
      unorderedMarker?: 'dashes' | 'asterisks' | 'preserve';
    } = {};
    if (from.orderedStyle !== undefined) {
      to.orderedStyle = oneOf(from.orderedStyle, 'list.orderedStyle', [
        'renumber',
        'keep-all-ones',
        'preserve',
      ]);
    }
    if (from.orderedDelimiter !== undefined) {
      to.orderedDelimiter = oneOf(from.orderedDelimiter, 'list.orderedDelimiter', ['preserve', '.', ')']);
    }
    if (from.orderedIndent !== undefined) {
      if (from.orderedIndent === 'aligned' || from.orderedIndent === 4) {
        to.orderedIndent = from.orderedIndent;
      } else {
        throw new Error("config: list.orderedIndent must be 'aligned' or 4");
      }
    }
    if (from.unorderedIndent !== undefined) {
      const value = from.unorderedIndent;
      if (value === 'aligned' || value === 3 || value === 4) {
        to.unorderedIndent = value;
      } else {
        throw new Error("config: list.unorderedIndent must be 'aligned', 3 or 4");
      }
    }
    if (from.tabWidth !== undefined) {
      const width = from.tabWidth;
      if (typeof width !== 'number' || !Number.isInteger(width) || width < 0) {
        throw new Error(
          'config: list.tabWidth must be a non-negative integer (0 leaves tabs alone)',
        );
      }
      to.tabWidth = width;
    }
    if (from.unorderedMarker !== undefined) {
      to.unorderedMarker = oneOf(from.unorderedMarker, 'list.unorderedMarker', [
        'dashes',
        'asterisks',
        'preserve',
      ]);
    }
    out.list = to;
  }

  if (raw.codeBlock !== undefined) {
    const from = section(raw.codeBlock, 'codeBlock');
    const to: { fenceChar?: 'backticks' | 'tildes' | 'preserve'; fenceLength?: boolean } = {};
    if (from.fenceChar !== undefined) {
      to.fenceChar = oneOf(from.fenceChar, 'codeBlock.fenceChar', ['backticks', 'tildes', 'preserve']);
    }
    if (from.fenceLength !== undefined) {
      to.fenceLength = bool(from.fenceLength, 'codeBlock.fenceLength');
    }
    out.codeBlock = to;
  }

  if (raw.typography !== undefined) {
    const from = section(raw.typography, 'typography');
    const to: {
      cjkSpacing?: boolean;
      punctuationStyle?: 'fullwidth' | 'halfwidth' | 'mixed' | 'off';
      punctuationChangeList?: readonly string[];
      halfwidthAlphanumerics?: boolean;
      ideographicSpace?: boolean;
      hashtag?: boolean;
      parenStyle?: 'mixed' | 'fullwidth' | 'halfwidth' | 'preserve';
      context?: 'line' | 'adjacent';
      quotes?: 'preserve' | 'paired';
      cjkClasses?: readonly CjkClass[];
      spacingSymbols?: readonly string[];
    } = {};
    if (from.cjkSpacing !== undefined) to.cjkSpacing = bool(from.cjkSpacing, 'typography.cjkSpacing');
    if (from.punctuationStyle !== undefined) {
      to.punctuationStyle = oneOf(from.punctuationStyle, 'typography.punctuationStyle', [
        'fullwidth',
        'halfwidth',
        'mixed',
        'off',
      ]);
    }
    if (from.punctuationChangeList !== undefined) {
      to.punctuationChangeList = strings(
        from.punctuationChangeList,
        'typography.punctuationChangeList',
      );
    }
    if (from.halfwidthAlphanumerics !== undefined) {
      to.halfwidthAlphanumerics = bool(from.halfwidthAlphanumerics, 'typography.halfwidthAlphanumerics');
    }
    if (from.ideographicSpace !== undefined) {
      to.ideographicSpace = bool(from.ideographicSpace, 'typography.ideographicSpace');
    }
    if (from.hashtag !== undefined) {
      to.hashtag = bool(from.hashtag, 'typography.hashtag');
    }
    if (from.parenStyle !== undefined) {
      to.parenStyle = oneOf(from.parenStyle, 'typography.parenStyle', [
        'mixed',
        'fullwidth',
        'halfwidth',
        'preserve',
      ]);
    }
    if (from.context !== undefined) {
      to.context = oneOf(from.context, 'typography.context', ['line', 'adjacent']);
    }
    if (from.quotes !== undefined) {
      to.quotes = oneOf(from.quotes, 'typography.quotes', ['paired', 'preserve']);
    }
    if (from.cjkClasses !== undefined) {
      const names = strings(from.cjkClasses, 'typography.cjkClasses');
      const allowed: readonly CjkClass[] = ['han', 'kana', 'hangul', 'bopomofo', 'enclosed'];
      for (const name of names) {
        if (!(allowed as readonly string[]).includes(name)) {
          throw new Error('config: typography.cjkClasses has an unknown class ' + name);
        }
      }
      to.cjkClasses = names as readonly CjkClass[];
    }
    if (from.spacingSymbols !== undefined) {
      to.spacingSymbols = strings(from.spacingSymbols, 'typography.spacingSymbols');
    }
    out.typography = to;
  }

  // CFG-03: the ignore directive names are configuration like any other. They
  // were absent from this reader and from mergeOptions, so a fuxi-fmt.json could
  // not name them and the editor lost them on the way through.
  if (raw.ignore !== undefined) {
    const from = section(raw.ignore, 'ignore');
    const to: { file?: string; start?: string; end?: string; line?: string } = {};
    for (const key of ['file', 'start', 'end', 'line'] as const) {
      const value = from[key];
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error('config: ignore.' + key + ' must be a non-empty string');
      }
      to[key] = value;
    }
    out.ignore = to;
  }

  return out;
}

function mergeSection<T extends object>(base: T | undefined, override: T | undefined): T | undefined {
  if (base === undefined) return override;
  if (override === undefined) return base;
  return Object.assign({}, base, override) as T;
}

export function mergeOptions(base: FormatOptionsInput, override: FormatOptionsInput): FormatOptionsInput {
  const out: Sections = {};
  const blankLines = mergeSection(base.blankLines, override.blankLines);
  if (blankLines !== undefined) out.blankLines = blankLines;
  const typography = mergeSection(base.typography, override.typography);
  if (typography !== undefined) out.typography = typography;
  const list = mergeSection(base.list, override.list);
  if (list !== undefined) out.list = list;
  const codeBlock = mergeSection(base.codeBlock, override.codeBlock);
  if (codeBlock !== undefined) out.codeBlock = codeBlock;
  const ignore = mergeSection(base.ignore, override.ignore);
  if (ignore !== undefined) out.ignore = ignore;
  const endOfLine = override.endOfLine ?? base.endOfLine;
  if (endOfLine !== undefined) out.endOfLine = endOfLine;
  return out;
}

export function findConfigFile(startDir: string, stopDir?: string): string | null {
  let dir = resolve(startDir);
  const stop = stopDir === undefined ? null : resolve(stopDir);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    if (stop !== null && dir === stop) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface LoadedConfig {
  readonly options: FormatOptionsInput;
  readonly configPath: string | null;
}

export function readConfigFile(path: string): FormatOptionsInput {
  return parseConfig(readFileSync(path, 'utf8'));
}

export function loadOptionsFor(filePath: string): LoadedConfig {
  const configPath = findConfigFile(dirname(resolve(filePath)));
  if (configPath === null) return { options: {}, configPath: null };
  return { options: readConfigFile(configPath), configPath };
}
