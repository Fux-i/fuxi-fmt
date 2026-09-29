# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

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
