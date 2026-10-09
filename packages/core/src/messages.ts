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
 * packages/vscode/l10n are generated from this table - a second hand-kept copy is
 * a second thing to drift.
 *
 * A translation must use the same placeholder set as its English source. A
 * Chinese sentence that dropped {0} would quietly lose the number it was reporting,
 * so a test compares the sets rather than trusting the translator.
 *
 * Spec references: CFG-02 (rule ids and severities), CFG-08 (message catalogue).
 */

/**
 * The escapes the two single-delimiter warnings tell a reader to type.
 *
 * Built from character codes rather than written out, because a backtick cannot
 * appear in a single-quoted string without doubling the backslash - and the
 * backslash is half of what the sentence is telling the reader to type, so a
 * typo here would be a warning that teaches the bug it reports.
 */
const ESCAPED_BACKTICK = String.fromCharCode(92) + String.fromCharCode(96);
const ESCAPED_DOLLAR = String.fromCharCode(92) + '$';

export interface MessageEntry {
  /** The English template, with {0}, {1} placeholders. Also the l10n key. */
  readonly en: string;
  /** The Chinese template, with the same placeholders. */
  readonly zh: string;
}

export const MESSAGES = {
  'det.fenceUnterminated': {
    en: 'unterminated code fence: no closing fence was found, so everything after it is code and none of it was formatted',
    zh: '代码围栏没有闭合：找不到结束围栏，后面的内容都被当作代码，因此都没有被格式化',
  },
  'det.frontMatterUnterminated': {
    en: 'unterminated front matter: the opening line is never closed, so the whole document was read as YAML and none of it was formatted',
    zh: 'front matter 没有闭合：开头一行始终没有结束分隔线，整篇文档都被当作 YAML，因此没有被格式化',
  },
  'det.commentUnterminated': {
    en: 'unterminated HTML comment: nothing closes it, so everything after it is a comment and none of it was formatted',
    zh: 'HTML 注释没有闭合：找不到结束标记，后面的内容都被当作注释，因此都没有被格式化',
  },
  'det.mathUnterminated': {
    en: 'unterminated math block: no closing line of dollar signs was found, so everything after it is display math and none of it was formatted',
    zh: '公式块没有闭合：找不到只含美元符号的结束行，后面的内容都被当作行间公式，因此都没有被格式化',
  },
  'det.backtickUnmatched': {
    en:
      'unmatched backtick: nothing closes it, so it stays literal text - if a code span was meant, a backtick is missing; to show one backtick, write ' +
      ESCAPED_BACKTICK,
    zh:
      '反引号没有配对：没有另一个反引号与它配对，因此按字面文本处理；如果本意是行内代码，说明少了一个反引号；若想显示单个反引号，请用 ' +
      ESCAPED_BACKTICK,
  },
  'det.dollarUnmatched': {
    en:
      'unmatched dollar sign: nothing closes it, so it stays literal text - a price and an unclosed formula look the same here; to show a dollar sign, write ' +
      ESCAPED_DOLLAR,
    zh:
      '美元符号没有配对：没有另一个美元符号与它配对，因此按字面文本处理；价格和未闭合的公式这里看起来是一样的；若想显示美元符号，请用 ' +
      ESCAPED_DOLLAR,
  },
  'det.wikilinkUnclosed': {
    en: 'unclosed wikilink: nothing closes it on the line, so it stays literal text',
    zh: 'wiki 链接没有闭合：同一行内找不到配对，因此按字面文本处理',
  },
  'det.linkDestinationUnclosed': {
    en: 'unclosed link destination: the opening parenthesis is never closed, so this is not a link',
    zh: '链接地址没有闭合：左括号始终没有对应的右括号，因此这不是一个链接',
  },
  'det.tableRowRagged': {
    en: 'table row has {0} cells where the header has {1}: the row does not render in the columns above it',
    zh: '表格这一行有 {0} 个单元格，而表头有 {1} 个：这一行不会按上面的列渲染',
  },
  'det.tableHeaderRagged': {
    en: 'the delimiter row has {0} cells where the header has {1}: the columns cannot be aligned',
    zh: '表格的分隔行有 {0} 个单元格，而表头有 {1} 个：这些列无法对齐',
  },
  'det.listItemOrphan': {
    en: 'list item is indented as if nested but belongs to no parent: the indentation reads as a nested list that never becomes one',
    zh: '列表项的缩进看起来是嵌套，实际却不属于任何父项：这个缩进读起来像嵌套列表，但从未真正嵌套',
  },
  'det.tableIncomplete': {
    en: 'delimiter row with no header row above it in the same container: a table needs both, so this document was not formatted',
    zh: '分隔行在同一个容器里没有上方的表头行：一张表格两样都要有，因此这篇文档没有被格式化',
  },
  'det.tableRowOrphan': {
    en: 'table row that belongs to no table: a table needs a header row and a delimiter row, so this document was not formatted',
    zh: '这一行看起来是表格行，却不属于任何表格：一张表格要有表头行与分隔行，因此这篇文档没有被格式化',
  },
  'det.listExcluded': {
    en: 'this list is not reindented: it contains a protected block, and moving code the author placed at a fixed indentation is what SAFE-02 exists to prevent',
    zh: '这个列表不做缩进调整：其中含有受保护的块，而移动作者固定在某个缩进位置的代码正是 SAFE-02 要防止的',
  },
  'grt.regionCount': {
    en: 'protected region count changed: {0} -> {1}',
    zh: '受保护区域的数量发生了变化：{0} -> {1}',
  },
  'grt.nonBlankCount': {
    en: 'non-blank line count changed: {0} -> {1}',
    zh: '非空行数发生了变化：{0} -> {1}',
  },
  'grt.blockKindChanged': {
    en: 'block kind changed: {0} -> {1}',
    zh: '块的类型发生了变化：{0} -> {1}',
  },
  'safe.regionChanged': {
    en: '{0} region changed: {1} -> {2}',
    zh: '{0} 区域发生了变化：{1} -> {2}',
  },
  'typo.unpairedQuote': {
    en: 'unpaired straight quote: this paragraph has an odd number of them, so none were converted',
    zh: '直引号没有配对：这一段里它的数量是奇数，因此一个都没有转换',
  },
  'cfg.renamed': {
    en: '{0} was renamed to {1} ({2}); the old name still works and will be removed in the next release',
    zh: '{0} 已更名为 {1}（{2}）；旧名称仍然有效，将在下一个版本中移除',
  },
  'cfg.booleanConverted': {
    en: '{0} no longer takes true or false; it was rewritten to {1} and the old form will be removed in the next release',
    zh: '{0} 不再接受 true 或 false；已改写为 {1}，旧写法将在下一个版本中移除',
  },
  'cfg.semicolonFolded': {
    en: 'typography.semicolon was removed in favour of typography.punctuationChangeList; it was folded into the list as {0} and the old key will be removed in the next release',
    zh: 'typography.semicolon 已被 typography.punctuationChangeList 取代；它已作为 {0} 并入该列表，旧配置项将在下一个版本中移除',
  },
  'cfg.indentWidthSplit': {
    en: 'list.indentWidth was split into list.orderedIndent and list.unorderedIndent; it was rewritten as {0} and the old key will be removed in the next release',
    zh: 'list.indentWidth 已拆分为 list.orderedIndent 和 list.unorderedIndent；已改写为 {0}，旧配置项将在下一个版本中移除',
  },
  'cfg.unknownKey': {
    en: '{0} is not a fuxi-fmt option; it was ignored',
    zh: '{0} 不是 fuxi-fmt 的配置项；已忽略',
  },
  'tbl.rowOverCap': {
    en: 'this row is {0} columns wide on its own, past table.maxWidth ({1}), so it did not set the column widths the other rows were padded to; raise table.maxWidth to include it',
    zh: '这一行自身宽 {0} 列，超过 table.maxWidth（{1}），因此没有参与其余行补齐所用的列宽；调大 table.maxWidth 可以让它参与',
  },
  'tbl.capNotApplicable': {
    en: 'this table has {0} of {1} rows wider than table.maxWidth ({2}), so the cap cannot narrow it and every row was padded as written',
    zh: '这张表 {1} 行里有 {0} 行宽于 table.maxWidth（{2}），上限无法收窄它，整张表都按原样补齐',
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

/**
 * The sentence in a language, with its values in place.
 *
 * `zh` matches zh, zh-CN, zh-Hans and zh-TW alike, because a reader who has set
 * any of them wants Chinese. A language with no translation gets English rather
 * than the id, which is what makes an untranslated rule readable on the day it
 * ships.
 */
export function translate(id: MessageId, args: MessageArgs = [], locale = 'en'): string {
  const entry = MESSAGES[id];
  const template = locale.toLowerCase().startsWith('zh') ? entry.zh : entry.en;
  return render(template, args);
}

/** The placeholders a template uses, as a sorted list, e.g. ['0', '1']. */
export function placeholdersOf(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{(\d+)\}/g)) found.add(match[1] ?? '');
  return [...found].sort((a, b) => Number(a) - Number(b));
}
