
# Mainstream Markdown Formatters — Configurable Feature Surface

Facts only; primary docs/source cited. Inline code shown with &#96; (rendered as a backtick by the reader).

## 1. Prettier

Built-in supports markdown via the `markdown` parser (micromark; MDX via `mdx`). Markdown-specific options are registered in [`src/language-markdown/options.js`](https://github.com/prettier/prettier/blob/main/src/language-markdown/options.js); general options in [Options](https://prettier.io/docs/options).

**Markdown-relevant options**
- `proseWrap`: `"preserve"` (default) / `"always"` (wrap to `printWidth`) / `"never"` (each prose block one line). [Options §Prose Wrap](https://prettier.io/docs/options#prose-wrap)
- `printWidth` 80 — used by `always` and table layout.
- `tabWidth` 2, `useTabs` false — list content indentation/alignment uses `options.tabWidth` ([print/list.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/list.js)).
- `endOfLine` `"lf"` (default).
- `embeddedLanguageFormatting` `"auto"` (default) / `"off"` — `auto` formats fenced code whose info string maps to a parser via [embed.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/embed.js); `off` disables.
- `singleQuote` false — a markdown option, consumed only in [print/mdast.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/mdast.js) `getPreferredQuote(title, options.singleQuote)` (preferred quote char for link/image titles).
- No option for bullet/emphasis/fence/heading style: those are fixed by the printer.

**Concrete normalizations** (all in [src/language-markdown/](https://github.com/prettier/prettier/tree/main/src/language-markdown))
- Unordered lists: primary `-`, and `*` for the alternating list sibling (adjacent lists alternate); task items `[x]`/`[ ]` (list.js).
- Ordered lists: first item prints the source start number; later items print `start+index`; marker `.`/`)` alternates across consecutive lists; a git-diff-friendly list (>=2 items, item 2 is 1, and item 1 != 0 or item 3 is 1) prints every item as `1.`; values clamp at 999,999,999 (list.js, utilities.js). Nested lists are numbered independently.
- Emphasis `_` by default, switched to `*` when next to a word char, nested in emphasis, or strong-with-word; strong is always `**`; GFM delete is `~~` (mdast.js).
- Thematic break `---`; `***` when it is the very first root node (so it is not read as front matter) and when alternating inside lists (mdast.js).
- Headings: style is preserved, not converted — setext headings are re-emitted with the original `=`/`-` underline; ATX as `#`*depth + space ([print/heading.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/heading.js)).
- Code fences: backticks; fence length `max(3, longest backtick run + 1)`; info string preserved; fenced value only line-ending-normalized unless embedded formatting applies ([print/code.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/code.js)).
- Inline code: smallest backtick run not present in the content; a padding space is added when content starts/ends with a backtick or with space+non-space; newlines become spaces unless `proseWrap: preserve`; `|` is escaped inside table cells (mdast.js).
- Links/references: inline links normalized to `[text](url "title")`, empty URL printed `<>`; pure autolinks preserved `<url>`; full/collapsed/shortcut reference kinds preserved; reference labels escape `[`, `]`, `\`; URLs get backslash/entity escaping and `<...>` wrapping when required (`printUrl`).
- Tables: cells padded to per-column max width; `:` alignment markers; with `proseWrap: never` a compact table is used only when it exceeds print width ([print/table.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/table.js)).
- Front matter: only `---` (default YAML) and `+++` (default TOML); optional explicit language after the delimiter; YAML may end at `...`; body is formatted by Prettier's yaml/toml printers; **JSON front matter is not recognized**; delimiters preserved ([parse.js](https://github.com/prettier/prettier/blob/main/src/main/front-matter/parse.js), [embed.js](https://github.com/prettier/prettier/blob/main/src/main/front-matter/embed.js)).
- Blank lines: exactly one blank line between blocks; multiple blanks collapse; tight/loose list spacing is preserved from the AST (`spread`); consecutive list items and definitions are not separated by a blank line; HTML edges special-cased ([print/children.js](https://github.com/prettier/prettier/blob/main/src/language-markdown/print/children.js)).
- Escaping/safety: entity escapes (`\&`), URL escaping, label escaping, title quoting; `prettier-ignore` / `prettier-ignore-start|end` supported. Prettier states it changes only formatting ([Option Philosophy](https://prettier.io/docs/option-philosophy)); mdformat's FAQ disputes markdown AST preservation ([mdformat FAQ](https://github.com/hukkin/mdformat#why-not-use-prettier-instead)).

**Third-party prettier-* plugins that change Markdown output**
- [prettier-plugin-markdown-html](https://www.npmjs.com/package/prettier-plugin-markdown-html) — formats raw HTML embedded in Markdown with the HTML parser.
- [prettier-plugin-md-nocjsp](https://www.npmjs.com/package/prettier-plugin-md-nocjsp) — prevents Prettier inserting spaces between CJK and Latin letters.
- [prettier-markdown-table](https://www.npmjs.com/package/prettier-markdown-table) — formats Markdown tables.
- [prettier-plugin-embed](https://www.npmjs.com/package/prettier-plugin-embed) — embedded-language formatting for js/ts, not markdown-specific.
- No plugin is required for core md/MDX; other popular plugins (tailwind, imports, xml, etc.) do not affect Markdown.

## 2. dprint-plugin-markdown

Config lives under the `"markdown"` key. Full option list and defaults from [resolve_config.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/resolve_config.rs), [types.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/types.rs), [builder.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/builder.rs); rendered table at [dprint docs](https://dprint.dev/plugins/markdown/config/).

| Option | Default | Values / meaning |
|---|---|---|
| `lineWidth` | 80 (global fallback) | max line width |
| `newLineKind` | `lf` | `auto`/`crlf`/`lf`/`system` |
| `textWrap` | `maintain` | `always`, `maintain` (keep breaks), `maintainAndWrap` (keep breaks but break long lines), `never`, `sentence` (one sentence per line) |
| `wrapUnspacedScripts` | false | break inside CJK-style unspaced scripts when wrapping |
| `wrapCodeSpans` | true | allow a line break inside a code span |
| `emphasisKind` | `underscores` | `asterisks` / `underscores` |
| `strongKind` | `asterisks` | `asterisks` / `underscores` |
| `hardBreakKind` | `backslash` | `backslash` / `doubleSpace` |
| `maxBlankLines` | 1 (min 1) | max consecutive blank lines kept between blocks |
| `heading.kind` (old `headingKind`) | `atx` | `atx` / `setext` (setext only for levels 1-2) |
| `heading.blankLinesAbove` | unset | fixed blank lines above headings (min 1); unset keeps written blanks up to `maxBlankLines` |
| `list.unorderedMarker` (old `unorderedListKind`) | `dashes` | `dashes` / `asterisks` (other char is used as alternator) |
| `list.indentKind` (old `listIndentKind`) | `commonMark` | `commonMark` (align to marker width) / `pythonMarkdown` (fixed >=4 spaces) |
| `codeBlock.skipFormat` | false | leave fenced code content untouched |
| `codeBlock.raiseSyntaxErrors` | false | fail file if a code-block formatter errors |
| `codeBlock.preserveIndentation` | false | keep code indentation instead of unindenting |
| `codeBlock.preserveBlankLines` | false | keep leading/trailing blank lines in a fence |
| `codeBlock.useTabs` | unset | override the code formatter's `useTabs` |
| `codeBlock.indentWidth` | unset | override the code formatter's `indentWidth` |
| `html.skipFormat` | false | leave inline/block HTML layout untouched |
| `html.useTabs` | false (global) | indent HTML with tabs |
| `html.indentWidth` | 2 (global) | HTML indent width |
| `html.selfClosingSpace` | true | `<br />` vs `<br/>` |
| `html.preferSingleLine` | false | collapse multi-line HTML that fits |
| `table.skipFormat` | false | do not align tables |
| `table.cellPadding` | `align` | `align` / `space` / `none` |
| `ignoreDirective` | "dprint-ignore" | line ignore directive |
| `ignoreFileDirective` | "dprint-ignore-file" | file ignore directive |
| `ignoreStartDirective` | "dprint-ignore-start" | range start |
| `ignoreEndDirective` | "dprint-ignore-end" | range end |
| `tags` | {} | custom tag -> file-extension map for code-block formatting |

Notes:
- Deprecated key renames: `headingKind`->`heading.kind`, `unorderedListKind`->`list.unorderedMarker`, `listIndentKind`->`list.indentKind` ([resolve_config.rs](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/configuration/resolve_config.rs)).
- There is **no `reflow`/`reflowText` option** in current dprint-plugin-markdown; wrapping is `textWrap` + `wrapCodeSpans` + `wrapUnspacedScripts`.
- `deno: true` preset sets `textWrap: always` and the `deno-fmt-ignore*` directives (builder.rs).
- Ordered lists are **renumbered**: sequential from the first item's start number; a list whose first two markers are 1s stays all `1.`; if the count would exceed 999,999,999 the written numbers are kept. Marker `. ` primary, `)` alternator for consecutive lists ([generate.rs gen_list](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/generation/generate.rs)).
- Unordered: `-` primary, `*` alternate; guards against 3 bullets reading as a thematic break.
- Front matter: `---` YAML body is passed to the code-block formatter registry for `"yaml"` (formatted only if a YAML plugin such as pretty_yaml is present), otherwise kept raw; `+++` (TOML) is always kept raw; delimiters preserved ([gen_metadata_block](https://github.com/dprint/dprint-plugin-markdown/blob/main/src/generation/generate.rs)).
- Code fences: backtick by default, tilde if the info string contains a backtick; fence length exceeds the longest run of the fence char in the content; leading/trailing whitespace trimmed and code unindented unless `codeBlock.preserve*`; indented code after a list becomes fenced (generate.rs).
- Escaping: paragraph line-start escapes keep text from becoming blocks; `escape_title` escapes `"` and backslashes (generate.rs).

## 3. mdformat (Python) and plugins

Docs: [style](https://mdformat.readthedocs.io/en/stable/users/style.html), [plugins](https://mdformat.readthedocs.io/en/stable/users/plugins.html), [config file](https://mdformat.readthedocs.io/en/stable/users/configuration_file.html), [README/CLI](https://github.com/hukkin/mdformat).

- CLI/options: `--check`, `--no-validate`, `--number` (default false), `--wrap {keep,no,INTEGER}` (default `keep`), `--end-of-line {lf,crlf,keep}` (default `lf`), `--exclude` (3.13+), `--extensions/--no-extensions` (default: all installed), `--codeformatters/--no-codeformatters`. `.mdformat.toml` mirrors: `wrap`, `number`, `end_of_line`, `validate`, `extensions`, `codeformatters`, `exclude`.
- Plugin mechanism (entry points, per [contributing](https://github.com/hukkin/mdformat/blob/master/docs/contributors/contributing.md)): `mdformat.parser_extension` for parser/renderer extensions implementing `mdformat.plugins.ParserExtensionInterface` (built on markdown-it-py); `mdformat.codeformatter` for `Callable[[str, str], str]` code-block formatters. Installed plugins are enabled by default; per-plugin options live under `[plugin.<name>]`.
- Style (pure CommonMark by default): ATX only (setext -> ATX); bullet `-`, alternating `-`/`*` for consecutive lists; ordered lists use `1.`/`1)` for every item ("non-numbering", minimal diff) unless `--number`, with `.`/`)` alternating across consecutive ordered lists; fenced code only (indented code -> fenced); code spans reduce to minimal backtick run and strip needless padding; inline link angle brackets removed; all link reference definitions moved to the document bottom, sorted by label, unused/duplicate removed; thematic breaks become 70 underscores; single EOL, single empty line between blocks (tight lists: single newline), single trailing newline; hard breaks are a backslash.
- Front matter: only via the `frontmatter` extension ([mdformat-frontmatter](https://github.com/butler54/mdformat-frontmatter)); **YAML only**, must be at the first line(s); formats YAML front matter. No TOML/JSON.
- Parser-extension plugins: [mdformat-frontmatter](https://github.com/butler54/mdformat-frontmatter) (YAML front matter); [mdformat-gfm](https://github.com/hukkin/mdformat-gfm) (`gfm` and `tables`; GFM tables, task lists, strikethrough, autolinks; adds `--compact-tables` / `[plugin.tables] compact_tables`); [mdformat-tables](https://github.com/executablebooks/mdformat-tables) (moved into mdformat-gfm; aligns tables, e.g. `| a | b |` -> padded); [mdformat-footnote](https://github.com/executablebooks/mdformat-footnote) (Pandoc-style footnotes); `mdformat-deflist` (Pandoc definition lists); [mdformat-mkdocs](https://github.com/KyleKing/mdformat-mkdocs) (MkDocs; 4-space list indent); `mdformat-toc` (auto TOC generation); `mdformat-myst`, `mdformat-admon`, `mdformat-gfm-alerts`, `mdformat-simple-breaks` (3-dash breaks), `mdformat-pyproject`.
- Code-block formatter plugins: `mdformat-black`/*-ruff` (python), `mdformat-shfmt`/*-beautysh`, `mdformat-gofmt`, `mdformat-rustfmt`, `mdformat-web` (js/css/html/xml), `mdformat-config` (json/toml/yaml).
- Safety: `validate` compares the rendered HTML before/after and refuses to write if the AST changed; stated goal is "only change style, not content", with minimal-diff rationale (all-1 numbering, sorted definitions).

## 4. remark / remark-stringify / remark-lint

**remark-stringify options** (defaults from [readme](https://github.com/remarkjs/remark/blob/main/packages/remark-stringify/readme.md)):
`bullet` `'*'`; `bulletOther` opposite of bullet; `bulletOrdered` `'.'`; `closeAtx` false; `emphasis` `'*'`; `fence` ``'`'``; `fences` true; `incrementListMarker` true; `listItemIndent` `'one'` (also `'mixed'`, `'tab'`); `quote` `'"'`; `resourceLink` false; `rule` `'*'`; `ruleRepetition` 3; `ruleSpaces` false; `setext` false; `strong` `'*'`; `tightDefinitions` false; plus `handlers`, `join`, `unsafe` (escape schemas). GFM table serialization options come from remark-gfm: `tableCellPadding`, `tablePipeAlign`, `tablePipes`.
- Serialization always uses one blank line between blocks unless a `join`/tight-list case says otherwise; `tightDefinitions` joins definitions without a blank line.
- Front matter is preserved (not formatted) by `remark-frontmatter` (YAML/TOML/etc.).
- remark-lint does not itself rewrite text; each fixable rule documents the equivalent `remark-stringify`/`remark-gfm` option, and re-serializing the AST produces the fix.

**remark-lint rules with fix guidance** (Fix section; 31 rules). What each changes:
- `checkbox-character-style`: checked `[x]`, unchecked `[ ]`.
- `checkbox-content-indent`: single space after checkbox.
- `code-block-style`: fenced code (or indented via `fences: false`).
- `directive-quote-style` / `mdx-jsx-quote-style`: attribute quote style (double by default; `quote`).
- `emphasis-marker`: `*` (or `emphasis: '_'`).
- `fenced-code-marker`: backticks (or `fence: '~'`).
- `final-newline`: adds final newline.
- `heading-style`: ATX (or `setext: true` / `closeAtx: true`).
- `linebreak-style`: Unix line endings.
- `link-title-style`: double quotes (or `quote: "'"`).
- `list-item-bullet-indent`: removes item indent.
- `list-item-content-indent`: aligns item content.
- `list-item-indent`: `listItemIndent: 'one'` (also `'mixed'`/`'tab'`).
- `no-blockquote-without-marker`: adds `>` to every block-quote line.
- `no-consecutive-blank-lines`: exactly one blank line between blocks (`join` for complex cases).
- `no-heading-content-indent`: one space after `#`.
- `no-heading-indent`: removes heading indent.
- `no-literal-urls`: converts to regular autolinks/full links.
- `no-missing-blank-lines`: blank lines between blocks.
- `no-table-indentation`: unindents tables.
- `no-tabs`: spaces only.
- `ordered-list-marker-style`: `.` (or `bulletOrdered: ')'`).
- `ordered-list-marker-value`: keeps first value, increments (or `incrementListMarker: false`).
- `rule-style`: `***` (`rule`/`ruleRepetition`/`ruleSpaces`).
- `strikethrough-marker`: two tildes.
- `strong-marker`: `*` (or `strong: '_'`).
- `table-cell-padding` / `table-pipe-alignment` / `table-pipes`: padded cells / aligned pipes / leading+trailing pipes.
- `unordered-list-marker-style`: `*` (or `bullet: '+'|'-'`).
Non-fixable examples (no Fix section): `blockquote-indentation`, `definition-sort`, `fenced-code-flag`, `file-extension`, `heading-increment`, `list-item-spacing`, `maximum-line-length`, `no-duplicate-headings`, `no-emphasis-as-heading`, `no-html`, `no-shell-dollars`, `no-undefined-references`, `no-unused-definitions`, `no-shortcut-reference-link/image`, and the file-name/heading-punctuation rules.

## 5. markdownlint (CLI + VSCode)

Fix machinery: rules that can fix set a `fixInfo` property; the library exposes `applyFix`/`applyFixes`; `markdownlint-cli --fix` "fix basic issues (does not work with STDIN)" and notes not all issues are fixable ([CLI README](https://github.com/igorshubovych/markdownlint-cli), [lib README §Fixing](https://github.com/DavidAnson/markdownlint)). VSCode extension: quick fix (lightbulb), `markdownlint.fixAll` command, register-as-formatter, and format-on-save via `editor.codeActionsOnSave: { "source.fixAll.markdownlint": "explicit" }` ([VSCode README](https://github.com/DavidAnson/vscode-markdownlint)). Rule list/defaults: [doc/Rules.md](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md); fix actions read from [lib/md*.mjs](https://github.com/DavidAnson/markdownlint/tree/main/lib).

**Auto-fixable rules and exactly what the fix does** (fix actions from source):
| Rule | Name | Fix action |
|---|---|---|
| MD004 | ul-style | replace the unordered marker with the configured style marker |
| MD005 | list-indent | add/remove spaces so same-level list items align |
| MD007 | ul-indent | add/remove spaces to reach configured unordered indent (default 2) |
| MD009 | no-trailing-spaces | delete trailing spaces (except allowed hard-break spaces) |
| MD010 | no-hard-tabs | replace each tab with spaces |
| MD011 | no-reversed-links | rewrite `(url)[text]` to `[text](url)` |
| MD012 | no-multiple-blanks | delete blank lines beyond the configured maximum (default 1) |
| MD014 | commands-show-output | delete the `$` prompt |
| MD018 | no-missing-space-atx | insert one space after the hash |
| MD019 | no-multiple-space-atx | delete extra spaces after the opening hash |
| MD020 | no-missing-space-closed-atx | rewrite closed ATX heading with one space inside both hash runs |
| MD021 | no-multiple-space-closed-atx | delete extra spaces inside closed ATX hashes |
| MD022 | blanks-around-headings | insert blank line(s) above/below headings (`lines_above/below` default 1; `include_front_matter` false) |
| MD023 | heading-start-left | delete leading indentation before a heading |
| MD026 | no-trailing-punctuation | delete trailing punctuation in headings |
| MD027 | no-multiple-space-blockquote | delete extra spaces after `>` |
| MD029 | ol-prefix | rewrite ordered-list prefixes to the configured style: `one_or_ordered` (default), `one`, `ordered`, `zero`; preserves right-alignment and zero-padding |
| MD030 | list-marker-space | set spaces after list markers (`ul_single/ol_single/ul_multi/ol_multi`, all default 1) |
| MD031 | blanks-around-fences | insert blank line above/below fenced code (respects blockquote prefix) |
| MD032 | blanks-around-lists | insert blank line above/below lists |
| MD034 | no-bare-urls | wrap a bare URL in `<...>` |
| MD037 | no-space-in-emphasis | delete spaces just inside emphasis markers |
| MD038 | no-space-in-code | delete spaces just inside code-span backticks |
| MD039 | no-space-in-links | delete spaces just inside link text |
| MD044 | proper-names | replace wrong capitalization with the configured proper name (`names`) |
| MD047 | single-trailing-newline | insert a final newline |
| MD049 | emphasis-style | replace emphasis marker with configured style (`consistent` default) |
| MD050 | strong-style | replace strong marker with configured style (`consistent` default) |
| MD051 | link-fragments | fix a link fragment to the correct case |
| MD053 | link-image-reference-definitions | delete the unused reference-definition line |
| MD054 | link-image-style | convert link/image to the configured inline/autolink/full/shortcut style |
| MD058 | blanks-around-tables | insert blank line above/below tables |
| MD060 | table-column-style | add/remove spaces around table pipes per style (`tight`/`compact`) |
Not fixable (no `fixInfo`): MD001, MD003, MD013, MD024, MD025, MD028, MD033, MD035, MD036, MD040, MD041, MD042, MD043, MD045, MD046, MD048, MD052, MD055, MD056, MD059. (Notably MD003 heading-style and MD046/MD048 code-style/fence-style are report-only.)
- Front matter: MD001 uses `front_matter_title` (default `^\s*title\s*[:=]`) to treat a front-matter title as a level-1 heading; MD022 has `include_front_matter`; markdownlint does not format front matter.
- Blank-line policy: MD012 max 1 consecutive blank; MD022 blank(s) around headings (default 1 each side); MD031 around fences; MD032 around lists; MD047 single trailing newline.
- VSCode extension's documented fixable list omits MD029 and MD060, although the library marks them fixable.

## 6. deno fmt, markdownfmt, mdsf, and others

**deno fmt** — wraps [dprint-plugin-markdown](https://github.com/dprint/dprint-plugin-markdown) ([deno fmt docs](https://docs.deno.com/runtime/reference/cli/fmt/), [deno_json](https://docs.deno.com/runtime/reference/deno_json/#formatting), [fmt.rs](https://github.com/denoland/deno/blob/main/cli/tools/fmt.rs)).
- md extensions: .md, .mkd, .mkdn, .mdwn, .mdown, .markdown.
- `"fmt"` keys relevant to markdown: `lineWidth` default 80; `proseWrap` default `always` (`always`/`never`/`preserve` -> dprint `textWrap: always/never/maintain`); `newLineKind` default `lf`; plus `useTabs`/`indentWidth` (global). No deno option for emphasis/strong/bullet/heading kinds.
- Code blocks inside Markdown are formatted with the registered dprint code-block plugins; ignore directives are `<!-- deno-fmt-ignore -->`, `<!-- deno-fmt-ignore-start/end -->`, `<!-- deno-fmt-ignore-file -->`.
- .editorconfig fills unset options (highest precedence: CLI flags, deno.json, .editorconfig, defaults).

**markdownfmt (Go)** — [shurcooL/markdownfmt](https://github.com/shurcooL/markdownfmt), "Like gofmt, but for Markdown"; blackfriday-based renderer ([markdown/main.go](https://github.com/shurcooL/markdownfmt/blob/master/markdown/main.go)).
- Flags only `-d` (diff), `-l` (list), `-w` (write); no config/style options.
- Output style: level-1/2 headings as setext (`=`/`-` underline), level >=3 ATX; unordered marker `-`; ordered lists renumbered from 1 (`1.`, `2.`, ...); horizontal rule `---`; tables aligned.
- No front matter support (README says pure Markdown only; points to `mdfmt` fork, `tidy-markdown`, `Flowmark`). It renders through an AST to markdown, so it is not a minimal-diff/semantic-preserving formatter.

**mdsf** — [hougesen/mdsf](https://github.com/hougesen/mdsf): formats and lints only the code inside markdown fenced code blocks via external tools (does not reformat markdown prose/structure).
- Config `mdsf.json|toml|yaml`; `languages` maps language -> tool(s) with alternatives/lists; `language_aliases`; `newline` `lf`/`cr`/`crlf` (default lf); custom tools via `binary/arguments/stdin`; `format`/`verify` commands, `--cache`, `--on-missing-language-definition`, `--on-missing-tool-binary`. ~349 tools. Not a package manager; only installed tools are used.

**cbfmt** — [lukas-reineke/cbfmt](https://github.com/lukas-reineke/cbfmt): formats codeblocks inside markdown, org and reStructuredText using per-language commands; config `.cbfmt.toml` `[languages]`; ignores non-code markdown. Like mdsf, it does not normalize markdown itself.

**tidy-markdown** — [slang800/tidy-markdown](https://github.com/slang800/tidy-markdown): beautifies Markdown and converts basic HTML/Unicode to Markdown equivalents (based on Carrot Creative's styleguide, built on Marked); CLI over STDIN/STDOUT.

Other notable: `Panache` (dprint plugin for Quarto/Pandoc/Markdown, listed at [dprint plugins](https://dprint.dev/plugins/panache/)); `mdfmt` (markdownfmt fork adding front matter); `Flowmark` (YAML frontmatter, line wrapping); `remark-toc` / `mdformat-toc` for TOC generation.

## 7. VSCode "Markdown All in One"

Source: [README](https://github.com/yzhang-gh/vscode-markdown), [src/tableFormatter.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/tableFormatter.ts), [src/listEditing.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/listEditing.ts), [src/print.ts](https://github.com/yzhang-gh/vscode-markdown/blob/master/src/print.ts), package.json.

Formatting-like features:
- Table of contents: Create/Update commands; auto-updated on save (`markdown.extension.toc.updateOnSave` default true); configurable levels, slugify mode, per-file indent, omission markers `<!-- omit from toc -->` / `<!-- no toc -->`.
- Section numbering add/update/remove.
- List editing on Enter/Tab/Backspace; toggle list markers through `- * + 1. 1)` (`list.toggle.candidate-markers`); ordered-list markers auto-fixed as you edit (`orderedList.autoRenumber` default true); indentation adaptive by CommonMark or fixed via `list.indentationSize`.
- GFM table formatter: registers `DocumentFormattingEditProvider` and `DocumentRangeFormattingEditProvider` for markdown, but `provideDocumentFormattingEdits` only detects and formats GFM tables (`tableFormatter.enabled` default true; `tableFormatter.normalizeIndentation`).
- Toggle bold (`bold.indicator` default `**`), italic (`italic.indicator` default `*`), inline code, strikethrough, math, heading level; task-list check/uncheck.
- Print to HTML commands; optional `markdown.extension.print.onFileSave`.
- Completions (paths, anchors), KaTeX macros, GFM strikethrough/task lists.

Format-on-save behavior:
- Because it registers a markdown document formatter, VS Code `Format Document` / `editor.formatOnSave` will run it — but it only reformats tables, not a full-document normalizer.
- TOC auto-update runs on save through its own `onDidSaveTextDocument` listener (default on).
- Ordered-list auto-renumber and list editing run on edit, not save.
- Optional print-to-HTML runs on save, default off.

## Cross-tool summary
| | Front matter | Blank-line policy | Ordered lists | Bullets / indent | Prose wrap | Fenced content |
|---|---|---|---|---|---|---|
| Prettier | YAML `---`, TOML `+++` formatted; JSON no | one blank between blocks; tight/loose preserved | start preserved then sequential; all-1s stay 1s | `-` / `*`; tabWidth-based | option | formatted if parser known, else untouched |
| dprint | YAML formatted only if yaml plugin, else raw; TOML raw | `maxBlankLines` 1 | renumbered from start; all-1s stay 1s | `-` / `*`; commonMark or 4-space | `textWrap` | formatted by plugins |
| mdformat | YAML only via plugin | one blank between blocks; tight lists newline | all `1.` unless `--number` | `-` / `*`; 2-space | `--wrap` | code formatter plugins |
| remark | preserved (remark-frontmatter) | one blank (join/tight controls) | increment by default | `*` default; listItemIndent one | no wrap | handlers/GMF |
| markdownlint | read via params, not formatted | MD012/MD022/MD031/MD032/MD047 | MD029 style | MD004/MD007/MD030 | MD013 only checks | not touched |
| deno fmt | same as dprint | same as dprint | same as dprint | same as dprint | `proseWrap` always default | formatted by plugins |
| markdownfmt | none | gofmt-ish | renumber from 1 | `-` | none | render-based |
| mdsf/cbfmt | untouched | untouched | untouched | untouched | untouched | external tools |

Every claim above is drawn from the linked primary docs/source; no behavior was inferred from blog posts.
