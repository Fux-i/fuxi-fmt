# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-09-28

The formatter is now useful on real Chinese technical writing: it normalises
block structure, renumbers lists, spaces CJK correctly, and refuses to hand
back anything it cannot prove is semantically unchanged.

### Added

- **CJK typography** (TYPO-01, TYPO-02, TYPO-03, TYPO-07, TYPO-09). One space is
  inserted at a CJK to non-CJK boundary and nowhere else, which resolves the
  cases the reference implementations disagree about without a per-unit
  exception list: `第 1 章`, `50% 中文`, `15%` and `10GB` all fall out of the
  same rule. Compound names such as `GPT-4o`, `state-of-the-art` and
  `60公里/小时` survive intact with no exclusion list either.
- **Ordered list renumbering** (BLK-06) at every nesting level, honouring a
  declared start and preserving the author's lazy all-ones style.
- **Semantic-preservation guard** (GRT-01, GRT-04). Protected regions must be
  byte-identical and line kinds unchanged, with one documented exception for
  the BLK-05 heading promotion. On failure the input is returned untouched.
- `typography.cjkSpacing`, `list.orderedStyle` and `list.orderedDelimiter`
  options.

### Changed

- The punctuation symbol whitelist drops `/`, `|` and `*`: the reference
  implementations keep `/` tight, and `|` and `*` are Markdown syntax in tables
  and emphasis.

### Fixed

- Whitespace collapsing is confined to the CJK boundary and no longer risks
  affecting runs of Latin or CJK-only text.

## [0.1.0] - 2026-09-28

First milestone.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01). Front matter, fenced
  and indented code, HTML blocks and comments, inline code and math spans, URLs
  and link destinations, wikilinks, and MDX/shortcode markup are identified
  before any rule runs and copied byte-for-byte.
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
  List tightness is preserved by construction, because a separator is only ever
  inserted between blocks.
- **Marker spacing** for headings, list items, task checkboxes and blockquotes
  (BLK-04, BLK-05, BLK-09).
- Test infrastructure on Node's built-in runner, no test dependencies.

### Notes

- BLK-05 does not promote `#123` to a heading; that is an issue reference, not a
  spacing mistake.

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.2.0...HEAD
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
