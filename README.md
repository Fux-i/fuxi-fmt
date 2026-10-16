# fuxi-fmt

<img src="packages/vscode/assets/logo.png" alt="fuxi-fmt logo" width="160" align="right" />

**面向中文技术写作的 Markdown 格式化工具。**

## 亮点

- **一个工具同时管块级结构与中文排版。** 空行、标记空格、有序列表重编号、列表缩进、中英之间加空格、中文标点全角或半角、行内代码两侧的空格，全部由同一套配置决定，all in one。
- **不该改的不动。** 代码块内容、行内代码与公式、HTML 块与注释、MDX/JSX、shortcode、wikilink、URL 与链接目标全部逐字节保持原样；TOML front matter 同样原样保留。
- **拒绝改坏，而且再跑一次不动。** 结果与原文的解析树不一致时拒绝写入；解析不得不猜的地方（未终止的围栏、front matter、HTML 注释、公式块）也会拒绝并点名那一行。幂等保证第二次运行不改动任何东西，保存时只产生很小的编辑范围，不打乱光标与撤销历史。
- **几乎所有东西都能在设置里改。** 每一个选项都是 VS Code 设置，带默认值、可选值以及它实现的是哪条规范规则，所以设置面板本身就是说明书。

## 效果示例

同一段文本，格式化前与格式化后：

格式化前：

```markdown
#安装
他说"试试这个",然后打开了vscode。
- 第一项
- 第二项
| 需求 | fuxi-fmt |
| --- | --- |
| 中英文之间加空格 | 有 |
```

格式化后：

```markdown
# 安装

他说“试试这个”，然后打开了 vscode。

- 第一项
- 第二项

| 需求             | fuxi-fmt |
| ---------------- | -------- |
| 中英文之间加空格 | 有       |
```

表格那一列的宽度按显示宽度算：一个汉字记两格（也推荐安装并使用汉字记两格的等宽字体如 `Maple Mono NF CN`）。你的字体如果不是这个比例（很多等宽字体里汉字约为拉丁字符的 1.6–1.7 倍），可以在设置里把 `table.cjkWidth` 调到 1 到 2 之间的任意值。

## 与主流工具对比

所有判断都来自 [先例报告](MAINSTREAM_MD_FORMATTERS_REPORT.md) 中逐条链接的第一手文档或源码，数据截至 2026-10。

### 功能对比

Y = 覆盖，P = 部分或带条件，N = 不覆盖。

| 需求                   | **fuxi-fmt** | Prettier | dprint / Deno | markdownlint | Markdown All in One | AutoCorrect | CJK Text Formatter |
| ---------------------- | ----- | --- | --- | --- | --- | --- | --- |
| 块与块之间的空行       | **Y** | Y   | Y   | Y   | N   | N   | N   |
| 有序列表重新编号       | **Y** | Y   | Y   | Y   | P   | N   | N   |
| front matter           | **Y** | Y   | P   | N   | N   | N   | N   |
| 行内代码两侧的空格     | **Y** | N   | N   | N   | N   | P   | N   |
| CJK 与拉丁文之间的空格 | **Y** | N   | N   | N   | N   | Y   | Y   |
| 中文标点宽度           | **Y** | N   | N   | N   | N   | Y   | Y   |
| 不改代码块             | **Y** | P   | P   | Y   | Y   | P   | Y   |

### 可配置项对比

| 可配置项       | fuxi-fmt                             | 其它工具     |
| -------------- | ------------------------------------ | ------------ |
| 块与块之间的空行 | `blankLines.aroundBlocks`：`exact` / `atLeast`；`blankLines.maxConsecutive` 上限 | dprint 的 `maxBlankLines` 只能设上限；Prettier 固定为一个空行 |
| 列表内部的空行 | `blankLines.insideLists`：`remove` / `one` / `preserve` | Prettier 跟随 AST 的紧凑与宽松，不可配 |
| 无序列表标记   | `list.unorderedMarker`：`dashes` / `asterisks` / `preserve` | dprint 的 `list.unorderedMarker`；remark 的 `bullet`；markdownlint 的 MD004 |
| 列表缩进       | `list.orderedIndent` / `list.unorderedIndent`：`aligned` / `3` / `4`；`list.tabWidth` | dprint 的 `list.indentKind`；remark 的 `listItemIndent`；Markdown All in One 的 `list.indentationSize` |
| 有序列表编号   | `list.orderedStyle`：`renumber` / `keep-all-ones` / `preserve`；`list.orderedDelimiter` | dprint 只会重编号；mdformat 的 `--number`；markdownlint 的 MD029 |
| 中英之间加空格 | `typography.cjkSpacing`、`collapseBoundarySpaces`、`cjkClasses`、`spacingSymbols` | AutoCorrect 有自己的一套规则，不能逐项配 |
| 中文标点宽度   | `typography.punctuationStyle`、`punctuationChangeList`、`parenStyle`、`context`、`quotes` | AutoCorrect 有总开关，没有这个粒度 |
| 全角字母数字与表意空格 | `typography.halfwidthAlphanumerics`、`ideographicSpace` | AutoCorrect 有同类行为，默认开且不可分项配 |
| 话题标签       | `typography.tags`（默认关）：打开后 `中文#标签` → `中文 #标签`，标签内部一个空格都不加 | 没有对应开关 |
| 行内代码与公式 | 当作一个拉丁词加空格，内容逐字节不动 | 没有对应开关 |
| 表格           | `table.mode`、`table.cjkWidth`、`table.maxWidth` | Prettier 总是补空格；dprint 的 `table.cellPadding`；remark 的 `tableCellPadding` 等 |
| 折行           | 不提供，有意为之                     | Prettier 的 `proseWrap`；dprint 与 deno 的 `textWrap` / `proseWrap`；mdformat 的 `--wrap` |
| front matter   | `frontMatter.format`：`normalize` / `preserve`；`frontMatter.typography`（默认开，只加删空格）；TOML 只保护并报一次 FM-06 | Prettier 会格式化 YAML 与 TOML；dprint 交给 yaml 插件；mdformat 需要插件 |
| 代码块内容     | 逐字节不动，没有开关                 | dprint 的 `codeBlock.skipFormat` 默认关；Prettier 的 `embeddedLanguageFormatting` 默认会格式化 |
| 忽略指令       | `ignore.file` / `start` / `end` / `line`，四个名字都可配 | dprint 的四个同名指令可配；Prettier 的 `prettier-ignore`；deno 的 `deno-fmt-ignore*` |
| 行尾与文件卫生 | `endOfLine`，末尾单一换行、去 BOM、裁行尾空白 | Prettier 的 `endOfLine`；dprint 的 `newLineKind`；mdformat 的 `--end-of-line` |

## 安装

在应用市场搜索 **fuxi-fmt**，或：

```sh
code --install-extension Fux-i.fuxi-fmt-vscode
```

从源码打包本地 vsix（需要 Node.js >= 22.18，推荐 24 LTS）：

```sh
npm ci
npm run vsix
code --install-extension output/fuxi-fmt-<version>.vsix
```

## 配置

每个选项都是一个设置。打开设置搜索 `fuxiFmt` —— `fuxiFmt.typography.cjkSpacing`、`fuxiFmt.list.unorderedMarker`、`fuxiFmt.blankLines.aroundBlocks` 等等。每项都会显示默认值、可选值，以及它实现的是哪条规则，所以设置面板本身就是说明书。

优先级如下，**后者覆盖前者**：

| #   | 层级             | 位置                         |
| --- | ---------------- | ---------------------------- |
| 1   | 插件默认值       | 扩展内置，无需设置           |
| 2   | 各项 `fuxiFmt.*` 设置 | 你的编辑器 —— 可按工作区文件夹、按 `[markdown]` 区分 |
| 3   | `fuxi-fmt.json`  | 提交进版本库的仓库根目录文件 |
| 4   | `fuxiFmt.config` | 你的编辑器，作为显式覆盖     |

**第 3 层故意压过第 2 层。** 命令行与 CI 永远看不到编辑器设置；如果它们优先，编辑器与命令行（`--check`，用法见 [贡献指南](CONTRIBUTING.md)）会对同一份文档给出不同结论 —— 保存时通过，流水线里失败。确实想覆盖项目配置时，用第 4 层的 `fuxiFmt.config`。

```json
{
  "fuxiFmt.enable": true,
  "fuxiFmt.typography.punctuationChangeList": [",", ".", ":", "!", "?", ";"],
  "fuxiFmt.config": { "blankLines": { "aroundBlocks": "atLeast" } }
}
```

把 `fuxiFmt.enable` 设为 `false`，可以关闭使用其格式化。

## 文档

- [功能规范](FUXI-FMT-SPEC.md) —— 行为契约，规则 ID 的权威来源
- [变更日志](CHANGELOG.md)
- [先例报告](MAINSTREAM_MD_FORMATTERS_REPORT.md) —— 其它工具逐项的选项与出处
- [贡献指南](CONTRIBUTING.md)
- [问题反馈](https://github.com/Fux-i/fuxi-fmt/issues)

## 许可证

MIT。见 [LICENSE](LICENSE)。
