# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

### Added

- **BLK-13: a thematic break is written with the character you choose.** `---`, `***` and `___` are
  the same node, and so are `-----` and `* * *`, so `thematicBreak` (default `dashes`) normalises
  every break to exactly three of the chosen character, and `preserve` leaves both the character and
  the run length alone. Two positions keep what the author wrote, because there the character decides
  what the line *is*: three dashes under a paragraph is a setext heading underline, and three dashes
  on line 1 above a YAML key open front matter. Fixing the first of those turned up a real bug — this
  formatter used to insert a blank line between a paragraph and the `---` under it, quietly turning an
  H2 into a paragraph and a horizontal rule — and the guard could not see it, because both lines keep
  the same block kind. A break inside a block quote is normalised too, marker chain included.

- **TYPO-12: emphasis uses the delimiter you choose.** `**x**` and `__x__` are the same node, `*x*`
  and `_x_` are the same node, and one tilde is strikethrough in the dialects that accept it as well
  as two, so `typography.emphasis` chooses the spelling of each and `preserve` (the default) leaves
  every delimiter as written. Only a pair CommonMark would pair is respelled — `snake_case_name` and
  `中文_斜体_中文` contain no emphasis to respell — and the target is tested the same way, so
  `中文**加粗**中文` is left alone rather than turned into `__` marks that would not be emphasis at all.
  Runs of three delimiters are left alone; telling `***x***` apart from a run of three is a parser's
  job.

- **TBL-01: tables can be aligned, and the width cap skips a line rather than the table.** `table.mode`
  (default `preserve`) pads every cell to its column's display width and fills the delimiter row to
  match, keeping the alignment the colons declare and never inventing one. `table.cjkWidth` (default
  `2`) is how many columns a wide character occupies in *your* font — two is the fixed-pitch
  convention, not a law, which is why it is a setting rather than an assumption. `table.maxWidth`
  leaves a row that would exceed it byte-identical and recomputes the widths from the rows that
  remain, so a few long rows cannot stretch the rest; nothing is reported, because with a cap set
  that is what was asked for. Wrapping a cell is not on the table at all: a GFM row is one line.
  DET-10 now also reports a delimiter row that declares a different number of columns from its
  header, and both the rule and the detection understand tables written without outer pipes.

- **BLK-14: a block quote is a prefix, not a wall.** What is inside a quote is a document like any
  other, and the rules now act on it as one: a quoted list is reindented to the canonical width
  (a quoted item used to not be an item at all, so BLK-08 never saw one), a quoted list and a
  top-level list are two lists even when they share a marker, and the table, thematic-break and
  emphasis rules all reach inside. This builds on the protection fix in this release, which is what
  made the interiors safe to touch. Two supporting changes came with it: the semantic guard compares
  a quoted line by its *content*, so a nested list flattened inside a quote is a violation rather
  than an invisible kind-preserving edit, and a bare `>` counts as the blank line it renders as, so
  a rule may add or remove one without the non-blank line count objecting. The blank-line policy still
  stands down inside quotes, for the reason recorded in section 7 item 0.

### Changed

- **The settings are findable by the product name.** Searching the Settings UI for `fuxi 标记` used to
  find nothing while `标记` alone found the settings, because VS Code matches every word of a query
  inside one field: the setting id answers `fuxi`, the description answers `标记`, and a query of both
  is never satisfied by the two together. Every setting now carries
  `keywords: ["fuxi", "fuxi-fmt"]`, a searchable field of its own that is never shown to the user.
  A per-setting `title` cannot do this — VS Code's settings model does not read one.

### Removed

- **The benchmark harness (`.bench/`) is no longer in the tree.** Appendix B of the specification keeps
  the method and section 1.3 keeps its numbers, both now marked as measurements taken at the time
  rather than results this project re-runs; the harness itself stays in the history if they need
  re-deriving. Nothing referenced it but those two documents — no script, no test, no workflow — and a
  generated 372 KB fixture, two scripts and a Rust crate is a lot of tree for that.

### Fixed

- **A list item, a heading or any nested marker that starts with full-width punctuation is no longer
  refused.** TYPO-07 deletes the space beside full-width punctuation, and at a block marker that
  space is the syntax: `- “引用”` is a list item and `-“引用”` is a paragraph that happens to start
  with a hyphen. The formatter made the second out of the first and then refused the file, naming the
  line and reporting that the list item had come back a paragraph. Inside a blockquote the same edit
  drew no complaint at all: `> - “引用”` came back as `> -“引用”`, the inner list flattened, and the
  guard — which compares line kinds, and both lines are a blockquote — had nothing to compare. The
  space a marker is separated by is now treated as syntax rather than spacing, so it is kept (one
  space, where the author wrote a run) and the rest of the line is formatted as before; prose is
  unaffected, and `中文 ，“引用”` still becomes `中文，“引用”`.

- **A nested list inside a block quote is no longer flattened.** BLK-09 collapsed every space after
  `>` to one, and inside a quote those spaces are the content's indentation: `> - a` followed by
  `>   - b` is a child item, and it came back as a sibling — silently, because every quoted line is
  the same block kind and the guard compares kinds. The same spaces are what makes an indented code
  block inside a quote code. The rule now owns exactly one space after the marker chain: it inserts a
  missing one, and the content keeps the indentation the author wrote.

- **A fenced code block, a display math block or an HTML block inside a block quote is now protected,
  and an unterminated one refuses the document.** The scanner looked for block markers at the start of
  the line and never past a `>`, so a quoted fence was not a region at all: its body was spaced like
  prose - a code body was edited - and the report named an unmatched backtick instead of the fence
  that never closed. Quoted regions are now found by peeling the marker chain, and the markers stay
  inside the region, byte-verbatim. A quote also ends where CommonMark says it does, so a quoted
  fence with a blank line in it is unterminated (DET-01) rather than swallowing the next quote. In
  the same change: BLK-01 no longer inserts a blank line between two quoted blocks, because an empty
  line ends the quote and the guard cannot see an *empty* line in its non-blank count.

## [0.26.0] - 2026-10-04

### Added

- **Diagnostics are Chinese when the editor's display language is Chinese.** The sentences come from
  one catalogue in the core and are rendered through `vscode.l10n` against a bundle generated from
  that catalogue, so the editor and the command line share one set of sentences instead of drifting
  apart; the CLI is unchanged for now. Values keep their place —
  `表格这一行有 3 个单元格，而表头有 2 个` — and rule ids, configuration key names and JSON
  payloads stay Latin in every language, because those are what the documentation, the spec and
  `--explain` are keyed on. The two warnings about a stray delimiter also say how to write one:
  escape it with a backslash, so a backtick becomes a backslash and a backtick, and a dollar sign
  becomes a backslash and a dollar sign. English is the fallback when no bundle is loaded, which is
  what VS Code reports in the default language.

- **The command line takes `--lang zh`**, falling back to `LC_ALL` and `LANG` when nothing is asked
  for. The sentences come from the same catalogue as the editor's, so there is one set of them; the
  default is English because a CI log is read by more than the person who wrote it, and a language
  with no translation falls back to English rather than to a key.

### Changed

- **The editor's output panel logs one block per document instead of one line per diagnostic.** A
  run is a header naming the file and the time it started, then one line per diagnosis:
  `=====docs/guide.md 16:20:01=====` followed by `WARNING[12] DET-06 …` and, for a refused
  document, `ERROR DET-02 …`. The file is relative to the workspace folder, the path is no longer
  repeated on every line, and a clean document writes nothing at all — the old format printed an
  absolute path per line with nothing to tell one run from the next, which is what made it hard to
  read. The severity words and rule ids stay Latin so one search finds a rule in either log. The CLI
  is unchanged: it still prints `path:line: severity: RULE message`, which is what a compiler log is
  read for.

## [0.25.0] - 2026-10-04

### Added

- **Detection: the formatter now says when it had to guess.** fuxi-fmt protects a region by parsing
  the document, and a parse that goes wrong in a way the parse cannot see left the author with a
  formatter that quietly did less than they asked. Four rules ship here. An unterminated code
  fence (**DET-01**), front matter that opens and never closes (**DET-02**), an HTML comment with
  no closing marker (**DET-03**) and a display-math block that never closes (**DET-04**) are
  **errors**: everything
  after the mistake was read as part of it, so the document is refused whole — input returned
  unchanged, exit 2 from the CLI, no edits in the editor — and the refusal names the line. An
  unclosed fence is legal CommonMark, so this is a deliberate over-reaction in favour of being told;
  the alternative is the silent half-formatting that this project's own reports describe twice.
- **Seven warnings for a parse that terminated but is doubtful** (DET-06 … DET-12): an unmatched
  backtick, an unmatched dollar sign, an unclosed wikilink or link destination, a table row whose
  cell count disagrees with its header, a list item indented as if nested that belongs to no parent,
  and a list left alone because it contains a protected block. They format the document and say so.
  In the editor each has its own switch, because DET-07 cannot tell a price from an unclosed formula
  and DET-06 fires on a deliberate literal backtick. **DET-12** has been promised by section 7 item 1
  since the first draft — `list-scan.ts` even carried a comment saying the caller reports it — and
  no code ever emitted it.

- **One switch per warning rule in the editor** (`fuxiFmt.diagnostics.*`, all on by default). A
  warning that cannot be turned off is a warning that gets the whole feature turned off. Errors have
  no switch, because a refused document is refused for a reason, and the CLI still prints every
  diagnostic — a build log that omits what the editor would show makes the two disagree.

### Changed

- **A diagnostic says where the problem is, in the file the author has.** The line was carried as
  data *and* written into the message, so anything printing both printed it twice in two different
  bases; and it was counted in the text the formatter had already inserted blank lines into, so a
  document whose heading gained a blank line had its unpaired quote reported one line too low and
  the editor drew the squiggle on the blank. The line is now data only, mapped back to the input
  through the blank-line policy's own record of what it invented, and `undefined` when the
  complaint is about the document as a whole — every guard refusal used to point at line 1.
- **The CLI prints one machine-readable line per diagnostic**: `path:line: severity: RULE message`,
  the shape an editor, a CI log and a human can all read. The `fuxi-fmt:` prefix is gone; the path
  identifies the file and the summary line names the tool.

### Fixed

- **A list containing a code block is no longer refused.** The blank-line policy inserted a blank
  line after the closing fence, and a deeply indented item following a blank line is an indented code
  block — so the tidied document parsed differently from the written one and the guard refused it
  with `protected region count changed: 1 -> 2`. Four lines were enough: a list item, a fenced code
  block under it, and an over-indented item after the block. A list containing a protected block is
  now left alone by the blank-line policy as well as by the indentation plan, and DET-12 says why.
- **A code span whose content is a backslash never closed.** Escapes do not work inside a code
  span, so the closing backtick of a span containing a backslash is a delimiter even though a
  backslash precedes it. The scanner skipped it as escaped and left the span open across the rest of
  the document, shifting the pairing of every backtick after it; one occurrence in the prior-art
  report surfaced as a single unmatched backtick forty lines later. Two authoring bugs in that
  report were found by the new rules while writing them.
- **An escaped pipe in a table row is content.** The cell counter split on every pipe, so a row
  containing an escaped pipe looked like it had an extra column.
- **Unterminated front matter is protected instead of reformatted.** The scanner only claimed
  front matter when it found the closing delimiter, so `---` followed by YAML and no closing line
  was a thematic break followed by prose: `title: 我的,笔记` came out as `title: 我的，笔记`, and
  the metadata a static site generator reads was no longer the file the author wrote. FM-02 has
  promised the opposite since the first draft. The block is now claimed and **DET-02** refuses the
  document; a `---` whose first non-blank line is not a YAML key is still a thematic break, so a
  horizontal rule at the top of a file is not turned into a false alarm.
- **Display math is protected, which it never was.** The inline matcher claimed the two `$$`
  markers as separate spans and left the body in prose, so a display-math block containing
  `f(x), 中文(零)` came out as `f(x)，中文（零）` — LaTeX does not survive that, and the
  README has claimed since its first draft that math is a protected region. A `$$` line now
  delimits a protected region (SAFE-03) and is formatted nowhere.
- **Guard violations name the lines they are about.** A changed region reports its own line, and a
  changed non-blank line count reports the last line the two documents still agreed on — the line
  that went missing — instead of an index into the non-blank-filtered array, which was not a line
  in the file at all.
- `--explain` counted every diagnostic as a warning. Only warnings are warnings.

## [0.24.0] - 2026-10-02

### Added

- **A byte-exact fixture corpus, which the repository has claimed to have since its first draft.**
  `packages/core/test/fixtures/corpus/` holds two documents: the author's own stress file — the one
  this round's reports came from — and a zoo containing every one of the ten protected region kinds
  the scanner knows. Each is compared byte for byte, checked for idempotence, and checked for
  protection by comparing the regions themselves rather than trusting the golden file. A test fails
  if any region kind is uncovered, so the corpus cannot quietly stop being a corpus (GRT-01, GRT-02).
  Building it immediately paid for itself: it showed that the list-indent bug below was still
  unfixed after four rounds of believing otherwise.

### Fixed

- **An item that falls out of a list is dedented to the level it actually occupies.** `1. 333` with
  `   - yes` under it and `  - ok` written shallower than both used to come out untouched: the item
  was correctly read as belonging to no parent, and every parentless item kept the offset it was
  written with. That policy exists so an already-indented *fragment* is not snapped to column 0, and
  it was being applied to a different situation. Falling out means closing an item shallower than
  itself — closing a sibling is ordinary structure — and the two are now told apart, so the snippet
  becomes the tree it already had: `- ok` at column 0 and its children under it (BLK-08).

### Changed

- **Punctuation and parenthesis width now share one rule, and the default is the whole line
  rather than the character next to the mark.** New `typography.context: "line" | "adjacent"`,
  default `line`. `这就是**自信**(confidence)的体现` kept half-width parentheses because the
  character before `(` was `*`, while the identical sentence without the asterisks converted —
  each rule answered the same question its own way and each got a different case wrong.
  Two bounds keep the wider rule honest. A quoted span is its own scope, so an English sentence
  inside Chinese quotation marks keeps English punctuation, and the rule stays idempotent once
  those quotes are curly. A mark written tight against a Latin letter or digit belongs to that
  word, which is what keeps `1,000`, `3.14`, `10:30`, `e.g.` and `foo(bar)` intact with no
  exception list for any of them. CJK directly beside a mark still wins, so `abc,中文` converts.
  Spaces no longer hide a mark either: `中文 , 后面` becomes `中文，后面`. Parentheses read only
  the character outside the pair, never the bracketed term, so `English(中文)English` keeps
  half-width parens while `中文(English)文` does not. `adjacent` is the narrower rule for anyone
  who wants it, and now looks through emphasis markers as well (TYPO-05, TYPO-08).
- **Straight double quotes become paired Chinese quotation marks.** New
  `typography.quotes: "paired" | "preserve"`, default `paired`. `这就是"自信"的体现` becomes
  `这就是“自信”的体现`, and `他说 "hello, world" 这句话` becomes `他说“hello, world”这句话` — the
  quotation is a context scope, so the English sentence inside keeps its own comma. Only the
  double quote is converted; the apostrophe is never touched, because `don't` cannot be told from
  an opening single quote without guessing. Pairing is per paragraph and all-or-nothing: a
  paragraph with an odd number of straight quotes is left exactly as written and reported once, as
  a warning naming the line, which does not stop the format from succeeding. The paragraph rather
  than the line, because a quotation may wrap across a line break. An inch mark is not a quotation:
  `12" x 8"` is untouched (TYPO-11).
- **Two options are renamed, and the old names keep working for one release.**
  `codeBlock.normalizeLength` becomes `codeBlock.fenceLength`, because it controls the number of
  delimiter characters and nothing else. The old name read as "tidy the block up", which is a
  different job on different bytes, and the user duly reported that it seems not to work. A name
  that invites that reading is a defect in the name. `typography.symbolWhitelist` becomes
  `typography.spacingSymbols`, which says what the set is for rather than what it is. Setting either
  old name still works and produces a notice until the next release (CFG-07).
- **The editor now says what happened.** Diagnostics from the core become editor diagnostics at their line — a squiggle and a Problems entry — and a configuration notice or warning is written to a `Fuxi Fmt` output channel, which is revealed only when something was refused or warned about. Until now the adapter computed diagnostics and threw them away, so a refused document simply did not format and nothing explained it. Related: the adapter used to withhold the edits for *any* diagnostic, so the first warning this tool produced would have stopped the editor formatting any document containing an unpaired quote; only an error withholds them now (CFG-06).
- **A retired option name is now reported instead of silently ignored.** Every name this project
  has retired is still read for one release, and the configuration reader says which old name it saw
  and what it became: `symbolWhitelist`, `punctuationAllowlist`, `normalizeLength`, plus three whose
  shape changed — `blankLines.insideLists` (boolean → three-way), `typography.semicolon` (folded
  into the change list) and `list.indentWidth` (split into two indents). A key that is not an option
  at all is reported too, while still being ignored so a newer configuration loads. This is the
  failure mode the round started from: a config file that quietly does less than its author asked
  for (CFG-07).
- **New `codeBlock.trimBlankLines`, default on.** Blank lines at the start and end of a fenced
  code block are removed; blank lines inside it are kept, because those are code. This is what
  `normalizeLength` was expected to do and never did. It is the only rule in the tool that changes
  protected bytes, so it is declared as BLK-12 in the specification and named in the guard where
  the guarantee is checked - and the exception is granted only while the option is on (BLK-12).
### Fixed

- **Three documents claimed shipped work was unfinished, and the check that should have caught it
  could only read one kind of sentence.** The specification's comparison table listed four
  unimplemented options when two had shipped and one had been withdrawn; the readme carried a 25-line
  build plan for `symbolWhitelist` describing work that had already landed, and named in-document
  ignore directives and list reindentation as outstanding. The same fact was written down in four
  places and checked in one. The duplicates are gone — each document now points at the authoritative
  status note instead of restating it — and the readme check reads rule IDs as well as option names,
  which is the form the two oldest of those claims were written in (GRT-04).
- **A closing fence indented more than three columns past the opener no longer suppresses
  formatting for the whole document.** The scanner never accepted such a line as a closer and
  left the block unterminated, but the fence normalizer rewrote it anyway. That changed protected
  bytes, which trips SAFE-01, and a guard failure refuses the entire document — so one malformed
  fence silently left every block *before* it unformatted. With a blank line after the same line
  there was no rewrite and no diagnostic at all: the same input, two outcomes, neither of them
  intended. The normalizer now applies the scanner's own indentation test (BLK-10, SAFE-01).
- **Ordered lists inside a blockquote are renumbered.** The list grammar anchors at the start of the
  line, so `> 1. a` matched nothing and a broken sequence in a quote kept its wrong numbers
  forever. The blockquote prefix is now split off, matched against and put back, and the prefix is
  part of the list's identity: each quote depth is its own list, a quoted paragraph ends the list
  above it, and a heading in a quote ends it as well. A bare `>` is treated as the blank line it
  is (BLK-06).

## [0.23.0] - 2026-09-30

### Changed

- **BREAKING: `blankLines.insideLists` is now `remove` | `one` | `preserve` and defaults
  to `remove`.** It was a boolean that could only ever insert a blank, so a tight list could be
  made loose but never the reverse; and a blank between list items decides how the list renders,
  which is not a thing to leave half-controlled. `remove` collapses a loose list to tight, `one`
  expands a tight list to loose, and `preserve` leaves the author's spacing alone. It applies only
  between items of the same list — a blank between different markers separates two lists, and
  merging them would change the document (BLK-03).
- **`typography.punctuationAllowlist` became `typography.punctuationChangeList`**, and `;` is
  now in it by default. `typography.semicolon` is deleted: it could only ever append `;` to the list,
  so once `;` is a default it does nothing, and two controls for one decision is one too many. The
  list is still the escape hatch — remove `;` from it to keep semicolons half-width (TYPO-05).
- **`list.indentWidth` became `list.orderedIndent` and `list.unorderedIndent`.** The old name
  described neither of the two jobs the option was doing. Each is `aligned` (the default) or an
  explicit width; `aligned` puts a nested item's marker at its parent's content column, and an
  explicit width is a floor that can widen nesting but never break it (BLK-08).
- **`list.tabWidth`** carries the hard-tab expansion the old option also did. It is settable from
  `fuxi-fmt.json` but is not a fuxi-fmt setting: VS Code's own `editor.tabSize` governs it there.
- **`list.orderedStyle` offers three behaviours instead of two.** `renumber` numbers sequentially
  from the declared start; `keep-all-ones` — the new default, and what `increment` used to do —
  leaves a list the author wrote as all ones alone; `preserve` changes no number at all. `lazy-one`
  is gone: forcing every item to 1 is not something anyone chose. `increment` is now
  `keep-all-ones`, so the default behaves exactly as before (BLK-06).
- **Parenthesis width now follows the surrounding text, not the contents.** `中文（English）文` was
  being rewritten to `中文(English)文`, because the rule read only what sat between the parens. A
  pair now takes the width of the text before its opening parenthesis, and both parens of a pair take
  that one decision. `English（中文）English` narrows symmetrically as a result (TYPO-08).

### Fixed

- **An ellipsis is no longer turned into a full stop and two stray dots.** `等等...` became
  `等等。..`, because the rule converted any allowlisted mark with a CJK neighbour on either side
  and the first dot of an ellipsis follows CJK. A `.` now converts only when it stands alone - no dot
  on either side - and follows CJK. `1.5`, `a.b` and `e.g.` are untouched, and `中文.后面还有字`
  still converts to `中文。后面还有字` (TYPO-05).
- **`ignore.*` and `typography.symbolWhitelist` could not be set in a `fuxi-fmt.json`.**
  `readSections` had no branch for either, and `mergeOptions` dropped `ignore` outright - so the
  editor's own settings layer lost it too, at the merge step. Four directive names and one symbol
  list worked only when `format()` was called directly with an input object, which is to say in
  tests and not for anyone using the CLI or the extension.

### Added

- **Simplified Chinese for every setting description**, and for the extension's own description in
  the Marketplace. VS Code localises a package through `package.nls.json` and
  `package.nls.zh-cn.json`; the manifest now references `%keys%` instead of literal English. A test
  asserts that both locales define every referenced string, that neither defines an unused one, and
  that the Chinese strings contain Chinese — without which a translation drifts behind silently and
  the Settings panel shows a raw `%key%`.
- **Every option is now a VS Code setting.** `fuxiFmt.typography.cjkSpacing` and the rest — 24 in
  all — appear in the Settings UI with their defaults, their enums and the specification rule each
  one implements. They sit in a layer **below** the project `fuxi-fmt.json`, so a personal
  preference fills in what a project does not state without making the editor disagree with
  `fuxi-fmt --check`. `fuxiFmt.config` keeps its existing behaviour as an explicit override above
  the file. See "Settings" in the readme for the full precedence.

### Changed

- **The VS Code extension is publishable.** It gained an icon, a Marketplace listing README, a
  changelog and a licence, plus the manifest fields the Marketplace requires. `npm run vsix`
  packages it reproducibly.

### Removed

- **`blankLines.insideBlockquotes` withdrawn.** A blank line inside a blockquote is a `>` line, a
  `>` line is non-blank, and GRT-01 refuses any change to the non-blank line count - so the only
  mechanism that could implement the option is the one the semantic guard forbids. The guard was
  kept and the option withdrawn. Setting it has never done anything.

### Added

- **`typography.symbolWhitelist`**: which characters CJK spacing treats as word-like is now
  configurable. The default set is unchanged, so nothing moves unless it is set.

## [0.22.0] - 2026-09-28

Making an option honest rather than adding a feature.

### Changed

- **`list.indentWidth`** now also sets the minimum indent width that list reindentation targets,
  as a floor under the parent's content column. Default behaviour is unchanged: at width 2 the
  content column always wins, so a long ordered marker like `10. ` still keeps its own column.

### Notes

- Three documented options remain unimplemented: `blankLines.insideLists`,
  `blankLines.insideBlockquotes` and `typography.symbolWhitelist`.

## [0.21.0] - 2026-09-28

The last behavioural rule in the specification. Every rule it states is now implemented, and every
configuration directive works.

### Added

- **BLK-08 list reindentation.** A nested list item's marker moves under its parent's content
  column, computed top-down so the result settles in one pass. An item with no parent keeps the
  offset it was written at, so a fragment is never snapped to column zero. A list containing a
  protected block is excluded entirely (spec section 7 item 1, option b).

### Notes

- Five documented options remain unimplemented, all in the specification's implementation-status
  note and the readme's remaining-work table, which a test keeps in agreement.

## [0.20.0] - 2026-09-28

Two measured performance changes rather than features. Between them they recover 18% of format
time on a 9,996-line document, and both were found by profiling rather than by guessing.

### Changed

- One protected-region mask is shared by `normalizeFullwidthAlphanumerics`,
  `normalizePunctuation` and `normalizeParens`, which each rewrite one character
  for one character so offsets never move. **11.8%** faster on a 9,996-line,
  1164 KB document. The property it depends on is pinned by a test written before
  the change existed.
- A document containing no ignore directives no longer scans itself five times per
  format to discover that. **7%** on the same document.

## [0.19.0] - 2026-09-28

### Added

- **`diffEdits`** in `@fuxi-fmt/core`: minimal character-range edits between two documents,
  aligned line by line and returned in ascending non-overlapping order, with `applyEdits` so the
  round trip is testable.

### Changed

- The CLI's `--diff` and the extension's edit computation now share that one alignment
  (`core/diff.ts`) instead of each approximating it separately. Two implementations of one
  question is how they drift apart.
- `--diff` resynchronises line by line rather than reporting every line after an insertion as
  rewritten and re-added.
- The adapter tightens each changed region to the characters that actually differ, so a document
  edited in several places yields several small edits rather than one wide one. This also fixes
  "format selection" silently doing nothing when a document had changed at both ends: one wide
  edit lay outside the selection and `editsInRange` discarded it.

## [0.18.0] - 2026-09-28

CFG-03 is complete. An author can now say *not this file*, *not this range*, *not this line* -
and the last is the one that matters, because a false positive is usually one paragraph rather
than a whole document or a range marked out in advance.

### Added

- **`ignore.line`**, the last of the four directives. A comment whose body is
  `fuxi-fmt-ignore` leaves the next block as written: the following non-blank
  lines, ending at the first blank one.

### Changed

- `ignoreRanges` is derived from `ignoreLines` rather than scanning separately,
  so the two views of the same decision cannot disagree.

## [0.17.0] - 2026-09-28

The escape hatch is now usable where it matters. A false positive is usually local, and until
this release the only way to suppress one was to switch the formatter off for the whole file.

### Added

- **`ignore.start` and `ignore.end`** (CFG-03, two more of four). Lines between the
  directives are copied verbatim: no reindentation, no renumbering, no punctuation
  or width conversion, no CJK spacing, no trailing-whitespace trimming. An
  unterminated range runs to the end of the document, because an ignore should
  fail safe.

### Notes

- Three of the four directives now work. `ignore.line`, the next-block form, is
  the range directive with a computed end and is declared missing in both the
  specification and the README.

## [0.16.0] - 2026-09-28

### Added

- **`ignore.file`** (CFG-03, first of four directives). A document whose body is
  nothing but `fuxi-fmt-ignore-file` in an HTML comment is returned byte for
  byte, byte order mark and line endings included. The directive must be the
  entire comment body, or the specification - which documents the directive -
  would opt itself out. The name is configurable.

### Notes

- `ignore.start`, `ignore.end` and `ignore.line` remain unimplemented and are
  declared as such in both the specification and the README, which a test keeps
  in agreement.

## [0.15.0] - 2026-09-28

Closes CFG-01: a configuration file with per-directory discovery, a preset
layer, and editor settings as the override above it.

### Added

- **`fuxiFmt.config`** in VS Code settings, merged over the project's
  `fuxi-fmt.json`. Editor settings win, so a personal preference does not
  require editing a committed file.

### Fixed

- The extension host test built the bundle only when the bundle was missing, so
  it could run against a stale build and silently verify the previous revision.
  It now rebuilds every run. The first attempt at this release's feature
  appeared to do nothing because of it.

## [0.14.0] - 2026-09-28

### Added

- **Configuration presets** (CFG-01): `preset` in `fuxi-fmt.json`, resolved
  *below* the project's own settings so a preset supplies values and anything
  stated explicitly wins. `default` and `strict-commonmark` ship;
  `strict-commonmark` switches off every rule that rewrites an author's choice
  and keeps CJK spacing, which is the point of the tool rather than an opinion.
- An unknown preset is rejected with the list of known names, rather than
  silently ignored.

### Removed

- The `zhihu`, `hugo`, `vitepress` and `obsidian` presets named in an early
  draft of the specification. Their intended behaviour was never defined, and a
  preset called `hugo` that does not match what a Hugo author expects is worse
  than no preset. They can return when their meaning is decided.

### Fixed

- All four manifests declared `0.1.0` while thirteen releases had been tagged.
  They now track the newest tag, enforced by a test.

## [0.13.0] - 2026-09-28

Every typography option named in the specification is now implemented. The
"not implemented at all" list in the specification is empty for the first time.

### Added

- **`typography.cjkClasses`**, defaulting to Han alone. Kana, Hangul, Bopomofo
  and enclosed CJK can be opted into. Opt-in rather than guessed at: enabling
  kana turns `テレビabc` from untouched into `テレビ abc`, which is right for
  Japanese and wrong for a Chinese article quoting a Japanese product name.

### Notes

- The documentation check failed on this change before the specification was
  updated, exactly as intended: the option now exists in the defaults, so
  leaving it in the "not implemented" list would have shipped a false claim.
  Second time the check has caught a stale document.

## [0.12.0] - 2026-09-28

### Added

- **`typography.semicolon`** (TYPO-05), off by default. AutoCorrect excludes the
  semicolon from its conversion set deliberately, annotating the decision
  "danger": in prose it separates list items and a wrong full-width semicolon is
  hard to spot. The escape hatch is now available for authors who want it.

### Notes

- The documentation test added in 0.11.0 covers this change. Removing
  `typography.semicolon` from the specification's "not implemented at all" list
  was not optional: had it been missed, the check would have failed, because the
  option is now present in the defaults. That is the check doing its job on the
  first change to touch it.

## [0.11.0] - 2026-09-28

### Added

- **Parenthesis width** (TYPO-08): `typography.parenStyle: mixed | fullwidth |
  halfwidth | preserve`, defaulting to `mixed` — full-width `（）` around Han,
  half-width `()` around Latin or digits. Deliberately conservative: a pair
  spanning a line break, touching a protected region, or containing another
  opener is left exactly as written rather than guessed at, because a wrong
  parenthesis is worse than a wide one.

### Fixed

- The specification still listed `typography.hashtag` as unimplemented, three
  releases after it shipped.

## [0.10.0] - 2026-09-28

### Added

- **Opt-in hashtag spacing** (TYPO-09): `typography.hashtag`, off by default
  because `中文#标签` becoming `中文 # 标签` breaks the tag wherever it is
  published.

## [0.9.0] - 2026-09-28

### Fixed

- **Inline code spans were paired across blank lines.** A single unmatched
  backtick in prose found a partner paragraphs later and invented a span
  covering half the file, after which the semantic guard refused to format the
  document at all. CommonMark forbids a code span from containing a blank line.
  Found by formatting this repository's own documentation.

## [0.8.0] - 2026-09-28

### Added

- **VS Code activation entry.** Registers a document formatter and a range
  formatter for Markdown. The range provider matters: Format Selection has no
  fallback to the document formatter, so without it `Ctrl+K Ctrl+F` silently
  does nothing.
- **Extension build**: `npm run build` bundles the extension and the inlined core
  into `packages/vscode/dist/extension.cjs` with esbuild.
- `offsetToPosition`, tested separately from the editor API.

### Notes

- Loading the bundle in a real extension host has **not** been verified. There
  is no VS Code instance here. What is verified: the bundle parses
  (`node --check`), it contains both provider registrations, and the core is
  inlined. Treat the extension as buildable but unproven until someone installs
  it.

## [0.7.0] - 2026-09-28

### Added

- **Minimal edit computation** (GRT-06) in `packages/vscode`. The core returns a
  whole document; the adapter reduces it to the smallest differing character
  range, so a format-on-save does not force the editor to re-diff, re-tokenise
  and re-analyse the entire file.
- `editsInRange`, so a selection receives only the edits inside it.
- The extension package manifest, declaring `onLanguage:markdown` activation,
  `untrustedWorkspaces: supported` — which is honest, because the formatter
  executes nothing from the workspace — and the `fuxiFmt.enable` setting.

### Fixed

- **Blockquote normalisation was not idempotent.** `>>nested` became
  `>> nested`, and formatting that again produced `> > nested`, because the
  check for author-spaced markers counted the trailing space after the last
  marker as a separator. Adjacent markers now stay adjacent. Found by the
  adapter's round-trip test; the core's own test only formatted that input once.

### Notes

- The extension cannot be installed yet: there is no activation entry and no
  bundling step. The manifest records the intended shape rather than a finished
  artefact.

## [0.6.0] - 2026-09-28

### Added

- **Command line interface**: `--check`, `--diff`, `--write`, `--help`, with
  exit codes 0 / 1 / 2.

## [0.5.0] - 2026-09-28

### Added

- **Configuration loading** (CFG-01). `fuxi-fmt.json` discovered by walking
  upwards; comments and trailing commas accepted.

## [0.4.0] - 2026-09-28

### Added

- **Unordered marker normalisation** (BLK-07).
- **Code fence delimiter normalisation** (BLK-10).

## [0.3.0] - 2026-09-28

### Added

- **Punctuation width** (TYPO-05), **character width** (TYPO-06), **file hygiene**
  (BLK-11).

## [0.2.0] - 2026-09-28

### Added

- **CJK typography** (TYPO-01, TYPO-02, TYPO-03, TYPO-07, TYPO-09).
- **Ordered list renumbering** (BLK-06).
- **Semantic-preservation guard** (GRT-01, GRT-04).

## [0.1.0] - 2026-09-28

First milestone.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01).
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
- **Marker spacing** (BLK-04, BLK-05, BLK-09).

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.26.0...HEAD
[0.7.0]: https://example.invalid/fuxi-fmt/compare/v0.6.0...v0.7.0
[0.6.0]: https://example.invalid/fuxi-fmt/compare/v0.5.0...v0.6.0
[0.5.0]: https://example.invalid/fuxi-fmt/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.invalid/fuxi-fmt/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
