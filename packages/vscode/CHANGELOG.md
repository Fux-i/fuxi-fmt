# Changelog

Notable changes to the VS Code extension. The full history, with the reasoning behind each
change, is in the [repository changelog](https://github.com/Fux-i/fuxi-fmt/blob/main/CHANGELOG.md).

## 0.22.0

- `list.indentWidth` now also sets the indent width that list reindentation targets, as a floor
  under the parent's content column. Default behaviour is unchanged.

## 0.21.0

- **List reindentation.** A nested item's marker moves under its parent's content column. A list
  containing a code block is excluded entirely. This was the last behavioural rule outstanding.
- Every rule in the specification is now implemented.

## 0.20.0

- 18% faster on a 10,000-line document: one protected-region mask shared by the three width
  passes, and no ignore-directive scan when a document has no directives.

## 0.19.0

- The CLI and the extension now share one line-aligned diff instead of each approximating it.
- **Fixed:** formatting a *selection* silently did nothing when a document had changed at both
  ends, because the single wide edit lay outside the selection and was discarded.

## 0.18.0

- `<!-- fuxi-fmt-ignore -->` leaves the next block as written. All four ignore directives now work.

## 0.17.0

- `<!-- fuxi-fmt-ignore-start -->` and `<!-- fuxi-fmt-ignore-end -->` leave a range as written.

## 0.16.0

- `<!-- fuxi-fmt-ignore-file -->` returns a document byte for byte.

## 0.15.0 and earlier

See the [repository changelog](https://github.com/Fux-i/fuxi-fmt/blob/main/CHANGELOG.md).
