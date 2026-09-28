# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.5.0] - 2026-09-28

The core is configurable and driveable. What remains is an entry point.

### Added

- **Configuration loading** (CFG-01). `fuxi-fmt.json` is discovered by walking
  upwards from the file being formatted; the nearest one wins. Comments and
  trailing commas are accepted, parsed by a state machine rather than a regex so
  that a string containing `//` is left alone.
- `parseConfig`, `mergeOptions`, `readConfigFile`, `loadOptionsFor` and
  `CONFIG_FILENAME` are exported from the package root.
- Config fixtures under `test/fixtures/config/`.

### Notes

- Unknown keys are ignored so a config written for a later version still loads.
  A known key with an unknown value throws, because silently ignoring a typo
  hides it for the life of the project.
- An integration test asserts that a loaded config actually changes formatter
  output, rather than only that it parses.

## [0.4.0] - 2026-09-28

### Added

- **Unordered marker normalisation** (BLK-07). Thematic breaks and emphasis are
  excluded by consulting the block classifier, not by pattern matching.
- **Code fence delimiter normalisation** (BLK-10). Only the character and length
  move; indentation, spacing and the info string stay byte-for-byte.

### Changed

- The semantic guard identifies a fence by its info string and body rather than
  by the whole region, because changing the delimiter is the one sanctioned edit
  inside a protected region.

## [0.3.0] - 2026-09-28

### Added

- **Punctuation width** (TYPO-05), all three directions, decided by immediate
  adjacency, so `1,000`, `2.5` and `e.g.` need no exclusion list.
- **Character width** (TYPO-06). Full-width alphanumerics and U+3000.
- **File hygiene** (BLK-11). BOM, line endings, hard tabs, trailing whitespace.

## [0.2.0] - 2026-09-28

### Added

- **CJK typography** (TYPO-01, TYPO-02, TYPO-03, TYPO-07, TYPO-09).
- **Ordered list renumbering** (BLK-06) at every nesting level.
- **Semantic-preservation guard** (GRT-01, GRT-04).

## [0.1.0] - 2026-09-28

First milestone.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01).
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
- **Marker spacing** (BLK-04, BLK-05, BLK-09).

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.5.0...HEAD
[0.5.0]: https://example.invalid/fuxi-fmt/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.invalid/fuxi-fmt/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
