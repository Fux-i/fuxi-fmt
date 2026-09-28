# fuxi-fmt

A Markdown formatter for Chinese technical writing.

Existing tools each solve half the problem. Prettier handles block structure but inserts spaces
between CJK and Latin and knows nothing about Chinese punctuation. markdownlint fixes blank
lines and list numbering but has no typography rules, and its MD038 rule does the *opposite* of
spacing around inline code. AutoCorrect handles CJK spacing and punctuation but **is not a
formatting provider at all** — it can never occupy the `editor.defaultFormatter` slot. And
VS Code runs exactly one formatter per language per save, so the pieces cannot be composed.

fuxi-fmt is one engine with one configuration surface that owns both halves.

## Status

**Alpha.** The core engine is feature-complete against the specification for block
structure, blank lines, list numbering, CJK typography, punctuation and character width,
file hygiene, and project configuration. 173 tests.

Implemented: SAFE-01–SAFE-06, FM-01, BLK-01–BLK-07, BLK-09–BLK-11,
TYPO-01–TYPO-03, TYPO-05–TYPO-07, TYPO-09, GRT-01–GRT-04, CFG-01 (config file).

There is now a command line interface:

```sh
node packages/cli/src/main.ts --check docs/   # exit 1 if anything would change
node packages/cli/src/main.ts --diff  docs/   # show the lines that would change
node packages/cli/src/main.ts --write docs/   # rewrite in place
```

The VS Code extension builds: `npm run build` produces `packages/vscode/dist/extension.cjs`
with the core inlined, and the manifest declares `onLanguage:markdown` activation,
`untrustedWorkspaces: supported`, and the `fuxiFmt.enable` setting. Loading it in a real
extension host has not been verified.

Also outstanding: list reindentation (BLK-08) and the `parenStyle`, `cjkClasses`,
`hashtag` and `semicolon` typography options.

The normative behavioural contract is [FUXI-FMT-SPEC.md](FUXI-FMT-SPEC.md) — read that
first. The prior-art survey is
[MAINSTREAM_MD_FORMATTERS_REPORT.md](MAINSTREAM_MD_FORMATTERS_REPORT.md).

Nothing is published. The repository is local-only for now.

## What it will do

- Blank lines around blocks, with a choice of exactly one or at least one
- One space after `#` and after list markers
- Ordered lists renumbered, preserving the author's lazy `1.` style
- CJK ↔ Latin/number spacing, implemented directly rather than delegated to pangu
- CJK punctuation full-width/half-width normalization
- Inline code and inline math treated as a Latin word, contents untouched
- Protected regions that are never modified: fenced code, front matter, HTML, math, MDX,
  shortcodes, wikilinks, URLs
- Every rule individually configurable

## What it will not do

Prose wrapping or line joining, table padding, embedded code formatting, heading-style
conversion, TOC generation, prose linting. See spec section 3 for the full list with rationale.

## Guarantees

The formatter is expected to be, and is tested to be:

1. **Semantics-preserving** — output parses to the same tree as input, except for a documented
   list of intentional differences. Enforced by a parse-equality guard that refuses to write on
   mismatch.
2. **Idempotent** — `format(format(x)) === format(x)`.
3. **Minimal-diff** — formatting a clean file produces zero edits.
4. **Total** — never throws, never corrupts; worst case it reproduces the input unchanged.

## Requirements

- Node.js >= 22.18 (24 LTS recommended). The core needs no runtime dependencies and no build
  step: Node strips TypeScript types natively and ships a test runner.

## Development

```sh
npm install          # dev dependencies only (TypeScript, Node types)
npm test             # run the test suite
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
npm run ci           # typecheck + tests, what CI runs
```

## Repository layout

```
packages/
  core/              adapter-free formatting engine (no VS Code imports, ever)
    src/
    test/fixtures/
FUXI-FMT-SPEC.md     normative behavioural contract
AGENTS.md            contributor and agent guidance
.bench/              benchmark harness (see Appendix B of the spec)
```

The VS Code extension and CLI will be thin adapters over `@fuxi-fmt/core`.

## Design principles

- **The spec is normative.** Rule IDs in the code match rule IDs in `FUXI-FMT-SPEC.md`. If
  code and spec disagree, that is a bug in one of them, not a matter of taste.
- **Protection is the default.** Anything that is not recognised prose is copied byte-for-byte.
  Protection is opt-out, never opt-in.
- **The core knows nothing about VS Code.** Adapters translate; they do not decide.
- **Test first.** Rules are written as failing tests before they are implemented.

## Remaining work

Kept here rather than in a session because it has to survive a fresh clone. The specification
is the authority; this is the shortest accurate summary of the gap.

| Item | State |
|---|---|
| **BLK-08 list reindentation** | Decision recorded in spec section 7 item 1 (option b: a list containing a protected block is excluded). **Not implemented.** `list.indentWidth` today only controls hard-tab expansion. This is the last unimplemented structural rule. |
| **`typography.cjkClasses`** | Not implemented. Would make the CJK character class configurable, so kana, Hangul and Bopomofo could opt in. |
| **`typography.semicolon`** | Not implemented. Converts `;` to `；` beside CJK; excluded from the default allowlist because AutoCorrect excludes it deliberately, annotating the decision "danger". |
| **Config presets** | Not implemented. `fuxi-fmt.json` names a `preset` in the specification; the key is currently ignored. |
| **Extension host** | The bundle runs against a stubbed `vscode` module in tests. It has never been loaded by a real editor. |
| **Real documents** | Everything is verified against generated fixtures, a synthetic article, and this repository's own Markdown. The formatter has never seen a real Chinese technical article. |

Two things are worth doing before adding any of the above:

1. **Run it on a real article.** If the spacing, punctuation or parenthesis rules disagree with
   how you actually write, the remaining feature list is the wrong thing to work on.
2. **Load the extension in a real VS Code.** The stub proves the code path runs; only the editor
   proves the manifest, activation events and trust declaration are right.

## License

MIT. See [LICENSE](LICENSE).
