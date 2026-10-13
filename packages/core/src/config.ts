/**
 * Configuration loading (CFG-01).
 *
 * A project ships one `fuxi-fmt.json`; the nearest one above the file being
 * formatted wins. The format is JSON with comments and trailing commas, since
 * a configuration file that cannot explain itself is a configuration file
 * nobody maintains.
 *
 * Unknown keys are ignored rather than rejected, so a config written for a later
 * version still loads - but they are reported now, because ignoring a typo in
 * silence is how an option comes to look broken for the life of a project. A known
 * key with an unknown value is still an error.
 *
 * Retired names are read for one release and reported; see aliases.ts, which owns
 * that list and the reason each entry exists.
 */

import { applyAliases, type ConfigNotice } from './aliases.ts';
import { presetOptions } from './presets.ts';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { OPTION_VOCABULARY } from './options.ts';
import type {
  IgnoreInput,
  BlankLinesInput,
  CodeBlockInput,
  EndOfLine,
  FormatOptionsInput,
  ListInput,
  ThematicBreak,
  EmphasisInput,
  TableInput,
  TypographyInput,
} from './options.ts';

export const CONFIG_FILENAME = 'fuxi-fmt.json';

type Raw = Record<string, unknown>;

interface Sections {
  blankLines?: BlankLinesInput;
  typography?: TypographyInput;
  list?: ListInput;
  codeBlock?: CodeBlockInput;
  thematicBreak?: ThematicBreak;
  table?: TableInput;
  endOfLine?: EndOfLine;
  ignore?: IgnoreInput;
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export interface ParsedConfig {
  readonly options: FormatOptionsInput;
  /** Retired names that were rewritten, and keys that are not options at all. */
  readonly notices: readonly ConfigNotice[];
}

/**
 * Parse a configuration, keeping the notices.
 *
 * Anything that loads a configuration for a human to see should use this: a
 * renamed key and a typo both produce a configuration that quietly does less than
 * its author asked for, and only the notices say so.
 */
export function parseConfigDetailed(text: string): ParsedConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(stripTrailingCommas(stripComments(text)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('config: invalid JSON. ' + message);
  }
  if (!isRecord(raw)) throw new Error('config: the document must be an object');

  const aliased = applyAliases(raw);
  const stated = readSections(aliased.raw);
  // A preset supplies values; anything the config states explicitly wins.
  const preset = aliased.raw.preset;
  if (preset === undefined) return { options: stated, notices: aliased.notices };
  if (typeof preset !== 'string') throw new Error('config: preset must be a string');
  return {
    options: mergeOptions(presetOptions(preset), stated),
    notices: aliased.notices,
  };
}

export function parseConfig(text: string): FormatOptionsInput {
  return parseConfigDetailed(text).options;
}

/**
 * Read one leaf, or throw the sentence that says how to fix it.
 *
 * The wording is the reader's, not the caller's: every complaint names the
 * dotted path, so the author can find the line in their file.
 */
function readLeaf(spec: Record<string, unknown>, value: unknown, key: string): unknown {
  const kind = spec['kind'];
  if (kind === 'bool') {
    if (typeof value === 'boolean') return value;
    throw new Error('config: ' + key + ' must be true or false');
  }
  if (kind === 'oneOf') {
    const allowed = spec['values'] as readonly (string | number)[];
    if ((typeof value === 'string' || typeof value === 'number') && allowed.includes(value)) {
      return value;
    }
    throw new Error('config: ' + key + ' must be one of ' + allowed.join(' | '));
  }
  if (kind === 'oneOfList') {
    const allowed = spec['values'] as readonly (string | number)[];
    const names = strings(value, key);
    for (const name of names) {
      if (!allowed.includes(name)) {
        throw new Error('config: ' + key + ' has an unknown member ' + name);
      }
    }
    return names;
  }
  if (kind === 'stringList' || kind === 'stringSet') return strings(value, key);
  if (kind === 'nonEmptyString') {
    if (typeof value === 'string' && value.length > 0) return value;
    throw new Error('config: ' + key + ' must be a non-empty string');
  }
  const min = spec['min'] as number;
  const hint = spec['hint'] as string | undefined;
  const wording = min === 0 ? 'a non-negative integer' : 'a positive integer';
  const suffix = hint === undefined ? '' : ' (' + hint + ')';
  if (kind === 'nullableInt') {
    if (value === null) return null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= min) return value;
    throw new Error('config: ' + key + ' must be ' + wording + ' or null' + suffix);
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= min) return value;
  throw new Error('config: ' + key + ' must be ' + wording + suffix);
}

/** Read one node of the vocabulary against a section of the file. */
function readNode(spec: Record<string, unknown>, raw: Raw, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(spec)) {
    const value = raw[key];
    if (value === undefined) continue;
    const path = prefix === '' ? key : prefix + '.' + key;
    const leaf = child as Record<string, unknown>;
    if (typeof leaf['kind'] === 'string') out[key] = readLeaf(leaf, value, path);
    else out[key] = readNode(leaf, section(value, path), path);
  }
  return out;
}

function readSections(raw: Raw): FormatOptionsInput {
  // The vocabulary is the surface; the cast is the one place the reader's runtime
  // walk meets the compiler's view of it, and option-vocabulary.test.ts holds the
  // two together by comparing every leaf against defaultOptions.
  return readNode(OPTION_VOCABULARY as unknown as Record<string, unknown>, raw, '') as FormatOptionsInput;
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
  if (typography !== undefined) {
    // `emphasis` is the one bag inside the typography options. Merging it whole
    // would let a layer that sets one kind silently drop the other two set below
    // it, which is the opposite of what layering is for.
    const emphasis: EmphasisInput = {
      ...base.typography?.emphasis,
      ...override.typography?.emphasis,
    };
    out.typography =
      Object.keys(emphasis).length === 0 ? typography : { ...typography, emphasis };
  }
  const list = mergeSection(base.list, override.list);
  if (list !== undefined) out.list = list;
  const codeBlock = mergeSection(base.codeBlock, override.codeBlock);
  if (codeBlock !== undefined) out.codeBlock = codeBlock;
  const ignore = mergeSection(base.ignore, override.ignore);
  if (ignore !== undefined) out.ignore = ignore;
  const thematicBreak = override.thematicBreak ?? base.thematicBreak;
  if (thematicBreak !== undefined) out.thematicBreak = thematicBreak;
  const table = {
    ...base.table,
    ...override.table,
  };
  if (Object.keys(table).length > 0) out.table = table;
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
  readonly notices: readonly ConfigNotice[];
}

export function readConfigFile(path: string): FormatOptionsInput {
  return parseConfig(readFileSync(path, 'utf8'));
}

export function readConfigFileDetailed(path: string): ParsedConfig {
  return parseConfigDetailed(readFileSync(path, 'utf8'));
}

export function loadOptionsFor(filePath: string): LoadedConfig {
  const configPath = findConfigFile(dirname(resolve(filePath)));
  if (configPath === null) return { options: {}, configPath: null, notices: [] };
  const parsed = readConfigFileDetailed(configPath);
  return { options: parsed.options, configPath, notices: parsed.notices };
}
