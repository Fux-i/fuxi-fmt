/**
 * Old configuration names, and the keys that replaced them (CFG-07).
 *
 * Renaming an option is cheap for the code and expensive for the user: a key that
 * silently stops working produces no error, no change, and no clue. Every name
 * this project has retired is listed here, read for one release, and reported so
 * the author can move on. The list is deliberately finite: an alias outlives its
 * reason the moment nobody removes it, so each one carries the release it dies in.
 *
 * Unknown keys are still ignored rather than rejected, so a configuration written
 * for a later version loads - but they are now reported too. Ignoring a typo in
 * silence is how an option comes to look broken for the life of a project.
 */

import { english, type MessageArgs, type MessageId } from './messages.ts';
import { defaultOptions } from './options.ts';

type Raw = Record<string, unknown>;

export interface ConfigNotice {
  readonly kind: 'renamed' | 'unknown';
  /** The key as the configuration wrote it, e.g. typography.symbolWhitelist. */
  readonly key: string;
  /** The catalogue entry (CFG-08), so the notice speaks the reader's language. */
  readonly messageId: MessageId;
  readonly args: MessageArgs;
  /** The English rendering, for an adapter that does not localise. */
  readonly message: string;
}

/** A notice before its English sentence has been rendered from the catalogue. */
type PendingNotice = Omit<ConfigNotice, 'message'>;

/** Sections that hold options, and therefore the only places a leaf can live. */
const SECTIONS = ['blankLines', 'typography', 'list', 'codeBlock', 'ignore'] as const;
const TOP_LEVEL_LEAVES = ['endOfLine', 'preset'] as const;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Like-for-like moves: the same value under a better name. */
const RENAMES: readonly { readonly from: string; readonly to: string; readonly why: string }[] = [
  {
    from: 'typography.symbolWhitelist',
    to: 'typography.spacingSymbols',
    why: 'the new name says what the set is for rather than what it is',
  },
  {
    from: 'typography.punctuationAllowlist',
    to: 'typography.punctuationChangeList',
    why: 'it is a list of what may change, not of what is permitted',
  },
  {
    from: 'codeBlock.normalizeLength',
    to: 'codeBlock.fenceLength',
    why: 'it controls the delimiter run and nothing else',
  },
];

function bag(root: Raw, section: string): Raw {
  const value = root[section];
  if (!isRecord(value)) return {};
  return value;
}

/** Move one leaf, if the configuration used the old name. */
function rename(root: Raw, notice: PendingNotice[], entry: (typeof RENAMES)[number]): void {
  const [section, leaf] = entry.from.split('.');
  const [, toLeaf] = entry.to.split('.');
  if (section === undefined || leaf === undefined || toLeaf === undefined) return;
  const from = bag(root, section);
  if (!(leaf in from)) return;
  const to = { ...bag(root, section) };
  if (!(toLeaf in to)) to[toLeaf] = from[leaf];
  delete to[leaf];
  root[section] = to;
  notice.push({
    kind: 'renamed',
    key: entry.from,
    messageId: 'cfg.renamed',
    args: [entry.from, entry.to, entry.why],
  });
}

function moveBoolean(root: Raw, notice: PendingNotice[], path: string, convert: (value: boolean) => unknown): void {
  const [section, leaf] = path.split('.');
  if (section === undefined || leaf === undefined) return;
  const from = bag(root, section);
  if (!(leaf in from)) return;
  const value = from[leaf];
  if (typeof value !== 'boolean') return;
  const to = { ...from };
  to[leaf] = convert(value);
  root[section] = to;
  notice.push({
    kind: 'renamed',
    key: path,
    messageId: 'cfg.booleanConverted',
    args: [path, JSON.stringify(to[leaf])],
  });
}

/**
 * Rewrite every retired name in place, and report every key that is not an option.
 *
 * The known-key set is derived from the defaults rather than listed here, so an
 * option added to the code is known to the configuration reader the moment it
 * exists - a second hand-kept list is a second thing to forget.
 */
export function applyAliases(raw: Raw): { readonly raw: Raw; readonly notices: ConfigNotice[] } {
  const root: Raw = { ...raw };
  const notices: PendingNotice[] = [];

  for (const entry of RENAMES) rename(root, notices, entry);

  // blankLines.insideLists was a boolean that could only ever insert a blank, and
  // the three-way form replaced it in v0.23.0.
  moveBoolean(root, notices, 'blankLines.insideLists', (value) => (value ? 'one' : 'remove'));

  // typography.semicolon appended ';' to the change list. It is gone because the
  // list is the one control, so the old flag is folded into the list.
  const typography = bag(root, 'typography');
  if (typeof typography.semicolon === 'boolean') {
    const stated = typography.punctuationChangeList;
    const list = Array.isArray(stated)
      ? stated.filter((item): item is string => typeof item === 'string')
      : [...defaultOptions.typography.punctuationChangeList];
    const next = typography.semicolon
      ? list.includes(';') ? list : [...list, ';']
      : list.filter((item) => item !== ';');
    const to: Raw = { ...typography, punctuationChangeList: next };
    delete to.semicolon;
    root.typography = to;
    notices.push({
      kind: 'renamed',
      key: 'typography.semicolon',
      messageId: 'cfg.semicolonFolded',
      args: [JSON.stringify(next)],
    });
  }

  // list.indentWidth was one floor for both kinds of marker. Each value maps to
  // the pair that means the same thing: 2 was narrower than any '1. ' content
  // column, so it meant aligned for both.
  const list = bag(root, 'list');
  if (typeof list.indentWidth === 'number') {
    const width = list.indentWidth;
    const to: Raw = { ...list };
    delete to.indentWidth;
    if (!('orderedIndent' in to)) to.orderedIndent = width === 4 ? 4 : 'aligned';
    if (!('unorderedIndent' in to)) to.unorderedIndent = width === 2 ? 'aligned' : width;
    root.list = to;
    notices.push({
      kind: 'renamed',
      key: 'list.indentWidth',
      messageId: 'cfg.indentWidthSplit',
      args: [JSON.stringify({ orderedIndent: to.orderedIndent, unorderedIndent: to.unorderedIndent })],
    });
  }

  for (const key of Object.keys(root)) {
    if ((TOP_LEVEL_LEAVES as readonly string[]).includes(key)) continue;
    if (!(SECTIONS as readonly string[]).includes(key)) {
      notices.push({ kind: 'unknown', key, messageId: 'cfg.unknownKey', args: [key] });
    }
  }
  for (const sectionName of SECTIONS) {
    const stated = root[sectionName];
    if (!isRecord(stated)) continue;
    const known = new Set(Object.keys(bag(defaultOptions as unknown as Raw, sectionName)));
    for (const leaf of Object.keys(stated)) {
      if (known.has(leaf)) continue;
      const key = sectionName + '.' + leaf;
      notices.push({ kind: 'unknown', key, messageId: 'cfg.unknownKey', args: [key] });
    }
  }

  return {
    raw: root,
    notices: notices.map((notice) => ({
      ...notice,
      message: english(notice.messageId, notice.args),
    })),
  };
}
