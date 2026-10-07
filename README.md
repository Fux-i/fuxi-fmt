# fuxi-fmt

<img src="packages/vscode/assets/logo.png" alt="一个穿着绿色恐龙连帽衫、捧着一份文档的角色" width="160" align="right" />

**面向中文技术写作的 Markdown 格式化工具。**

## 这是什么，为什么做

VS Code 对每种语言、每次保存只运行一个格式化器，所以格式化器无法叠加。Prettier 管块级结构，却会在中英文之间插入空格、也完全不懂中文标点；markdownlint 修空行和列表编号，但没有排版规则，而且它的 MD038 与「行内代码两侧加空格」恰好相反；AutoCorrect 管中文标点与中英间距，却根本不是格式化提供程序，永远占不到 `editor.defaultFormatter`。这些碎片拼不起来。

fuxi-fmt 是一个引擎、一套配置，同时管这两半。

行为契约在[功能规范](FUXI-FMT-SPEC.md)，与其它工具的逐条对比证据在[先例报告](MAINSTREAM_MD_FORMATTERS_REPORT.md)。

## 项目状态：积极开发中

本项目正在积极开发中。规范里的每条行为规则都已实现，四个忽略指令都有效，命令行与 VS Code 扩展都能用。仍有少数选项尚未实现或已被撤回，**权威清单只有一处**，在[规范第 7 节](FUXI-FMT-SPEC.md)的状态注记里，本节不重复它。<!-- fuxi-fmt:work-in-progress -->

两处诚实的保留：扩展可以打包、也能在桩模块上跑通测试，但**还没有在真实的 VS Code 里加载验证过**；命令行（`@fuxi-fmt/cli`）没有发布到 npm，只能从源码运行。

这里刻意不写测试数量。它写过 173、254、315，每次写下来时都是对的，几个发布周期后就错了，而读者对此无能为力。想知道就跑 `npm test`。

## 亮点

- **一个引擎同时管块级结构与中文排版。** 空行、标记空格、有序列表重编号、列表缩进、中英之间加空格、中文标点全角或半角、行内代码两侧的空格，全部由同一套配置决定，不需要拼三个扩展。
- **代码永远不会被改动。** 围栏代码正文与 info string、front matter、行内代码与公式、HTML 块与注释、MDX/JSX、shortcode、wikilink、URL 与链接目标全部逐字节保持原样。这是默认行为，不是需要你自己打开的开关。
- **它从不折行。** 中文没有可断行的空格，折行器只能在字符之间断开，所以 fuxi-fmt 从不合并、拆分或重排任何一行。
- **语义守卫。** 结果与原文的解析树不一致时拒绝写入，你拿回的是原封不动的文档；解析不得不猜的地方（未终止的围栏、front matter、HTML 注释、公式块）也会拒绝并点名那一行。
- **幂等、最小编辑。** 再跑一次不改动任何东西；保存时格式化只产生很小的编辑范围，不打乱光标与撤销历史。
- **几乎所有东西都能在设置里改。** 33 个选项，每一个都是 VS Code 设置，带默认值、可选值以及它实现的是哪条规范规则，所以设置面板本身就是说明书[^opt]。
- **无运行时依赖。** 核心没有任何运行时依赖，也从不 import 编辑器 API；基准里它在一份 10,129 行的文档上比 Prettier 快 9.8 倍。

[^opt]: 规范第 7 节列出的少数未实现或已撤回的选项是例外，权威清单在那里。

## 与主流工具对比

所有判断都来自[先例报告](MAINSTREAM_MD_FORMATTERS_REPORT.md)中逐条链接的第一手文档或源码，数据截至 2026-10。完整的九行矩阵在[规范第 5 节](FUXI-FMT-SPEC.md)。

### 功能对比

Y = 覆盖，P = 部分或带条件，N = 不覆盖。

| 需求 | Prettier | dprint / Deno | markdownlint | Markdown All in One | AutoCorrect | CJK Text Formatter | **fuxi-fmt** |
|---|---|---|---|---|---|---|---|
| 块与块之间的空行 | Y | Y | Y | N | N | N | **Y** |
| `#` 与列表标记之后的空格 | Y | Y | Y | P | N | N | **Y** |
| 有序列表重新编号 | Y | Y | Y | P（仅输入时） | N | N | **Y** |
| front matter | Y（YAML + TOML） | P | N | N | N | N | **N**（有意为之） |
| 行内代码两侧的空格 | N | N | N（MD038 恰好相反） | N | P | N | **Y** |
| CJK 与拉丁文之间的空格 | N | N | N | N | Y | Y | **Y** |
| 中文标点宽度 | N | N | N | N | Y | Y | **Y** |
| 永不触碰围栏代码 | P（需手动关） | P（需手动关） | Y | Y | P（需手动关） | Y | **Y（默认）** |

「全部选项可调」这一行留给下面的表回答——它需要逐项看，而不是一个字母。

### 可配置项对比

左列是 fuxi-fmt 的设置，右列是主流工具里对应的开关。空着是说「没有对应的选项」，不是「没查过」。

| 可配置项 | fuxi-fmt | 其它工具 |
|---|---|---|
| 块与块之间的空行 | `blankLines.aroundBlocks`：`exact` / `atLeast`；`blankLines.maxConsecutive` 上限 | dprint 的 `maxBlankLines` 只能设上限；Prettier 固定为一个空行 |
| 列表内部的空行 | `blankLines.insideLists`：`remove` / `one` / `preserve` | Prettier 跟随 AST 的紧凑与宽松，不可配 |
| 无序列表标记 | `list.unorderedMarker`：`dashes` / `asterisks` / `preserve` | dprint 的 `list.unorderedMarker`；remark 的 `bullet`；markdownlint 的 MD004 |
| 列表缩进 | `list.orderedIndent` / `list.unorderedIndent`：`aligned` / `3` / `4`；`list.tabWidth` | dprint 的 `list.indentKind`；remark 的 `listItemIndent`；Markdown All in One 的 `list.indentationSize` |
| 有序列表编号 | `list.orderedStyle`：`renumber` / `keep-all-ones` / `preserve`；`list.orderedDelimiter` | dprint 只会重编号；mdformat 的 `--number`；markdownlint 的 MD029 |
| 中英之间加空格 | `typography.cjkSpacing`、`cjkClasses`、`spacingSymbols`、`hashtag` | AutoCorrect 有自己的一套规则，不能逐项配 |
| 中文标点宽度 | `typography.punctuationStyle`、`punctuationChangeList`、`parenStyle`、`context`、`quotes` | AutoCorrect 有总开关，没有这个粒度 |
| 全角字母数字与表意空格 | `typography.halfwidthAlphanumerics`、`ideographicSpace` | AutoCorrect 有同类行为，默认开且不可分项配 |
| 行内代码与公式 | 当作一个拉丁词加空格，内容逐字节不动 | 没有对应开关 |
| 表格 | `table.mode`、`table.cjkWidth`、`table.maxWidth` | Prettier 总是补空格；dprint 的 `table.cellPadding`；remark 的 `tableCellPadding` 等 |
| 折行 | 不提供，有意为之 | Prettier 的 `proseWrap`；dprint 与 deno 的 `textWrap` / `proseWrap`；mdformat 的 `--wrap` |
| front matter | 完整保护，不做任何修改 | Prettier 会格式化 YAML 与 TOML；dprint 交给 yaml 插件；mdformat 需要插件 |
| 围栏代码内容 | 逐字节不动，没有开关 | dprint 的 `codeBlock.skipFormat` 默认关；Prettier 的 `embeddedLanguageFormatting` 默认会格式化 |
| 忽略指令 | `ignore.file` / `start` / `end` / `line`，四个名字都可配 | dprint 的四个同名指令可配；Prettier 的 `prettier-ignore`；deno 的 `deno-fmt-ignore*` |
| 行尾与文件卫生 | `endOfLine`，末尾单一换行、去 BOM、裁行尾空白 | Prettier 的 `endOfLine`；dprint 的 `newLineKind`；mdformat 的 `--end-of-line` |

## 安装

在应用市场搜索 **fuxi-fmt**，或：

```sh
code --install-extension Fux-i.fuxi-fmt-vscode
```

从源码打包本地 vsix：

```sh
npm ci
npm run vsix
code --install-extension output/fuxi-fmt-<version>.vsix
```

命令行还没有发布到 npm，可以从源码运行：

```sh
node packages/cli/src/main.ts --check docs/   # 有改动就退出码 1
node packages/cli/src/main.ts --diff  docs/   # 只显示会变的行
node packages/cli/src/main.ts --write docs/   # 就地改写
node packages/cli/src/main.ts --explain a.md  # 说明发现了什么、做了什么
node packages/cli/src/main.ts --lang zh a.md  # 用中文打印消息
```

## 配置

每个选项都是一个设置。打开设置搜索 `fuxiFmt` —— `fuxiFmt.typography.cjkSpacing`、`fuxiFmt.list.unorderedMarker`、`fuxiFmt.blankLines.aroundBlocks` 等等。每项都会显示默认值、可选值，以及它实现的是哪条规则，所以设置面板本身就是说明书。

优先级如下，**后者覆盖前者**：

| # | 层级 | 位置 |
|---|---|---|
| 1 | 插件默认值 | 扩展内置，无需设置 |
| 2 | 各项 `fuxiFmt.*` 设置 | 你的编辑器 —— 可按工作区文件夹、按 `[markdown]` 区分 |
| 3 | `fuxi-fmt.json` | 提交进版本库的仓库根目录文件 |
| 4 | `fuxiFmt.config` | 你的编辑器，作为显式覆盖 |

**第 3 层故意压过第 2 层。** 命令行与 CI 永远看不到编辑器设置；如果它们优先，编辑器与 `fuxi-fmt --check` 会对同一份文档给出不同结论 —— 保存时通过，流水线里失败。确实想覆盖项目配置时，用第 4 层的 `fuxiFmt.config`。

```json
{
  "fuxiFmt.enable": true,
  "fuxiFmt.typography.punctuationChangeList": [",", ".", ":", "!", "?", ";"],
  "fuxiFmt.config": { "blankLines": { "aroundBlocks": "atLeast" } }
}
```

把 `fuxiFmt.enable` 设为 `false`，可以在不卸载的前提下关闭格式化。

## 保证

- **语义保持。** 有一道守卫把结果与原文的解析树对比，不同就拒绝返回；它一旦触发，你拿回的是原封不动的文档。
- **幂等。** 再跑一次不会产生任何改动。
- **最小改动。** 一次修改只产生很小的编辑范围，保存时格式化不会重写整个文件，也不会打乱光标和撤销历史。
- **绝不损坏。** 格式化器不抛异常、不破坏文档；最坏情况是原样输出并给出一条诊断。
- **无依赖。** 核心没有任何运行时依赖，也从不 import VS Code 的 API。

## 环境要求

Node.js >= 22.18（推荐 24 LTS）。核心没有运行时依赖，也没有构建步骤：Node 原生剥离 TypeScript 类型，并自带测试运行器。

## 文档

- [功能规范](FUXI-FMT-SPEC.md) —— 行为契约，规则 ID 的权威来源
- [变更日志](CHANGELOG.md)
- [先例报告](MAINSTREAM_MD_FORMATTERS_REPORT.md) —— 其它工具逐项的选项与出处
- [贡献指南](CONTRIBUTING.md)
- [问题反馈](https://github.com/Fux-i/fuxi-fmt/issues)

## 许可证

MIT。见 [LICENSE](LICENSE)。
