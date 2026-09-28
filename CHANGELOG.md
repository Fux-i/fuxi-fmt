# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

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
