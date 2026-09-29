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

**Alpha.** Every behavioural rule in the specification is implemented, and every configuration
directive works. Four documented options do not, and are listed under Remaining work rather than
left for a reader to discover by setting one.

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

`--diff` resynchronises line by line. The alignment lives in `core/diff.ts` and the CLI
formats its result. It is greedy rather than LCS or Myers, so a document full of repeated lines
can still mis-align, and `--help` calls the output approximate for that reason.

The adapter computes its edits from the same alignment, tightening each region to the characters
that actually differ so that inserting one space does not replace a whole line. That tightening
is what makes a document edited in several places yield several small edits rather than one wide
one, and it matters for range formatting: a single document-wide edit lies outside any selection,
so `editsInRange` would discard it and "format selection" would silently do nothing.

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

### Verifying a change without lying to yourself

**Never pipe a verification command.** `npm run typecheck | tail -4` reports *tail's* exit status,
so a typecheck failure scrolls past and `set -e` never fires. Redirect and test the real status:

```sh
npm run typecheck > /tmp/tc.log 2>&1 || { tail -8 /tmp/tc.log; exit 1; }
```

The mirror hazard is `set -o pipefail` with a consumer that exits early. `grep -A2 x file | head -3`
makes `grep` die of SIGPIPE, `pipefail` surfaces it, and the script stops half-way — with
correct-looking output above the failure. Both cost this repository a round each: the first let a
broken commit land, the second silently truncated an audit.

This note is here rather than in `AGENTS.md` because that file is excluded by a global gitignore in
the author's environment, so a fresh clone would not receive it.

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

## Constraints

These are not preferences. Each one is measured, and the numbers are in the specification's
performance envelope.

- **No runtime dependencies in `packages/core`.** It has none, and adding one needs an argument
  rather than a convenience.
- **No remark or micromark on the formatting path.** remark parses the 10,129-line fixture in
  164.5 ms against markdown-it's 8.3 ms, and a full AST is not needed for this job — the whole
  document is formatted in 47.3 ms.
- **No pangu, and no wholesale copy of its rule set.** Section 1.2 of the specification lists where
  it is wrong for Markdown. The specification's own rule table is authoritative.

They are here rather than only in `AGENTS.md` because that file is excluded by a global gitignore
in the author's environment, so a fresh clone would not receive them — the same reason the
verification warnings above were moved here.

## Remaining work

Kept here rather than in a session because it has to survive a fresh clone. The specification
is the authority; this is the shortest accurate summary of the gap.

| Item | State |
|---|---|
| **Five documented options** | **Not implemented**, and not equally worth doing. See below. Setting any of them produces silence. |

### `typography.symbolWhitelist`: the shape, now that the refactor is done

The signature refactor (`3d19468`) removed the obstacle. What is left is mechanical:

1. `chars.ts` — export the current `SPACING_SYMBOLS` list as `DEFAULT_SPACING_SYMBOLS` (a plain
   array), and give `isSpacingChar(ch, symbols = SPACING_SYMBOLS)` a `Set` parameter.
2. `options.ts` — `symbolWhitelist?: readonly string[]` on the input, `ReadonlySet<string>` on the
   resolved options, defaulted to `DEFAULT_SPACING_SYMBOLS`. Build the Set once at resolve time,
   not once per character.
3. `typography.ts` — `classOf` passes `options.symbolWhitelist` to `isSpacingChar`. This is the
   single line the refactor existed to make possible.
4. Remove `typography.symbolWhitelist` from **both** "not implemented at all" lists in the same
   commit, or the cross-document check fails.
5. Tests — a custom set that adds a character, one that removes a default such as `%`, and one
   asserting the default set is unchanged.

**Do not land 1 to 3 without 4, and do not land any of them without a test.** An option sitting in
the defaults that nothing reads is precisely the defect `list.indentWidth` carried for twenty
releases, and this option is one careless commit away from repeating it.

### The four remaining options, ranked by whether they are worth building

| Option | Judgment |
|---|---|
| `blankLines.insideLists`, `blankLines.insideBlockquotes` | **Worth doing, carefully.** The only two that change rendering: inserting a blank line between list items flips a tight list to loose. The option is the escape hatch for an author who wants the loose form, and BLK-03 exists precisely to stop the formatter doing it unasked. Any implementation must leave the default off. |
| `typography.symbolWhitelist` | **Worth doing, cheaply.** The symbol set is hardcoded in `chars.ts`; exposing it is mostly threading. A Japanese or Korean user will want a different set, and `cjkClasses` already set the precedent for making a character class configurable. |
| `typography.collapseBoundarySpaces` | **Marginal.** TYPO-02 is implemented and always on. Exposing it means threading a flag through `separator` and `formatLine` for a behaviour nobody has asked to turn off. Do it only if someone does. |
| **Extension host** | The bundle runs against a stubbed `vscode` module in tests. It has never been loaded by a real editor. |
| **Real documents** | Everything is verified against generated fixtures, a synthetic article, and this repository's own Markdown. The formatter has never seen a real Chinese technical article. |

**Not implemented at all:** `blankLines.insideLists`, `blankLines.insideBlockquotes`,
`typography.collapseBoundarySpaces`, `typography.symbolWhitelist`. The specification declares the
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

**BLK-08: the shape of a correct implementation.** The dead end above failed by *inferring* depth
from indentation. The way out is to never infer it: read the marker column of each item directly,
because a list marker is an observable fact rather than a deduction.

1. Walk the lines once and record, per list item, the column of its marker and the column where
   its content begins. A line is an item when it matches `^(\s*)([-*+]|\d+[.)])\s`.
2. Group consecutive items whose markers share a parent: an item is a child of the most recent item
   whose content column is less than this item's marker column.
3. Rewrite each marker to its parent's content column, and shift that item's continuation lines by
   the same delta. Nothing is inferred from how deep the indentation *looks*; the parent is the one
   whose content column the marker is actually nested under.
4. A list containing a protected block is excluded entirely and a diagnostic is reported (spec
   section 7 item 1, option b). Moving code the author fixed in place is what SAFE-02 exists to
   prevent.
5. An item whose marker column matches no parent's content column is left alone rather than snapped
   to the nearest, which is the failure mode of the stack version.

Tests this has to satisfy before it ships: a fragment whose first item is already indented; a nested
list; a list inside a blockquote; a list containing a fence (excluded, diagnostic); an ordered list
whose markers change width (`9.` to `10.`); and idempotence over all of them.

**The range directive: done in 0.17.0, kept as a lesson.** The plan written before the attempt
named three wiring points; there were five, and it took three attempts. The two that were missed
first — the width and punctuation passes, which run before typography and mask themselves
independently — are recorded in the 0.17.0 commit message.

What is worth keeping is the shape of the mistake: **a plan written before an attempt is a
hypothesis, and only the attempt tests it.** The first version of this note was confidently
wrong, and a reverted implementation is what corrected it.

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
