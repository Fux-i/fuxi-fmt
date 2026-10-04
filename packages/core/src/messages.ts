/**
 * Every sentence fuxi-fmt can say, in one place (CFG-08).
 *
 * These used to be built by string concatenation at each point of use, which is
 * fine until something has to translate them: a translated sentence needs the
 * values as data, not already spliced into English word order. Each entry is a
 * template with positional placeholders, so the same entry can be rendered in any
 * language.
 *
 * The English text doubles as the lookup key for the editor's localisation bundle,
 * because that is how vscode.l10n works: it looks up the string you hand it. The
 * translations live here beside the English, and the bundle files under
 * packages/vscode/l10n are generated from this table rather than maintained by
 * hand - a second hand-kept copy is a second thing to drift.
 *
 * A translation must use the same placeholder set as its English source. A
 * Chinese sentence that dropped {0} would quietly lose the number it was reporting,
 * so a test compares the sets rather than trusting the translator.
 *
 * Spec references: CFG-02 (rule registry), CFG-08 (message catalogue).
 */

export interface MessageEntry {
  /** The English template, with {0}, {1} placeholders. Also the l10n key. */
  readonly en: string;
  /** The Chinese template, with the same placeholders. */
  readonly zh?: string;
}

export const MESSAGES = {
  'det.fenceUnterminated': {
    en: 'unterminated code fence: no closing fence was found, so everything after it is code and none of it was formatted',
  },
  'det.frontMatterUnterminated': {
    en: 'unterminated front matter: the opening line is never closed, so the whole document was read as YAML and none of it was formatted',
  },
  'det.commentUnterminated': {
    en: 'unterminated HTML comment: nothing closes it, so everything after it is a comment and none of it was formatted',
  },
  'det.mathUnterminated': {
    en: 'unterminated math block: no closing line of dollar signs was found, so everything after it is display math and none of it was formatted',
  },
  'det.backtickUnmatched': {
    en: 'unmatched backtick: nothing closes it, so it stays literal text - if a code span was meant, a backtick is missing',
  },
  'det.dollarUnmatched': {
    en: 'unmatched dollar sign: nothing closes it, so it stays literal text - a price and an unclosed formula look the same here',
  },
  'det.wikilinkUnclosed': {
    en: 'unclosed wikilink: nothing closes it on the line, so it stays literal text',
  },
  'det.linkDestinationUnclosed': {
    en: 'unclosed link destination: the opening parenthesis is never closed, so this is not a link',
  },
  'det.tableRowRagged': {
    en: 'table row has {0} cells where the header has {1}: the row does not render in the columns above it',
  },
  'det.listItemOrphan': {
    en: 'list item is indented as if nested but belongs to no parent: the indentation reads as a nested list that never becomes one',
  },
  'det.listExcluded': {
    en: 'this list is not reindented: it contains a protected block, and moving code the author placed at a fixed indentation is what SAFE-02 exists to prevent',
  },
  'grt.regionCount': {
    en: 'protected region count changed: {0} -> {1}',
  },
  'grt.nonBlankCount': {
    en: 'non-blank line count changed: {0} -> {1}',
  },
  'grt.blockKindChanged': {
    en: 'block kind changed: {0} -> {1}',
  },
  'safe.regionChanged': {
    en: '{0} region changed: {1} -> {2}',
  },
  'typo.unpairedQuote': {
    en: 'unpaired straight quote: this paragraph has an odd number of them, so none were converted',
  },
  'cfg.renamed': {
    en: '{0} was renamed to {1} ({2}); the old name still works and will be removed in the next release',
  },
  'cfg.booleanConverted': {
    en: '{0} no longer takes true or false; it was rewritten to {1} and the old form will be removed in the next release',
  },
  'cfg.semicolonFolded': {
    en: 'typography.semicolon was removed in favour of typography.punctuationChangeList; it was folded into the list as {0} and the old key will be removed in the next release',
  },
  'cfg.indentWidthSplit': {
    en: 'list.indentWidth was split into list.orderedIndent and list.unorderedIndent; it was rewritten as {0} and the old key will be removed in the next release',
  },
  'cfg.unknownKey': {
    en: '{0} is not a fuxi-fmt option; it was ignored',
  },
} satisfies Readonly<Record<string, MessageEntry>>;

export type MessageId = keyof typeof MESSAGES;

/** The values a template's placeholders stand for. */
export type MessageArgs = readonly (string | number)[];

/** The English template for an entry. This is the key vscode.l10n looks up. */
export function templateOf(id: MessageId): string {
  return MESSAGES[id].en;
}

/** Replace {0}, {1} ... with the values given. A missing value is left visible. */
export function render(template: string, args: MessageArgs = []): string {
  return template.replace(/\{(\d+)\}/g, (whole, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? whole : String(value);
  });
}

/** The English sentence for an entry, with its values in place. */
export function english(id: MessageId, args: MessageArgs = []): string {
  return render(templateOf(id), args);
}

/** The placeholders a template uses, as a sorted list, e.g. ['0', '1']. */
export function placeholdersOf(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{(\d+)\}/g)) found.add(match[1] ?? '');
  return [...found].sort((a, b) => Number(a) - Number(b));
}
