# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-09-28

First milestone. The formatter now has a working pipeline and the complete
structural half of the specification. The CJK typography half is not
implemented yet.

### Added

- **Protected-region scanner** (SAFE-01 – SAFE-06, FM-01). Front matter, fenced
  and indented code, HTML blocks and comments, inline code and math spans, URLs
  and link destinations, wikilinks, and MDX/shortcode markup are identified
  before any rule runs and copied byte-for-byte. Fence info strings and
  delimiter indentation are recorded verbatim so they survive unchanged.
- **Block segmentation** with a blank-line policy (BLK-01, BLK-02, BLK-03).
  `blankLines.aroundBlocks` selects exactly one or at least one blank line;
  `blankLines.maxConsecutive` caps runs. List tightness is preserved by
  construction, because a separator is only ever inserted between blocks.
- **Marker spacing** for headings, list items, task checkboxes and blockquotes
  (BLK-04, BLK-05, BLK-09).
- **Test infrastructure**: 49 tests on Node's built-in runner, no test
  dependencies.

### Notes

- BLK-05 does not promote `#123` to a heading; that is an issue reference, not a
  spacing mistake. The specification records the refinement.

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.1.0...HEAD
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
