# fuxi-fmt

[中文](#中文) · [English](#english)

## 中文

**面向中文技术写作的 Markdown 格式化工具。**

现有的工具各自只解决一半问题。Prettier 管块级结构，却会在中英文之间插入空格、也完全不懂中文
标点；markdownlint 修空行和列表编号，但没有排版规则，而且它的 MD038 与「行内代码两侧加空格」
恰好相反；AutoCorrect 管中文标点与中英间距，却根本不是格式化 provider，永远占不到
`editor.defaultFormatter`。而 VS Code 对每种语言每次保存只运行一个格式化器，这些碎片拼不起来。

fuxi-fmt 是一个引擎、一套配置，同时管这两半。

### 它会做什么

- **块间空行**：恰好一个，或至少一个。
- **标记空格**：`#` 之后，以及每个列表标记之后。
- **有序列表重编号**：从声明的起始编号开始。
- **行内代码两侧的空格**：把行内代码当作一个英文单词。
- **中英之间加空格**：只在交界处加一个。
- **中文标点全角/半角**：由紧邻的字符决定。
- **列表缩进规范化**：按父项的内容列对齐。

### 它不会做什么

- **不折行。** 中文没有可断行的空格，折行只能在字符之间断开，所以从不合并、拆分或重排任何一行。
- **不给表格加内边距。**
- **不动代码。** 围栏代码块、front matter、行内代码、HTML、MDX、shortcode、wikilink、URL
  一律逐字节保持原样。

### 保证

- **语义保持。** 有一道守卫把结果与原文对比，解析结果不同就拒绝返回；它一旦触发，你拿回的是
  原封不动的文档。
- **幂等。** 再跑一次不会产生任何改动。
- **最小改动。** 一次修改只产生很小的编辑范围，不打乱光标与撤销历史。
- **无依赖。** 核心没有任何运行时依赖。

### 在 VS Code 中配置

每个选项都是一个设置 —— `fuxiFmt.typography.cjkSpacing`、`fuxiFmt.list.unorderedMarker`、
`fuxiFmt.blankLines.aroundBlocks` 等等 —— 带默认值、可选值，以及它实现的是哪条规则，所以设置
面板本身就是说明书。所有设置都是 `resource` 作用域，因此可按工作区文件夹、按 `[markdown]` 区分。

优先级如下，**后者覆盖前者**：

| # | 层级 | 位置 |
|---|---|---|
| 1 | 插件默认值 | 扩展内置，无需设置 |
| 2 | 各项 `fuxiFmt.*` 设置 | 你的编辑器 |
| 3 | `fuxi-fmt.json` | 提交进版本库的仓库根目录文件 |
| 4 | `fuxiFmt.config` | 你的编辑器，作为显式覆盖 |

**第 3 层故意压过第 2 层。** CLI 与 CI 永远看不到编辑器设置；如果它们优先，编辑器与
`fuxi-fmt --check` 会对同一份文档给出不同结论 —— 保存时通过，流水线里失败。

### 环境要求

Node.js >= 22.18（推荐 24 LTS）。核心没有运行时依赖，也没有构建步骤：Node 原生剥离 TypeScript
类型，并自带测试运行器。

### 约束

这些不是偏好，每一条都有测量结果支撑，数字见规范中的性能表。

- **`packages/core` 不引入任何运行时依赖。**
- **格式化路径上不用 remark 或 micromark。**
- **不使用 pangu，也不整体照搬它的规则集。**

### 许可证

MIT

以上为中文说明。面向贡献者的章节 —— 开发、仓库结构、设计原则、剩余工作 —— 以英文列在下方。

---

## English

A Markdown formatter for Chinese technical writing.

Existing tools each solve half the problem. Prettier handles block structure but inserts spaces
between CJK and Latin and knows nothing about Chinese punctuation. markdownlint fixes blank
lines and list numbering but has no typography rules, and its MD038 rule does the *opposite* of
spacing around inline code. AutoCorrect handles CJK spacing and punctuation but **is not a
formatting provider at all** — it can never occupy the `editor.defaultFormatter` slot. And
VS Code runs exactly one formatter per language per save, so the pieces cannot be composed.

fuxi-fmt is one engine with one configuration surface that owns both halves.

## Status

**Alpha.** Every behavioural rule in the specification is implemented, and every configuration
directive works. Four documented options do not, and are listed under Remaining work rather than
left for a reader to discover by setting one.

There is deliberately no test count here. It read 173, then 254, then 315 — accurate each time it
was written, wrong within a few releases, and not something a reader can act on. Run `npm test`.

Implemented: SAFE-01–SAFE-06, FM-01, BLK-01–BLK-07, BLK-09–BLK-11,
TYPO-01–TYPO-09, GRT-01–GRT-04, GRT-06, CFG-01, CFG-04, the CLI and the VS Code
extension.

There is now a command line interface:

```sh
node packages/cli/src/main.ts --check docs/   # exit 1 if anything would change
node packages/cli/src/main.ts --diff  docs/   # show the lines that would change
node packages/cli/src/main.ts --write docs/   # rewrite in place
node packages/cli/src/main.ts --explain a.md    # say what was found and what was done
node packages/cli/src/main.ts --lang zh a.md    # print the messages in Chinese
```

`--explain` and `--lang` are modifiers rather than modes, so they compose with the others. Messages
are English unless asked for; `--lang` switches them, and `LC_ALL` or `LANG` decides when nothing is
asked for. A language with no translation falls back to English rather than to a raw key.
`--explain` writes its report
to stderr: where the configuration came from, whether the document changed, and what was warned
about. Warnings are reported and do not fail the run. Two things do fail the run: the semantic guard
refusing a document, and a detection that the document was misread — an unterminated code fence or
HTML comment, where everything after the mistake was read as part of it (DET-01, DET-03).
On the command line each diagnostic is one line in the shape every compiler has used for forty
years — `path:line: severity: RULE message` — with the line left out when the core has none, and
the line being the one in the file on disk rather than the one the formatter's own blank-line policy
moved it to. An unterminated block is an error and refuses the document; a doubtful parse that did
terminate is a warning and the document still formats (DET-06 … DET-12), with one switch per warning
in the editor settings, all on by default, because a warning that cannot be turned off is a warning
that gets the whole feature turned off.

In the editor the same diagnostics reach the **Problems** panel, which is where a location can be
clicked, and the output panel as a block per file:

    =====docs/guide.md 16:20:01=====
    WARNING[12] DET-06 unmatched backtick: nothing closes it, so it stays literal text
    ERROR DET-02 unterminated front matter: the opening line is never closed

The header names the file relative to the workspace folder and the run it belongs to; a clean
document writes nothing. The severity words and rule ids stay Latin so that one search finds a rule
in either log. The sentences follow the editor's **display language** — Chinese when VS Code is set
to Chinese, English otherwise — and come from the same catalogue the command line reads, so the two
cannot drift apart.
A configuration key that is not an option, or a retired one, is reported the same way — the one
thing a silently ignored key can never say is that it was ignored.

`--diff` resynchronises line by line. The alignment lives in `core/diff.ts` and the CLI
formats its result. It is greedy rather than LCS or Myers, so a document full of repeated lines
can still mis-align, and `--help` calls the output approximate for that reason.

The adapter computes its edits from the same alignment, tightening each region to the characters
that actually differ so that inserting one space does not replace a whole line. That tightening
is what makes a document edited in several places yield several small edits rather than one wide
one, and it matters for range formatting: a single document-wide edit lies outside any selection,
so `editsInRange` would discard it and "format selection" would silently do nothing.

The VS Code extension builds: `npm run build` produces `packages/vscode/dist/extension.cjs`
with the core inlined, and the manifest declares `onLanguage:markdown` activation,
`untrustedWorkspaces: supported`, and the `fuxiFmt.enable` setting. Loading it in a real
extension host has not been verified.

Also outstanding: loading the extension in a real editor.

This paragraph used to name in-document ignore directives (CFG-03) and list reindentation (BLK-08)
as well, both of which had shipped. The check could not see them: it looks for option names on lines
that use that word, and these were rule IDs — which is why it reads rule IDs now too.

The normative behavioural contract is [FUXI-FMT-SPEC.md](FUXI-FMT-SPEC.md) — read that
first. The prior-art survey is
[MAINSTREAM_MD_FORMATTERS_REPORT.md](MAINSTREAM_MD_FORMATTERS_REPORT.md).

An `origin` remote is configured (`git@github.com:Fux-i/fuxi-fmt.git`) but nothing has
been pushed. Releases are tagged locally and do not exist upstream.

## What it will do

- Blank lines around blocks, with a choice of exactly one or at least one
- One space after `#` and after list markers
- Ordered lists renumbered, preserving the author's lazy `1.` style
- CJK ↔ Latin/number spacing, implemented directly rather than delegated to pangu
- CJK punctuation full-width/half-width normalization
- Inline code and inline math treated as a Latin word, contents untouched
- Protected regions that are never modified: fenced code, front matter, HTML, math, MDX,
  shortcodes, wikilinks, URLs
- Every rule individually configurable

## What it will not do

Prose wrapping or line joining, table padding, embedded code formatting, heading-style
conversion, TOC generation, prose linting. See spec section 3 for the full list with rationale.

## Guarantees

The formatter is expected to be, and is tested to be:

1. **Semantics-preserving** — output parses to the same tree as input, except for a documented
   list of intentional differences. Enforced by a parse-equality guard that refuses to write on
   mismatch.
2. **Idempotent** — `format(format(x)) === format(x)`.
3. **Minimal-diff** — formatting a clean file produces zero edits.
4. **Total** — never throws, never corrupts; worst case it reproduces the input unchanged.

## Requirements

- Node.js >= 22.18 (24 LTS recommended). The core needs no runtime dependencies and no build
  step: Node strips TypeScript types natively and ships a test runner.

## Development

```sh
npm ci               # install exact dependencies from the lockfile, as CI does
npm test             # run the test suite
npm run test:watch   # watch mode
npm run typecheck    # tsc -p for each package
npm run ci           # typecheck + tests, what CI runs
npm run build        # bundle the VS Code extension
npm run vsix         # build, then package output/fuxi-fmt-<version>.vsix to install
```

### Verifying a change without lying to yourself

**Never pipe a verification command.** `npm run typecheck | tail -4` reports *tail's* exit status,
so a typecheck failure scrolls past and `set -e` never fires. Redirect and test the real status:

```sh
npm run typecheck > /tmp/tc.log 2>&1 || { tail -8 /tmp/tc.log; exit 1; }
```

The mirror hazard is `set -o pipefail` with a consumer that exits early. `grep -A2 x file | head -3`
makes `grep` die of SIGPIPE, `pipefail` surfaces it, and the script stops half-way — with
correct-looking output above the failure. Both cost this repository a round each: the first let a
broken commit land, the second silently truncated an audit.

This note is here rather than in `AGENTS.md` because that file is excluded by a global gitignore in
the author's environment, so a fresh clone would not receive it.

## Repository layout

```
packages/
  core/              adapter-free formatting engine (no VS Code imports, ever)
  cli/               fuxi-fmt --check --diff --write
  vscode/            extension: providers, minimal edits, esbuild bundle
FUXI-FMT-SPEC.md     normative behavioural contract
MAINSTREAM_MD_FORMATTERS_REPORT.md
                     prior-art survey, with primary sources
.bench/              benchmark harness (see Appendix B of the spec)
```

The CLI and the extension are thin adapters over `@fuxi-fmt/core`, which never imports from
either. `AGENTS.md` holds contributor and agent guidance, but a global gitignore in this
environment excludes it, so a fresh clone will not contain it.

## Design principles

- **The spec is normative.** Rule IDs in the code match rule IDs in `FUXI-FMT-SPEC.md`. If
  code and spec disagree, that is a bug in one of them, not a matter of taste.
- **Protection is the default.** Anything that is not recognised prose is copied byte-for-byte.
  Protection is opt-out, never opt-in.
- **The core knows nothing about VS Code.** Adapters translate; they do not decide.
- **Test first.** Rules are written as failing tests before they are implemented.

## Settings in VS Code

Every option is a VS Code setting — `fuxiFmt.typography.cjkSpacing`, `fuxiFmt.list.unorderedMarker`,
`fuxiFmt.blankLines.aroundBlocks` and the other 21 — contributed with their defaults, their allowed
values and the specification rule each one implements. They render in the Settings UI as ordinary
controls, so the panel doubles as the reference.

Four layers, **last wins**:

| # | Layer | Lives in |
|---|---|---|
| 1 | Contributed defaults | the extension; nothing to set |
| 2 | Individual `fuxiFmt.*` settings | editor settings, `resource`-scoped |
| 3 | `fuxi-fmt.json` | the repository |
| 4 | `fuxiFmt.config` object | editor settings, explicit override |

**Layer 3 beats layer 2 deliberately.** The CLI and CI can never see editor settings, so if a
personal setting beat the committed file, the editor and `fuxi-fmt --check` would disagree about the
same document — a file that formats clean on save and fails the pipeline. `fuxiFmt.config` exists for
when you do mean to override the project, on purpose.

`packages/core/src/settings.test.ts` asserts that this list and the core's option surface are
identical in both directions, that each setting carries the core's own default, and that every
setting is `resource`-scoped.

## Constraints

These are not preferences. Each one is measured, and the numbers are in the specification's
performance envelope.

- **No runtime dependencies in `packages/core`.** It has none, and adding one needs an argument
  rather than a convenience.
- **No remark or micromark on the formatting path.** remark parses the 10,129-line fixture in
  164.5 ms against markdown-it's 8.3 ms, and a full AST is not needed for this job — the whole
  document is formatted in 47.3 ms.
- **No pangu, and no wholesale copy of its rule set.** Section 1.2 of the specification lists where
  it is wrong for Markdown. The specification's own rule table is authoritative.

They are here rather than only in `AGENTS.md` because that file is excluded by a global gitignore
in the author's environment, so a fresh clone would not receive them — the same reason the
verification warnings above were moved here.

## Remaining work

Kept here rather than in a session because it has to survive a fresh clone. The specification
is the authority; this is the shortest accurate summary of the gap.

| Item | State |
|---|---|
| **Two options shipped since this section was written** | `blankLines.insideLists` and `typography.spacingSymbols` (then called `symbolWhitelist`) are implemented and tested. The build plan that used to sit here described work that had already landed, and it read as unfinished to everyone who saw it — including to me, two rounds ago. |

### `blankLines.insideBlockquotes`: withdrawn, not built

The option promised a blank line inside a blockquote. A blank line inside a blockquote is a `>`
line, a `>` line is non-blank, and GRT-01 compares the non-blank line count and refuses any change
to it. So the only mechanism that could implement the option is the one the semantic guard forbids:
the formatter would return the input unchanged with a diagnostic, having "implemented" it.

Something had to give, and it should not be the guard. Semantic preservation is the promise the
whole tool rests on and the check the adapter refuses to write through. A cosmetic blank line is
not worth loosening it, so the option is **withdrawn** — the same remedy `frontMatter.enabled` got,
for the same reason.

If quote-internal spacing is wanted later, the honest route is a guard clause naming a *documented
intentional difference* explicitly, so the exception is visible where the guarantee is checked
rather than implied by a config key.

### The remaining options

| Option | Judgment |
| `blankLines.insideLists` | **Shipped.** Three-way: `remove` / `one` / `preserve`, default `remove`. The escape hatch for an author who wants the loose form exists, and BLK-03 stops the formatter doing it unasked. |
| `typography.spacingSymbols` (was `symbolWhitelist`) | **Shipped.** The symbol set is configurable; `cjkClasses` set the precedent and a Japanese or Korean user can now ask for a different one. |
| **Extension host** | The bundle runs against a stubbed `vscode` module in tests. It has never been loaded by a real editor. |
| **The corpus** | `packages/core/test/fixtures/corpus/` is a byte-exact corpus: the author's own stress document and a zoo of every protected region the scanner knows, with the region comparison verified rather than assumed and a test that fails if any region kind goes uncovered. It is still not a real Chinese technical article. |

**Not implemented at all:** `typography.collapseBoundarySpaces`. The specification declares the
same set, and a test asserts the two lists agree.

The table is the handoff. It has drifted before — it listed `typography.semicolon` and
config presets as unimplemented more than a release after each shipped — which is why the
specification's own status note is checked by a test. The two "not implemented at all"
lists are now checked against each other as well. The table's prose is still unverified; its
claims about what is missing are not.

**BLK-08: an approach already tried and disproven.** Deriving nesting depth from a
stack of *observed* indents does not work. For any list whose first item is already indented —
a fragment, a continuation, a list nested under something the segmenter did not classify as a
list — that first indent becomes depth 0 and the item is silently **dedented**, changing document
structure. Three existing tests caught it (`  - nested` becoming `- nested`). Any correct
implementation needs the absolute nesting baseline for a list before it reindents anything, which
is a block-parsing question rather than a stack question. Do not re-attempt the stack version.

**BLK-08: the shape of a correct implementation.** The dead end above failed by *inferring* depth
from indentation. The way out is to never infer it: read the marker column of each item directly,
because a list marker is an observable fact rather than a deduction.

1. Walk the lines once and record, per list item, the column of its marker and the column where
   its content begins. A line is an item when it matches `^(\s*)([-*+]|\d+[.)])\s`.
2. Group consecutive items whose markers share a parent: an item is a child of the most recent item
   whose content column is less than this item's marker column.
3. Rewrite each marker to its parent's content column, and shift that item's continuation lines by
   the same delta. Nothing is inferred from how deep the indentation *looks*; the parent is the one
   whose content column the marker is actually nested under.
4. A list containing a protected block is excluded entirely and a diagnostic is reported (spec
   section 7 item 1, option b). Moving code the author fixed in place is what SAFE-02 exists to
   prevent.
5. An item whose marker column matches no parent's content column is left alone rather than snapped
   to the nearest, which is the failure mode of the stack version.

Tests this has to satisfy before it ships: a fragment whose first item is already indented; a nested
list; a list inside a blockquote; a list containing a fence (excluded, diagnostic); an ordered list
whose markers change width (`9.` to `10.`); and idempotence over all of them.

**The range directive: done in 0.17.0, kept as a lesson.** The plan written before the attempt
named three wiring points; there were five, and it took three attempts. The two that were missed
first — the width and punctuation passes, which run before typography and mask themselves
independently — are recorded in the 0.17.0 commit message.

What is worth keeping is the shape of the mistake: **a plan written before an attempt is a
hypothesis, and only the attempt tests it.** The first version of this note was confidently
wrong, and a reverted implementation is what corrected it.

Move the existing `hasIgnoreFile` out of `format.ts` into the same module, and add `start` and
`end` to `IgnoreOptions`. The specification's and this file's "not implemented at all" lists
must change in the same commit: the cross-document check fails otherwise, because both options
would then exist in the defaults.

This is four files and roughly eight edits. It was attempted nowhere and deferred five times;
the cost is not the design, it is a change of that size needing more room than one sitting has
had available.

Two things are worth doing before adding any of the above:

1. **Run it on a real article.** If the spacing, punctuation or parenthesis rules disagree with
   how you actually write, the remaining feature list is the wrong thing to work on.
2. **Load the extension in a real VS Code.** The stub proves the code path runs; only the editor
   proves the manifest, activation events and trust declaration are right.

## License

MIT. See [LICENSE](LICENSE).
