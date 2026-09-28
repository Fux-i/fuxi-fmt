# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.4.0] - 2026-09-28

The structural rule set is complete apart from list reindentation. What remains
before the core is usable is configuration loading and the adapters.

### Added

- **Unordered marker normalisation** (BLK-07):
  `list.unorderedMarker: dashes | asterisks | preserve`. Thematic breaks and
  emphasis are excluded by consulting the block classifier rather than by
  pattern matching, so `* * *` and `*emphasis*` are never mistaken for lists.
- **Code fence delimiter normalisation** (BLK-10):
  `codeBlock.fenceChar: backticks | tildes | preserve` and
  `codeBlock.normalizeLength`. Only the fence character and its length move;
  indentation, the spacing before the info string and the info string itself
  stay byte-for-byte.

### Changed

- The semantic guard now identifies a fence region by its info string and body
  rather than by the entire region text, because changing the delimiter is the
  one sanctioned edit inside a protected region. A rewritten info string is
  still rejected.

### Fixed

- A test asserted that an entire fence delimiter line was frozen. The
  specification only ever promised that the character and length may change;
  the test now pins the info string and indentation with the character held
  fixed, which is what SAFE-02 actually claims.

## [0.3.0] - 2026-09-28

### Added

- **Punctuation width** (TYPO-05), all three directions, decided by immediate
  adjacency, so `1,000`, `2.5` and `e.g.` need no exclusion list.
- **Character width** (TYPO-06). Full-width alphanumerics and U+3000.
- **File hygiene** (BLK-11). BOM, line endings, hard tabs, trailing whitespace.

### Fixed

- The scanner measures indentation in columns, expanding tabs to four-column
  stops as CommonMark does.

## [0.2.0] - 2026-09-28

### Added

- **CJK typography** (TYPO-01, TYPO-02, TYPO-03, TYPO-07, TYPO-09). One space at
  a CJK boundary and nowhere else.
- **Ordered list renumbering** (BLK-06) at every nesting level.
- **Semantic-preservation guard** (GRT-01, GRT-04). On failure the input is
  returned untouched rather than corrupted.

## [0.1.0] - 2026-09-28

First milestone.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01).
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
- **Marker spacing** (BLK-04, BLK-05, BLK-09).
- Test infrastructure on Node's built-in runner, no test dependencies.

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.4.0...HEAD
[0.4.0]: https://example.invalid/fuxi-fmt/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
