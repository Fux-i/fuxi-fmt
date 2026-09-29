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

**Alpha.** Every behavioural rule in the specification is implemented except list
reindentation, and every option it names.

There is deliberately no test count here. It read 173, then 254, then 315 — accurate each time it
was written, wrong within a few releases, and not something a reader can act on. Run `npm test`.

Implemented: SAFE-01–SAFE-06, FM-01, BLK-01–BLK-07, BLK-09–BLK-11,
TYPO-01–TYPO-09, GRT-01–GRT-04, GRT-06, CFG-01, CFG-04, the CLI and the VS Code
extension.

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

Also outstanding: in-document ignore directives (CFG-03), list reindentation (BLK-08),
and loading the extension in a real editor.

The normative behavioural contract is [FUXI-FMT-SPEC.md](FUXI-FMT-SPEC.md) — read that
first. The prior-art survey is
[MAINSTREAM_MD_FORMATTERS_REPORT.md](MAINSTREAM_MD_FORMATTERS_REPORT.md).

An `origin` remote is configured (`git@github.com:Fux-i/fuxi-fmt.git`) but nothing has
been pushed. Releases are tagged locally and do not exist upstream.

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
npm ci               # install exact dependencies from the lockfile, as CI does
npm test             # run the test suite
npm run test:watch   # watch mode
npm run typecheck    # tsc -p for each package
npm run ci           # typecheck + tests, what CI runs
npm run build        # bundle the VS Code extension
```

## Repository layout

```
packages/
  core/              adapter-free formatting engine (no VS Code imports, ever)
  cli/               fuxi-fmt --check --diff --write
  vscode/            extension: providers, minimal edits, esbuild bundle
FUXI-FMT-SPEC.md     normative behavioural contract
MAINSTREAM_MD_FORMATTERS_REPORT.md
                     prior-art survey, with primary sources
.bench/              benchmark harness (see Appendix B of the spec)
```

The CLI and the extension are thin adapters over `@fuxi-fmt/core`, which never imports from
either. `AGENTS.md` holds contributor and agent guidance, but a global gitignore in this
environment excludes it, so a fresh clone will not contain it.

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
| **In-document ignore directives (CFG-03)** | **Not implemented.** All four — `ignore.file`, `ignore.start`, `ignore.end`, `ignore.line` — are documented in the specification and do nothing. The most consequential gap here: an author who hits a false positive has no escape hatch short of switching the formatter off. |
| **Nine documented options** | **Not implemented.** `blankLines.insideLists`, `blankLines.insideBlockquotes`, `typography.collapseBoundarySpaces`, `typography.symbolWhitelist`, `frontMatter.enabled`, and the four ignore directives. Setting any of them produces silence. |
| **Extension host** | The bundle runs against a stubbed `vscode` module in tests. It has never been loaded by a real editor. |
| **Real documents** | Everything is verified against generated fixtures, a synthetic article, and this repository's own Markdown. The formatter has never seen a real Chinese technical article. |

**Not implemented at all:** `blankLines.insideLists`, `blankLines.insideBlockquotes`,
`typography.collapseBoundarySpaces`, `typography.symbolWhitelist`, `frontMatter.enabled`,
`ignore.line`. The specification declares the
same set, and a test asserts the two lists agree.

The table is the handoff. It has drifted before — it listed `typography.semicolon` and
config presets as unimplemented more than a release after each shipped — which is why the
specification's own status note is checked by a test. The two "not implemented at all"
lists are now checked against each other as well. The table's prose is still unverified; its
claims about what is missing are not.

**BLK-08: an approach already tried and disproven.** Deriving nesting depth from a
stack of *observed* indents does not work. For any list whose first item is already indented —
a fragment, a continuation, a list nested under something the segmenter did not classify as a
list — that first indent becomes depth 0 and the item is silently **dedented**, changing document
structure. Three existing tests caught it (`  - nested` becoming `- nested`). Any correct
implementation needs the absolute nesting baseline for a list before it reindents anything, which
is a block-parsing question rather than a stack question. Do not re-attempt the stack version.

**CFG-03 range directive: the design is settled, the work is not.** Add an `ignore.ts`
exporting `commentBody(line)`, `ignoreRanges(source, options)` and a per-line form for the
structural pass. The ranges run from the start directive to the end directive inclusive, and an
unterminated start runs to the end of the document. Then wire it in the three places that already
know how to handle a protected region:

1. `format()` — mark the ignored lines protected, exactly as atomic ranges already do, so the
   structural pass leaves them verbatim.
2. `normalizeFullwidthAlphanumerics`, `normalizePunctuation` and `normalizeParens` — **these run
   before typography** and each masks itself through `protectedMask`, so each needs the ranges
   too. An attempt that skipped them left `中文abc,中文` inside a range rewritten with a full-width
   comma: the two passes that read the text first were the two that were forgotten.
3. `applyTypography(text, options, extra?)` and `trimTrailingWhitespace(text, extra?)` — OR the
   ranges into the masks they already build.

That is **five wiring points, not three**. Recompute the ranges before *each* pass from that
pass's own input, not once from the source: every pass can change a length before the next runs,
and the ignored regions stay verbatim, so the directives remain findable each time.

Move the existing `hasIgnoreFile` out of `format.ts` into the same module, and add `start` and
`end` to `IgnoreOptions`. The specification's and this file's "not implemented at all" lists
must change in the same commit: the cross-document check fails otherwise, because both options
would then exist in the defaults.

This is four files and roughly eight edits. It was attempted nowhere and deferred five times;
the cost is not the design, it is a change of that size needing more room than one sitting has
had available.

Two things are worth doing before adding any of the above:

1. **Run it on a real article.** If the spacing, punctuation or parenthesis rules disagree with
   how you actually write, the remaining feature list is the wrong thing to work on.
2. **Load the extension in a real VS Code.** The stub proves the code path runs; only the editor
   proves the manifest, activation events and trust declaration are right.

## License

MIT. See [LICENSE](LICENSE).
