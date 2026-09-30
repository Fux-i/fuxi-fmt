# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

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

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.7.0...HEAD
[0.7.0]: https://example.invalid/fuxi-fmt/compare/v0.6.0...v0.7.0
[0.6.0]: https://example.invalid/fuxi-fmt/compare/v0.5.0...v0.6.0
[0.5.0]: https://example.invalid/fuxi-fmt/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.invalid/fuxi-fmt/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
