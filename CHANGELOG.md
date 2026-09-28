# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are tagged using the Linux kernel convention: `vMAJOR.MINOR[.PATCH]`,
with release candidates suffixed `-rcN`.

## [Unreleased]

Nothing yet.

## [0.6.0] - 2026-09-28

The project runs. `fuxi-fmt --check` is now usable in CI and as a pre-commit hook,
which is the point at which GRT-05 (byte parity between contexts) stops being
untestable.

### Added

- **Command line interface** in `packages/cli`. `--check`, `--diff`, `--write`,
  `--help`, or no option to print the formatted document to stdout.
- Exit codes: 0 clean, 1 would change, 2 error. Errors are reported, never
  thrown at the user.
- Configuration is resolved per file through `loadOptionsFor`, so a monorepo
  with several `fuxi-fmt.json` files behaves sensibly.

### Notes

- `run` takes its file system through an injected `Io` interface, so the check,
  diff and write paths are tested without spawning a process or touching a disk.
- The CLI lives in its own workspace package and imports the core relatively, so
  the core keeps its guarantee of never knowing about any consumer.

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

[Unreleased]: https://example.invalid/fuxi-fmt/compare/v0.6.0...HEAD
[0.6.0]: https://example.invalid/fuxi-fmt/compare/v0.5.0...v0.6.0
[0.5.0]: https://example.invalid/fuxi-fmt/compare/v0.4.0...v0.5.0
[0.4.0]: https://example.invalid/fuxi-fmt/compare/v0.3.0...v0.4.0
[0.3.0]: https://example.invalid/fuxi-fmt/compare/v0.2.0...v0.3.0
[0.2.0]: https://example.invalid/fuxi-fmt/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.invalid/fuxi-fmt/releases/tag/v0.1.0
