# fuxi-fmt

<img src="assets/logo.png" alt="A character in a green dinosaur hood holding a formatted document" width="160" align="right" />

[中文](#中文) · [English](#english)

## 中文

**面向中文技术写作的 Markdown 格式化工具。**

VS Code 对每种语言每次保存只能运行一个格式化器，所以格式化器无法叠加。Prettier 管块级结构，
却会在中英文之间插入空格、也完全不懂中文标点；AutoCorrect 管中文标点，却不是格式化 provider，
永远占不到 `editor.defaultFormatter`。fuxi-fmt 是一个引擎同时管这两半。

### 它做什么

| | |
|---|---|
| **空行** | 块与块之间：恰好一个，或至少一个。列表与引用块内部除非你主动要求，否则不动。 |
| **标记** | `#` 之后以及每个 `-`、`*`、`+`、`1.` 标记之后加一个空格。 |
| **有序列表** | 从声明的起始编号重排，并规范标记与缩进。 |
| **行内代码** | 当作一个英文单词，所以 ``` `code` ``` 与中文相邻时会加空格。 |
| **中英之间** | 只在交界处加一个空格。`GPT-4o`、`60公里/小时`、`2.5` 都不受影响。 |
| **标点宽度** | 由紧邻的字符决定，所以 `1,000` 与 `e.g.` 保持半角。 |

### 代码永远不会被改动

围栏代码块内容、围栏缩进与 info string、front matter、行内代码与公式、HTML 块与注释、MDX 与
JSX、shortcode、wikilink、URL 与链接地址，全部**逐字节保持原样**。任何规则碰到它们都是 bug，
不是误差。

### 它从不折行

中文没有可断行的空格，折行器只能在**字符之间**断开。fuxi-fmt 从不合并、拆分或重排任何一行。

### 安装

在应用市场搜索 **fuxi-fmt**，或：

```sh
code --install-extension Fux-i.fuxi-fmt-vscode
```

### 配置

每个选项都是一个设置。打开设置搜索 `fuxiFmt` —— `fuxiFmt.typography.cjkSpacing`、
`fuxiFmt.list.unorderedMarker`、`fuxiFmt.blankLines.aroundBlocks` 等等。每项都会显示默认值、
可选值，以及它实现的是哪条规则，所以设置面板本身就是说明书。

优先级如下，**后者覆盖前者**：

| # | 层级 | 位置 |
|---|---|---|
| 1 | 插件默认值 | 扩展内置，无需设置 |
| 2 | 各项 `fuxiFmt.*` 设置 | 你的编辑器 —— 可按工作区文件夹、按 `[markdown]` 区分 |
| 3 | `fuxi-fmt.json` | 提交进版本库的仓库根目录文件 |
| 4 | `fuxiFmt.config` | 你的编辑器，作为显式覆盖 |

**第 3 层故意压过第 2 层。** CLI 永远看不到你的编辑器设置；如果它们优先，编辑器与 CI 中的
`fuxi-fmt --check` 会对同一份文档给出不同结论 —— 保存时通过，流水线里失败。确实想覆盖项目
配置时，用第 4 层的 `fuxiFmt.config`。

```json
{
  "fuxiFmt.enable": true,
  "fuxiFmt.typography.punctuationChangeList": [",", ".", ":", "!", "?", ";"],
  "fuxiFmt.config": { "blankLines": { "aroundBlocks": "atLeast" } }
}
```

把 `fuxiFmt.enable` 设为 `false`，可以在不卸载的前提下关闭格式化。

### 当它判断错你的文档时

每条规则都可能对某一段不适用。三个指令可以声明这一点，其中的内容一律不动：

### 保证

- **最小改动。** 一次修改只产生很小的编辑范围，保存时格式化不会重写整个文件，也不会打乱光标
  和撤销历史。
- **语义保持。** 有一道守卫会把结果与原文对比，遇到解析结果不同的文档就拒绝返回；它一旦触发，
  你拿回的是原封不动的文档。
- **幂等。** 再跑一次不会产生任何改动。
- **无依赖。** 引擎没有任何运行时依赖，也从不 import VS Code 的 API。

### 链接

- [仓库与规范](https://github.com/Fux-i/fuxi-fmt)
- [完整更新日志](https://github.com/Fux-i/fuxi-fmt/blob/main/CHANGELOG.md)
- [问题反馈](https://github.com/Fux-i/fuxi-fmt/issues)

### 许可证

MIT

---

## English


**A Markdown formatter for Chinese technical writing.**

VS Code runs exactly one formatter per language per save, so formatters cannot be composed.
Prettier owns block structure but inserts spaces between CJK and Latin and knows nothing about
Chinese punctuation. AutoCorrect owns CJK punctuation but is not a formatting provider and can
never hold `editor.defaultFormatter`. fuxi-fmt is one engine that owns both halves.

## What it does

| | |
|---|---|
| **Blank lines** | Around blocks: exactly one, or at least one. Never inside a list or blockquote unless you ask. |
| **Markers** | One space after `#`, and after every `-`, `*`, `+` and `1.` marker. |
| **Ordered lists** | Renumbered from the declared start, with markers and indentation normalised. |
| **Inline code** | Treated as an English word, so `` `code` `` is spaced when it meets Chinese. |
| **CJK to Latin** | A space at the boundary only. `GPT-4o`, `60公里/小时` and `2.5` are left alone. |
| **Punctuation width** | Decided by what sits next to it, which is why `1,000` and `e.g.` stay half-width. |

## Code is never touched

Fenced code bodies, fence indentation and info strings, front matter, inline code and math, HTML
blocks and comments, MDX and JSX, shortcodes, wikilinks, URLs and link destinations are all
**byte-verbatim**. A rule that touched one of these would be a bug, not a rounding error.

## It never wraps

Chinese has no spaces to break at, so a wrapping printer has to split *between characters*.
fuxi-fmt never joins, splits or reflows a line.

## Install

Search the Marketplace for **fuxi-fmt**, or:

```sh
code --install-extension Fux-i.fuxi-fmt-vscode
```

## Configure

Every option is a setting, and the settings panel is localised: with VS Code set to Simplified
Chinese, the descriptions below appear in Chinese (`package.nls.zh-cn.json`). Open Settings and
search for `fuxiFmt` — `fuxiFmt.typography.cjkSpacing`,
`fuxiFmt.list.unorderedMarker`, `fuxiFmt.blankLines.aroundBlocks` and the rest. Each shows its
default, its allowed values and the rule it implements, so the panel is the reference.

They resolve in this order, **last wins**:

| # | Layer | Where it lives |
|---|---|---|
| 1 | Contributed defaults | the extension; nothing to set |
| 2 | Individual `fuxiFmt.*` settings | your editor — per workspace folder, per `[markdown]` |
| 3 | `fuxi-fmt.json` | the committed file at the workspace root |
| 4 | `fuxiFmt.config` | your editor, as an explicit override |

**Layer 3 beats layer 2 on purpose.** The CLI can never see your editor settings, so if they won,
the editor and `fuxi-fmt --check` in CI would disagree about the same document — files that pass on
save and fail in the pipeline. Use `fuxiFmt.config` (layer 4) when you do mean to override the
project on purpose.

```json
{
  "fuxiFmt.enable": true,
  "fuxiFmt.typography.punctuationChangeList": [",", ".", ":", "!", "?", ";"],
  "fuxiFmt.config": { "blankLines": { "aroundBlocks": "atLeast" } }
}
```

Set `fuxiFmt.enable` to `false` to turn the formatter off without uninstalling it.

## When it is wrong about your document

Every rule can be wrong for one paragraph. Three directives say so, and nothing inside them is
touched:

```md
<!-- fuxi-fmt-ignore-file -->

<!-- fuxi-fmt-ignore-start -->
这 一段 保持 原样
<!-- fuxi-fmt-ignore-end -->

<!-- fuxi-fmt-ignore -->
这一块保持原样
```

## Guarantees

- **Minimal edits.** A change produces a small edit range, so format-on-save does not rewrite the
  file and does not disturb the cursor or the undo history.
- **Semantic preservation.** A guard compares the result against the input and refuses to return a
  document that parses differently. If it fires, you get your document back unchanged.
- **Idempotent.** Running it twice changes nothing the second time.
- **No dependencies.** The engine has no runtime dependencies and never imports the VS Code API.

## Links

- [Repository and specification](https://github.com/Fux-i/fuxi-fmt)
- [Full changelog](https://github.com/Fux-i/fuxi-fmt/blob/main/CHANGELOG.md)
- [Issues](https://github.com/Fux-i/fuxi-fmt/issues)

## License

MIT
