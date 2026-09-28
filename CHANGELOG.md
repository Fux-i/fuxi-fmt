# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.3.0] - 2026-09-28

The per-line rule set is complete. What remains before the core is usable is
configuration loading and the adapters.

### Added

- **Punctuation width** (TYPO-05), in all three directions:
  `punctuationStyle: fullwidth | halfwidth | mixed | off`, with a configurable
  allowlist. Adjacency decides, so `1,000`, `2.5` and `e.g.` are untouched
  without an exclusion list.
- **Character width** (TYPO-06). Full-width alphanumerics become half-width and
  U+3000 becomes a normal space, both individually switchable.
- **File hygiene** (BLK-11). Byte order mark, CRLF and lone CR, hard tabs, and
  trailing whitespace. `endOfLine: lf | crlf | auto` and
  `list.indentWidth: 2 | 4 | tab`.
- `protectedMask` and the shared character classification in `chars.ts`.

### Fixed

- The scanner now measures indentation in columns, expanding tabs to four-column
  stops as CommonMark does. A document beginning with a tab is an indented code
  block, not a list; counting tabs as one character got that wrong.

### Notes

- Trailing whitespace is preserved when a line ends in two or more spaces
  followed by a non-blank line, because that is a Markdown hard break.
- `typography.parenStyle`, `cjkClasses`, `hashtag` and `semicolon` are
  specified but not implemented; the specification now says so explicitly.

## [0.2.0] - 2026-09-28

### Added

- **CJK typography** (TYPO-01, TYPO-02, TYPO-03, TYPO-07, TYPO-09). One space is
  inserted at a CJK to non-CJK boundary and nowhere else, which resolves the
  cases the reference implementations disagree about without a per-unit
  exception list: `第 1 章`, `50% 中文`, `15%` and `10GB` all fall out of the
  same rule.
- **Ordered list renumbering** (BLK-06) at every nesting level.
- **Semantic-preservation guard** (GRT-01, GRT-04). On failure the input is
  returned untouched rather than corrupted.

## [0.1.0] - 2026-09-28

First milestone.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01). Front matter, fenced
  and indented code, HTML blocks and comments, inline code and math spans, URLs
  and link destinations, wikilinks, and MDX/shortcode markup are identified
  before any rule runs and copied byte-for-byte.
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
  List tightness is preserved by construction.
- **Marker spacing** (BLK-04, BLK-05, BLK-09).
- Test infrastructure on Node's built-in runner, no test dependencies.

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.3.0...HEAD
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
