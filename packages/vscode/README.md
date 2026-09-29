# fuxi-fmt

<img src="assets/logo.png" alt="A character in a green dinosaur hood holding a formatted document" width="160" align="right" />

**A Markdown formatter for Chinese technical writing.**

VS Code runs exactly one formatter per language per save, so formatters cannot be composed.
Prettier owns block structure but inserts spaces between CJK and Latin and knows nothing about
Chinese punctuation. AutoCorrect owns CJK punctuation but is not a formatting provider and can
never hold `editor.defaultFormatter`. fuxi-fmt is one engine that owns both halves.

## What it does

| | |
|---|---|
| **Blank lines** | Around blocks: exactly one, or at least one. Never inside a list or blockquote unless you ask. |
| **Markers** | One space after `#`, and after every `-`, `*`, `+` and `1.` marker. |
| **Ordered lists** | Renumbered from the declared start, with markers and indentation normalised. |
| **Inline code** | Treated as an English word, so `` `code` `` is spaced when it meets Chinese. |
| **CJK to Latin** | A space at the boundary only. `GPT-4o`, `60公里/小时` and `2.5` are left alone. |
| **Punctuation width** | Decided by what sits next to it, which is why `1,000` and `e.g.` stay half-width. |

## Code is never touched

Fenced code bodies, fence indentation and info strings, front matter, inline code and math, HTML
blocks and comments, MDX and JSX, shortcodes, wikilinks, URLs and link destinations are all
**byte-verbatim**. A rule that touched one of these would be a bug, not a rounding error.

## It never wraps

Chinese has no spaces to break at, so a wrapping printer has to split *between characters*.
fuxi-fmt never joins, splits or reflows a line.

## Install

Search the Marketplace for **fuxi-fmt**, or:

```sh
code --install-extension Fux-i.fuxi-fmt-vscode
```

## Configure

A `fuxi-fmt.json` at the workspace root configures the project. Editor settings override it, so a
personal preference does not require editing a committed file:

```json
{
  "fuxiFmt.enable": true,
  "fuxiFmt.config": { "blankLines": { "aroundBlocks": "atLeast" } }
}
```

Set `fuxiFmt.enable` to `false` to turn the formatter off without uninstalling it.

## When it is wrong about your document

Every rule can be wrong for one paragraph. Three directives say so, and nothing inside them is
touched:

```md
<!-- fuxi-fmt-ignore-file -->

<!-- fuxi-fmt-ignore-start -->
这 一段 保持 原样
<!-- fuxi-fmt-ignore-end -->

<!-- fuxi-fmt-ignore -->
这一块保持原样
```

## Guarantees

- **Minimal edits.** A change produces a small edit range, so format-on-save does not rewrite the
  file and does not disturb the cursor or the undo history.
- **Semantic preservation.** A guard compares the result against the input and refuses to return a
  document that parses differently. If it fires, you get your document back unchanged.
- **Idempotent.** Running it twice changes nothing the second time.
- **No dependencies.** The engine has no runtime dependencies and never imports the VS Code API.

## Links

- [Repository and specification](https://github.com/Fux-i/fuxi-fmt)
- [Full changelog](https://github.com/Fux-i/fuxi-fmt/blob/main/CHANGELOG.md)
- [Issues](https://github.com/Fux-i/fuxi-fmt/issues)

## License

MIT
