
# 主流 Markdown 格式化工具 —— 可配置能力面

只记事实；逐条给出第一手文档或源码。行内代码以 &#96; 表示（渲染出来就是反引号）。

## 1. Prettier

内置支持 Markdown，走 `markdown` 解析器（micromark；MDX 走 `mdx`）。Markdown 专属选项注册在 [`src/language-markdown/options.js`](https://github.com/prettier/prettier/blob/main/src/language-markdown/options.js)；通用选项见 [Options](https://prettier.io/docs/options)。

**与 Markdown 相关的选项**
- `proseWrap`：`"preserve"`（默认）/ `"always"`（按 `printWidth` 折行）/ `"never"`（每个散文块压成一行）。[Options §Prose Wrap](https://prettier.io/docs/options#prose-wrap)
- `printWidth` 80 —— 被 `always` 与表格排版使用。
- `tabWidth` 2、`useTabs` false —— 列表内容的缩进与对齐使用 `options.tabWidth`（[print/list.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/list.js)）。
- `endOfLine` `"lf"`（默认）。
- `embeddedLanguageFormatting` `"auto"`（默认）/ `"off"` —— `auto` 会格式化那些 info string 能映射到某个解析器的围栏代码（[embed.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/embed.js)）；`off` 关闭。
- `singleQuote` false —— 一个 Markdown 选项，只在 [print/mdast.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/mdast.js) 的 `getPreferredQuote(title, options.singleQuote)` 里被消费（链接与图片标题的首选引号字符）。
- 项目符号、强调、围栏、标题样式都没有选项：这些由打印器写死。

**具体的规范化行为**（全部位于 [src/language-markdown/](https://github.com/prettier/prettier/tree/main/src/language-markdown)）
- 无序列表：主轴 `-`，相邻列表用 `*` 交替；任务项 `[x]`/`[ ]`（list.js）。
- 有序列表：首项打印原文的起始编号，后续项打印 `start+index`；标记 `.`/`)` 在相邻列表间交替；对 git diff 友好的列表（≥2 项、第 2 项为 1，且第 1 项不为 0 或第 3 项为 1）每一项都打印成 `1.`；数值上限 999,999,999（list.js、utilities.js）。嵌套列表各自独立编号。
- 强调默认 `_`，在紧邻单词字符、嵌套于强调中、或加粗紧邻单词时改用 `*`；加粗永远是 `**`；GFM 删除线是 `~~`（mdast.js）。
- 分隔线 `---`；当它是根节点的第一个节点时用 `***`（这样不会被读成 front matter），在列表内交替时也用 `***`（mdast.js）。
- 标题：样式保留而不转换 —— setext 标题按原来的 `=`/`-` 下划线重新输出；ATX 输出为 `#` 乘上深度再加一个空格（[print/heading.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/heading.js)）。
- 代码围栏：反引号；围栏长度 `max(3, 内容里最长的反引号串 + 1)`；info string 原样保留；除非命中嵌入格式化，围栏内容只做行尾规范化（[print/code.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/code.js)）。
- 行内代码：取内容中不存在的最小反引号串；内容以反引号开头或结尾，或以「空格 + 非空格」开头或结尾时补一个空格；除非 `proseWrap: preserve`，换行一律变成空格；表格单元格里的 `|` 会被转义（mdast.js）。
- 链接与引用：行内链接规范化为 `[text](url "title")`，空 URL 打印成 `<>`；纯 autolink 保留 `<url>`；完整、折叠、快捷三种引用形态都保留；引用标签转义 `[`、`]`、`\`；URL 在需要时做反斜杠或实体转义，并用 `<...>` 包裹（`printUrl`）。
- 表格：单元格按各列最大宽度补空格；`:` 对齐标记；在 `proseWrap: never` 下，只有超过 print width 才会使用紧凑表格（[print/table.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/table.js)）。
- Front matter：只认 `---`（默认 YAML）与 `+++`（默认 TOML）；分隔符之后可以写显式语言；YAML 可以以 `...` 结束；正文交给 Prettier 自己的 yaml/toml 打印器；**不识别 JSON front matter**；分隔符保留（[parse.js](https://github.com/prettier/prettier/blob/main/src/main/front-matter/parse.js)、[embed.js](https://github.com/prettier/prettier/blob/main/src/main/front-matter/embed.js)）。
- 空行：块之间恰好一个空行；多个空行合并；紧凑或宽松列表的间距从 AST 保留（`spread`）；相邻的列表项与定义之间不加空行；HTML 边界特殊处理（[print/children.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/children.js)）。
- 转义与安全：实体转义（`\&`）、URL 转义、标签转义、标题加引号；支持 `prettier-ignore` / `prettier-ignore-start|end`。Prettier 自称只改格式（[Option Philosophy](https://prettier.io/docs/option-philosophy)）；mdformat 的 FAQ 不认可它保持 Markdown AST 的说法（[mdformat FAQ](https://github.com/hukkin/mdformat#why-not-use-prettier-instead)）。

**会改变 Markdown 输出的第三方 prettier-* 插件**
- [prettier-plugin-markdown-html](https://www.npmjs.com/package/prettier-plugin-markdown-html) —— 用 HTML 解析器格式化嵌入 Markdown 的原始 HTML。
- [prettier-plugin-md-nocjsp](https://www.npmjs.com/package/prettier-plugin-md-nocjsp) —— 阻止 Prettier 在中日韩文字与拉丁字母之间插入空格。
- [prettier-markdown-table](https://www.npmjs.com/package/prettier-markdown-table) —— 格式化 Markdown 表格。
- [prettier-plugin-embed](https://www.npmjs.com/package/prettier-plugin-embed) —— js/ts 的嵌入语言格式化，与 Markdown 无关。
- 核心的 md/MDX 不需要任何插件；其它热门插件（tailwind、imports、xml 等）不影响 Markdown。

## 2. dprint-plugin-markdown

配置写在 `"markdown"` 键下。完整选项表与默认值来自 [resolve_config.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/resolve_config.rs)、[types.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/types.rs)、[builder.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/builder.rs)；渲染后的表格见 [dprint docs](https://dprint.dev/plugins/markdown/config/)。

| 选项 | 默认值 | 取值 / 含义 |
|---|---|---|
| `lineWidth` | 80（全局回退值） | 最大行宽 |
| `newLineKind` | `lf` | `auto`/`crlf`/`lf`/`system` |
| `textWrap` | `maintain` | `always`、`maintain`（保留换行）、`maintainAndWrap`（保留换行但把过长行断开）、`never`、`sentence`（每句一行） |
| `wrapUnspacedScripts` | false | 折行时允许在 CJK 这类无空格文字内部断开 |
| `wrapCodeSpans` | true | 允许在行内代码内部换行 |
| `emphasisKind` | `underscores` | `asterisks` / `underscores` |
| `strongKind` | `asterisks` | `asterisks` / `underscores` |
| `hardBreakKind` | `backslash` | `backslash` / `doubleSpace` |
| `maxBlankLines` | 1（最小 1） | 块之间保留的连续空行上限 |
| `heading.kind`（旧名 `headingKind`） | `atx` | `atx` / `setext`（setext 只用于 1–2 级） |
| `heading.blankLinesAbove` | 未设置 | 标题上方的固定空行数（最小 1）；未设置时保留原文空行，上限为 `maxBlankLines` |
| `list.unorderedMarker`（旧名 `unorderedListKind`） | `dashes` | `dashes` / `asterisks`（另一个字符用作交替标记） |
| `list.indentKind`（旧名 `listIndentKind`） | `commonMark` | `commonMark`（对齐到标记宽度）/ `pythonMarkdown`（固定 ≥4 空格） |
| `codeBlock.skipFormat` | false | 围栏代码内容保持原样 |
| `codeBlock.raiseSyntaxErrors` | false | 代码块格式化器报错时让整个文件失败 |
| `codeBlock.preserveIndentation` | false | 保留代码缩进，而不是取消缩进 |
| `codeBlock.preserveBlankLines` | false | 保留围栏内首尾的空行 |
| `codeBlock.useTabs` | 未设置 | 覆盖代码格式化器的 `useTabs` |
| `codeBlock.indentWidth` | 未设置 | 覆盖代码格式化器的 `indentWidth` |
| `html.skipFormat` | false | 行内与块级 HTML 的排版保持原样 |
| `html.useTabs` | false（全局值） | 用制表符缩进 HTML |
| `html.indentWidth` | 2（全局值） | HTML 缩进宽度 |
| `html.selfClosingSpace` | true | `<br />` 还是 `<br/>` |
| `html.preferSingleLine` | false | 放得下的多行 HTML 折叠成一行 |
| `table.skipFormat` | false | 不对齐表格 |
| `table.cellPadding` | `align` | `align` / `space` / `none` |
| `ignoreDirective` | "dprint-ignore" | 行级忽略指令 |
| `ignoreFileDirective` | "dprint-ignore-file" | 文件级忽略指令 |
| `ignoreStartDirective` | "dprint-ignore-start" | 区间开始 |
| `ignoreEndDirective` | "dprint-ignore-end" | 区间结束 |
| `tags` | {} | 自定义标签到文件后缀的映射，供代码块格式化使用 |

说明：
- 已废弃的键名改成了：`headingKind`→`heading.kind`，`unorderedListKind`→`list.unorderedMarker`，`listIndentKind`→`list.indentKind`（[resolve_config.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/resolve_config.rs)）。
- 当前版本的 dprint-plugin-markdown **没有 `reflow`/`reflowText` 选项**；折行由 `textWrap` + `wrapCodeSpans` + `wrapUnspacedScripts` 负责。
- `deno: true` 预设会设置 `textWrap: always` 以及 `deno-fmt-ignore*` 指令（builder.rs）。
- 有序列表会**重新编号**：从首项的起始编号开始顺序编号；前两个标记都是 1 的列表保持全为 `1.`；若计数会超过 999,999,999，则保留原文写下的编号。标记以 `. ` 为主，相邻列表用 `)` 交替（[generate.rs gen_list](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/generation/generate.rs)）。
- 无序列表：`-` 为主，`*` 交替；有防护逻辑避免三个项目符号被读成分隔线。
- Front matter：`---` 包起来的 YAML 正文交给面向 `"yaml"` 的代码块格式化器注册表（只有装了 pretty_yaml 之类的 YAML 插件才会被格式化），否则原样保留；`+++`（TOML）永远原样保留；分隔符保留（[gen_metadata_block](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/generation/generate.rs)）。
- 代码围栏：默认反引号；info string 里含反引号时改用波浪号；围栏长度超过内容中最长的围栏字符连续串；除非设置了 `codeBlock.preserve*`，首尾空白被裁掉、代码取消缩进；列表之后的缩进代码块会变成围栏代码（generate.rs）。
- 转义：段落行首的转义防止文本被读成块；`escape_title` 转义 `"` 与反斜杠（generate.rs）。

## 3. mdformat（Python）与插件

文档：[style](https://mdformat.readthedocs.io/en/stable/users/style.html)、[plugins](https://mdformat.readthedocs.io/en/stable/users/plugins.html)、[config file](https://mdformat.readthedocs.io/en/stable/users/configuration_file.html)、[README/CLI](https://github.com/hukkin/mdformat)。

- 命令行与选项：`--check`、`--no-validate`、`--number`（默认 false）、`--wrap {keep,no,INTEGER}`（默认 `keep`）、`--end-of-line {lf,crlf,keep}`（默认 `lf`）、`--exclude`（3.13+）、`--extensions/--no-extensions`（默认：所有已安装的）、`--codeformatters/--no-codeformatters`。`.mdformat.toml` 一一对应：`wrap`、`number`、`end_of_line`、`validate`、`extensions`、`codeformatters`、`exclude`。
- 插件机制（entry points，见 [contributing](https://github.com/hukkin/mdformat/blob/master/docs/contributors/contributing.md)）：`mdformat.parser_extension` 用于实现 `mdformat.plugins.ParserExtensionInterface` 的解析器与渲染器扩展（建立在 markdown-it-py 之上）；`mdformat.codeformatter` 用于 `Callable[[str, str], str]` 形式的代码块格式化器。已安装的插件默认启用；每个插件的选项放在 `[plugin.<name>]` 下。
- 样式（默认是纯 CommonMark）：只用 ATX（setext 转成 ATX）；项目符号 `-`，相邻列表用 `-`/`*` 交替；有序列表每一项都用 `1.`/`1)`（「不编号」，为最小 diff），除非给了 `--number`，相邻有序列表之间用 `.`/`)` 交替；只用围栏代码（缩进代码转成围栏）；行内代码收缩为最小反引号串并去掉多余的空格填充；行内链接的尖括号去掉；所有链接引用定义移到文档末尾、按标签排序，未使用与重复的定义删除；分隔线变成 70 个下划线；单一 EOL、块之间单一空行（紧凑列表：单一换行）、结尾单一换行；硬换行用反斜杠。
- Front matter：只能通过 `frontmatter` 扩展（[mdformat-frontmatter](https://github.com/butler54/mdformat-frontmatter)）；**只支持 YAML**，且必须位于开头若干行；它会格式化 YAML front matter。不支持 TOML 与 JSON。
- 解析器扩展插件：[mdformat-frontmatter](https://github.com/butler54/mdformat-frontmatter)（YAML front matter）；[mdformat-gfm](https://github.com/hukkin/mdformat-gfm)（`gfm` 与 `tables`；GFM 表格、任务列表、删除线、autolink；附带 `--compact-tables` / `[plugin.tables] compact_tables`）；[mdformat-tables](https://github.com/executablebooks/mdformat-tables)（已并入 mdformat-gfm；对齐表格，例如 `| a | b |` 补成等宽）；[mdformat-footnote](https://github.com/executablebooks/mdformat-footnote)（Pandoc 风格脚注）；`mdformat-deflist`（Pandoc 定义列表）；[mdformat-mkdocs](https://github.com/KyleKing/mdformat-mkdocs)（MkDocs；列表缩进 4 空格）；`mdformat-toc`（自动生成目录）；`mdformat-myst`、`mdformat-admon`、`mdformat-gfm-alerts`、`mdformat-simple-breaks`（三短横线分隔线）、`mdformat-pyproject`。
- 代码块格式化器插件：`mdformat-black` / `*-ruff`（python）、`mdformat-shfmt` / `*-beautysh`、`mdformat-gofmt`、`mdformat-rustfmt`、`mdformat-web`（js/css/html/xml）、`mdformat-config`（json/toml/yaml）。
- 安全：`validate` 比较格式化前后渲染出的 HTML，AST 变了就拒绝写入；它自述的目标是「只改样式，不改内容」，理由是最小 diff（全 1 编号、定义排序）。

## 4. remark / remark-stringify / remark-lint

**remark-stringify 的选项**（默认值来自 [readme](https://github.com/remarkjs/remark/blob/main/packages/remark-stringify/readme.md)）：
`bullet` `'*'`；`bulletOther` 取 bullet 的反面；`bulletOrdered` `'.'`；`closeAtx` false；`emphasis` `'*'`；`fence` ``'`'``；`fences` true；`incrementListMarker` true；`listItemIndent` `'one'`（还有 `'mixed'`、`'tab'`）；`quote` `'"'`；`resourceLink` false；`rule` `'*'`；`ruleRepetition` 3；`ruleSpaces` false；`setext` false；`strong` `'*'`；`tightDefinitions` false；外加 `handlers`、`join`、`unsafe`（转义 schema）。GFM 表格的序列化选项来自 remark-gfm：`tableCellPadding`、`tablePipeAlign`、`tablePipes`。
- 序列化时块之间总是一个空行，除非 `join` 或紧凑列表的情况另有规定；`tightDefinitions` 让定义之间不加空行。
- Front matter 由 `remark-frontmatter` 保留（不格式化）（YAML/TOML 等）。
- remark-lint 自己不重写文本；每条可修复的规则都写着等价的 `remark-stringify`/`remark-gfm` 选项，重新序列化 AST 就是修复动作。

**写了修复指引的 remark-lint 规则**（带 Fix 小节的 31 条）。每条改什么：
- `checkbox-character-style`：勾选写 `[x]`，未勾选写 `[ ]`。
- `checkbox-content-indent`：复选框之后一个空格。
- `code-block-style`：围栏代码（或用 `fences: false` 改成缩进代码）。
- `directive-quote-style` / `mdx-jsx-quote-style`：属性引号样式（默认双引号；对应 `quote`）。
- `emphasis-marker`：`*`（或 `emphasis: '_'`）。
- `fenced-code-marker`：反引号（或 `fence: '~'`）。
- `final-newline`：补上结尾换行。
- `heading-style`：ATX（或 `setext: true` / `closeAtx: true`）。
- `linebreak-style`：Unix 行尾。
- `link-title-style`：双引号（或 `quote: "'"`）。
- `list-item-bullet-indent`：去掉列表项的缩进。
- `list-item-content-indent`：对齐列表项内容。
- `list-item-indent`：`listItemIndent: 'one'`（还有 `'mixed'`/`'tab'`）。
- `no-blockquote-without-marker`：给引用块的每一行补 `>`。
- `no-consecutive-blank-lines`：块之间恰好一个空行（复杂情况用 `join`）。
- `no-heading-content-indent`：`#` 之后一个空格。
- `no-heading-indent`：去掉标题的缩进。
- `no-literal-urls`：转成常规 autolink 或完整链接。
- `no-missing-blank-lines`：块之间补空行。
- `no-table-indentation`：把表格的缩进去掉。
- `no-tabs`：只用空格。
- `ordered-list-marker-style`：`.`（或 `bulletOrdered: ')'`）。
- `ordered-list-marker-value`：保留首项的值，之后递增（或 `incrementListMarker: false`）。
- `rule-style`：`***`（对应 `rule`/`ruleRepetition`/`ruleSpaces`）。
- `strikethrough-marker`：两个波浪号。
- `strong-marker`：`*`（或 `strong: '_'`）。
- `table-cell-padding` / `table-pipe-alignment` / `table-pipes`：单元格补空格 / 对齐竖线 / 首尾都加竖线。
- `unordered-list-marker-style`：`*`（或 `bullet: '+'|'-'`）。
不可修复的例子（没有 Fix 小节）：`blockquote-indentation`、`definition-sort`、`fenced-code-flag`、`file-extension`、`heading-increment`、`list-item-spacing`、`maximum-line-length`、`no-duplicate-headings`、`no-emphasis-as-heading`、`no-html`、`no-shell-dollars`、`no-undefined-references`、`no-unused-definitions`、`no-shortcut-reference-link/image`，以及文件名与标题标点那几条。

## 5. markdownlint（CLI + VSCode）

修复机制：能修的规则会设置 `fixInfo` 属性；库导出 `applyFix`/`applyFixes`；`markdownlint-cli --fix` 自称「修复基础问题（不支持 STDIN）」，并说明并非所有问题都可修（[CLI README](https://github.com/igorshubovych/markdownlint-cli)、[lib README §Fixing](https://github.com/DavidAnson/markdownlint)）。VSCode 扩展：快速修复（灯泡）、`markdownlint.fixAll` 命令、注册为格式化器，以及通过 `editor.codeActionsOnSave: { "source.fixAll.markdownlint": "explicit" }` 在保存时修复（[VSCode README](https://github.com/DavidAnson/vscode-markdownlint)）。规则列表与默认值：[doc/Rules.md](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)；修复动作读自 [lib/md*.mjs](https://github.com/DavidAnson/markdownlint/tree/main/lib)。

**可自动修复的规则，以及修复动作具体做什么**（修复动作取自源码）：
| 规则 | 名称 | 修复动作 |
|---|---|---|
| MD004 | ul-style | 把无序标记替换成配置的样式标记 |
| MD005 | list-indent | 增删空格，让同级列表项对齐 |
| MD007 | ul-indent | 增删空格，达到配置的无序列表缩进（默认 2） |
| MD009 | no-trailing-spaces | 删除行尾空格（允许的硬换行空格除外） |
| MD010 | no-hard-tabs | 每个制表符替换为空格 |
| MD011 | no-reversed-links | 把 `(url)[text]` 改写为 `[text](url)` |
| MD012 | no-multiple-blanks | 删除超过配置上限的空行（默认 1） |
| MD014 | commands-show-output | 删除 `$` 提示符 |
| MD018 | no-missing-space-atx | 在井号之后插入一个空格 |
| MD019 | no-multiple-space-atx | 删除开头井号后的多余空格 |
| MD020 | no-missing-space-closed-atx | 把闭合 ATX 标题改写成两侧井号内各一个空格 |
| MD021 | no-multiple-space-closed-atx | 删除闭合 ATX 井号内的多余空格 |
| MD022 | blanks-around-headings | 在标题上下插入空行（`lines_above/below` 默认 1；`include_front_matter` false） |
| MD023 | heading-start-left | 删除标题前的缩进 |
| MD026 | no-trailing-punctuation | 删除标题末尾的标点 |
| MD027 | no-multiple-space-blockquote | 删除 `>` 之后的多余空格 |
| MD029 | ol-prefix | 把有序列表前缀改写成配置的样式：`one_or_ordered`（默认）、`one`、`ordered`、`zero`；保留右对齐与补零 |
| MD030 | list-marker-space | 设置列表标记后的空格数（`ul_single/ol_single/ul_multi/ol_multi`，默认都是 1） |
| MD031 | blanks-around-fences | 在围栏代码上下插入空行（尊重引用块前缀） |
| MD032 | blanks-around-lists | 在列表上下插入空行 |
| MD034 | no-bare-urls | 把裸 URL 用 `<...>` 包起来 |
| MD037 | no-space-in-emphasis | 删除强调标记内侧的空格 |
| MD038 | no-space-in-code | 删除行内代码反引号内侧的空格 |
| MD039 | no-space-in-links | 删除链接文本内侧的空格 |
| MD044 | proper-names | 把大小写写错的词替换成配置的专有名词（`names`） |
| MD047 | single-trailing-newline | 补上结尾换行 |
| MD049 | emphasis-style | 把强调标记替换成配置的样式（默认 `consistent`） |
| MD050 | strong-style | 把加粗标记替换成配置的样式（默认 `consistent`） |
| MD051 | link-fragments | 修正链接片段的大小写 |
| MD053 | link-image-reference-definitions | 删除未使用的引用定义行 |
| MD054 | link-image-style | 把链接或图片转换成配置的行内、autolink、完整或快捷样式 |
| MD058 | blanks-around-tables | 在表格上下插入空行 |
| MD060 | table-column-style | 按样式（`tight`/`compact`）增删表格竖线周围的空格 |
不可修复（没有 `fixInfo`）：MD001、MD003、MD013、MD024、MD025、MD028、MD033、MD035、MD036、MD040、MD041、MD042、MD043、MD045、MD046、MD048、MD052、MD055、MD056、MD059。（值得注意的是 MD003 标题样式与 MD046/MD048 代码样式与围栏样式只报告不修。）
- Front matter：MD001 用 `front_matter_title`（默认 `^\s*title\s*[:=]`）把 front matter 里的 title 当作一级标题；MD022 有 `include_front_matter`；markdownlint 不格式化 front matter。
- 空行策略：MD012 连续空行上限 1；MD022 标题上下空行（默认每侧 1）；MD031 围栏上下；MD032 列表上下；MD047 结尾单一换行。
- VSCode 扩展文档里的可修复清单漏掉了 MD029 与 MD060，尽管库把它们标记为可修复。

## 6. deno fmt、markdownfmt、mdsf 及其他

**deno fmt** —— 包装 [dprint-plugin-markdown](https://github.com/dprint/dprint-plugin-markdown)（[deno fmt docs](https://docs.deno.com/runtime/reference/cli/fmt/)、[deno_json](https://docs.deno.com/runtime/reference/deno_json/#formatting)、[fmt.rs](https://github.com/denoland/deno/blob/main/cli/tools/fmt.rs)）。
- 认作 markdown 的扩展名：.md、.mkd、.mkdn、.mdwn、.mdown、.markdown。
- 与 markdown 有关的 `"fmt"` 键：`lineWidth` 默认 80；`proseWrap` 默认 `always`（`always`/`never`/`preserve` 对应 dprint 的 `textWrap: always/never/maintain`）；`newLineKind` 默认 `lf`；外加全局的 `useTabs`/`indentWidth`。deno 没有针对强调、加粗、项目符号、标题样式的选项。
- Markdown 里的代码块交给已注册的 dprint 代码块插件格式化；忽略指令是 `<!-- deno-fmt-ignore -->`、`<!-- deno-fmt-ignore-start/end -->`、`<!-- deno-fmt-ignore-file -->`。
- .editorconfig 填补未设置的选项（优先级从高到低：命令行参数、deno.json、.editorconfig、默认值）。

**markdownfmt（Go）** —— [shurcooL/markdownfmt](https://github.com/shurcooL/markdownfmt)，自称「像 gofmt，但用于 Markdown」；基于 blackfriday 的渲染器（[markdown/main.go](https://github.com/shurcooL/markdownfmt/blob/master/markdown/main.go)）。
- 只有 `-d`（diff）、`-l`（列出）、`-w`（写回）三个参数；没有任何配置或样式选项。
- 输出样式：1、2 级标题用 setext（`=`/`-` 下划线），3 级及以上用 ATX；无序标记 `-`；有序列表从 1 重新编号（`1.`、`2.`……）；水平分隔线 `---`；表格对齐。
- 不支持 front matter（README 说自己只处理纯 Markdown，并指向 `mdfmt` 分支、`tidy-markdown`、`Flowmark`）。它经由 AST 重新渲染出 Markdown，所以不是最小 diff，也不保持语义。

**mdsf** —— [hougesen/mdsf](https://github.com/hougesen/mdsf)：只借助外部工具格式化并检查 Markdown 围栏代码块内部的内容（不重排 Markdown 正文与结构）。
- 配置 `mdsf.json|toml|yaml`；`languages` 把语言映射到工具（可带备选与列表）；`language_aliases`；`newline` 取 `lf`/`cr`/`crlf`（默认 lf）；自定义工具通过 `binary/arguments/stdin`；`format`/`verify` 子命令、`--cache`、`--on-missing-language-definition`、`--on-missing-tool-binary`。约 349 个工具。它不是包管理器，只用已安装的工具。

**cbfmt** —— [lukas-reineke/cbfmt](https://github.com/lukas-reineke/cbfmt)：用按语言配置的命令格式化 markdown、org 与 reStructuredText 里的代码块；配置 `.cbfmt.toml` 的 `[languages]`；不碰非代码部分。与 mdsf 一样，它自己不规范化 Markdown。

**tidy-markdown** —— [slang800/tidy-markdown](https://github.com/slang800/tidy-markdown)：美化 Markdown，并把基础 HTML 与 Unicode 转换成等价的 Markdown（基于 Carrot Creative 的风格指南，构建在 Marked 之上）；命令行走 STDIN/STDOUT。

其它值得注意的：`Panache`（面向 Quarto/Pandoc/Markdown 的 dprint 插件，列在 [dprint plugins](https://dprint.dev/plugins/panache/)）；`mdfmt`（加了 front matter 的 markdownfmt 分支）；`Flowmark`（YAML frontmatter、折行）；`remark-toc` / `mdformat-toc` 用于生成目录。

## 7. VSCode 扩展「Markdown All in One」

出处：[README](https://github.com/yzhang-gh/vscode-markdown)、[src/tableFormatter.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/tableFormatter.ts)、[src/listEditing.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/listEditing.ts)、[src/print.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/print.ts)、package.json。

与格式化沾边的功能：
- 目录：创建与更新命令；保存时自动更新（`markdown.extension.toc.updateOnSave` 默认 true）；级别、slugify 方式、每文件缩进都可配；省略标记 `<!-- omit from toc -->` / `<!-- no toc -->`。
- 章节编号的添加、更新与删除。
- 在 Enter/Tab/Backspace 上编辑列表；在 `- * + 1. 1)` 之间切换列表标记（`list.toggle.candidate-markers`）；编辑时自动修正有序列表标记（`orderedList.autoRenumber` 默认 true）；缩进既可按 CommonMark 自适应，也可用 `list.indentationSize` 固定。
- GFM 表格格式化器：为 markdown 注册了 `DocumentFormattingEditProvider` 与 `DocumentRangeFormattingEditProvider`，但 `provideDocumentFormattingEdits` 只识别并格式化 GFM 表格（`tableFormatter.enabled` 默认 true；`tableFormatter.normalizeIndentation`）。
- 切换加粗（`bold.indicator` 默认 `**`）、斜体（`italic.indicator` 默认 `*`）、行内代码、删除线、公式、标题级别；勾选与取消任务列表。
- 打印成 HTML 的命令；可选的 `markdown.extension.print.onFileSave`。
- 补全（路径、锚点）、KaTeX 宏、GFM 删除线与任务列表。

保存时格式化的行为：
- 因为它注册了 markdown 文档格式化器，VS Code 的 `Format Document` 与 `editor.formatOnSave` 都会调用它 —— 但它只重排表格，不是整篇文档的规范化器。
- 目录自动更新在保存时通过它自己的 `onDidSaveTextDocument` 监听触发（默认开）。
- 有序列表自动重编号与列表编辑在编辑时触发，不在保存时。
- 可选的打印成 HTML 在保存时触发，默认关。

## 跨工具对照
| | front matter | 空行策略 | 有序列表 | 项目符号 / 缩进 | 折行 | 围栏内容 |
|---|---|---|---|---|---|---|
| Prettier | YAML `---`、TOML `+++` 会被格式化；JSON 不会 | 块之间一个空行；紧凑与宽松都保留 | 起始编号保留，之后顺序编号；全 1 保持全 1 | `-` / `*`；按 tabWidth | 有选项 | 解析器认识就格式化，否则不动 |
| dprint | 只有装了 yaml 插件才格式化 YAML，否则原样；TOML 原样 | `maxBlankLines` 1 | 从起始编号重编；全 1 保持全 1 | `-` / `*`；commonMark 或 4 空格 | `textWrap` | 由插件格式化 |
| mdformat | 只经插件支持 YAML | 块之间一个空行；紧凑列表用换行 | 除非 `--number`，全部 `1.` | `-` / `*`；2 空格 | `--wrap` | 代码格式化器插件 |
| remark | 保留（remark-frontmatter） | 一个空行（join 与紧凑相关选项控制） | 默认递增 | 默认 `*`；listItemIndent one | 不折行 | handlers/GMF |
| markdownlint | 只通过参数读取，不格式化 | MD012/MD022/MD031/MD032/MD047 | MD029 样式 | MD004/MD007/MD030 | MD013 只检查 | 不碰 |
| deno fmt | 与 dprint 相同 | 与 dprint 相同 | 与 dprint 相同 | 与 dprint 相同 | `proseWrap` 默认 always | 由插件格式化 |
| markdownfmt | 无 | 类似 gofmt | 从 1 重编 | `-` | 无 | 基于重新渲染 |
| mdsf/cbfmt | 不动 | 不动 | 不动 | 不动 | 不动 | 交给外部工具 |

以上每一条都出自所链接的第一手文档或源码；没有一条行为是从博客文章推断出来的。
