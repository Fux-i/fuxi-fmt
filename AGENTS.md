# AGENTS.md

Guidance for anyone — human or agent — working in this repository.

## Read this first

1. [FUXI-FMT-SPEC.md](FUXI-FMT-SPEC.md) is the **normative behavioural contract**. Rule IDs in
   the spec (`BLK-01`, `TYPO-05`, `SAFE-02`, …) are the canonical identifiers used in code,
   tests, config keys and commit messages.
2. [MAINSTREAM_MD_FORMATTERS_REPORT.md](MAINSTREAM_MD_FORMATTERS_REPORT.md) records what every
   competing tool does, with primary sources. Consult it before re-deriving prior art.

If implementation and spec disagree, one of them is wrong. Decide which, fix it, and say so in
the commit message. Never silently diverge.

## Invariants — do not break these

1. **Protected regions are byte-verbatim.** Fenced code bodies, fence indentation and info
   strings, front matter, inline code and math spans, HTML blocks and comments, MDX/JSX,
   shortcodes, wikilinks, URLs and link destinations. Any rule that touches one of these is a
   critical bug, not a rounding error. (Spec: SAFE-01 … SAFE-06, FM-01.)
2. **Idempotence.** `format(format(x)) === format(x)`. A rule that is not idempotent is not
   finished.
3. **Semantic preservation.** Output must parse to the same tree as input, except for the
   documented intentional differences. The parse-equality guard runs in the pipeline and refuses
   to write on mismatch. A detection that the document was misread — an unterminated code fence,
   front matter, HTML comment or math block (DET-01 … DET-04) — refuses it the same way, and names
   the line.
4. **No CJK line breaking.** Never wrap, unwrap, join or split a line. CJK has no spaces to
   break at, so a wrapping printer has to split between characters — that is exactly what we
   refuse to do. (Spec: NG-01.)
5. **Minimal edits.** Emit per-rule ranges. Never return one whole-document replacement.
6. **`packages/core` must never import from `vscode`** or any editor API. It is adapter-free by
   design; adapters live in separate packages.

## Code style

- **Erasable TypeScript only.** No `enum`, no `namespace`, no parameter properties, no
  `import =`. Node executes the source directly by stripping types; non-erasable syntax will not
  run. The compiler enforces this via `erasableSyntaxOnly`.
- **Explicit `.ts` extensions on relative imports** (`import { x } from "./x.ts"`). Required by
  native type stripping and enabled by `allowImportingTsExtensions`.
- Prefer `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Do not weaken these to
  make a test pass.
- Formatting: 2-space indent, LF, final newline, single quotes, semicolons. Match surrounding
  code; do not reformat unrelated lines in a feature commit.

## Commands

```sh
npm test                                   # whole suite
npm run test:watch                         # watch mode
node --test "packages/core/src/**/*.test.ts"   # one package
npm run typecheck                          # tsc -p for each package
npm run ci                                 # typecheck + tests
npm run build                              # bundle the VS Code extension
```

## Before tagging a release

1. `rm -rf node_modules && npm ci` — CI runs `npm ci`, not `npm install`, so a
   lockfile that has drifted from `package.json` breaks the build for everyone
   else while working perfectly on your machine.
2. `npm run ci` — typecheck and the whole suite.
3. `npm run build` — the extension bundle must still bundle.
4. Bump the version in `package.json` and in every `packages/*/package.json`
   to match the tag. A test asserts no manifest is **behind** the newest tag, so
   forgetting to bump fails the suite rather than shipping a package whose version
   contradicts its release. A version *ahead* of the newest tag is the release
   sequence working, not an error — bump, commit, tag, then push the branch and
   the tag together (`git push && git push --tags`). Pushing the branch first
   leaves CI comparing a bumped manifest against a tag that only exists on your
   machine, and a tag push does not trigger the workflow, so nothing re-runs.
5. Confirm `git status` is clean afterwards. Nothing above should write to the
   tree.

**Never check a verification result through a pipe.** `npm run typecheck | tail -4`
reports `tail`'s exit status, so a typecheck failure scrolls past and `set -e`
never fires. Redirect to a file and test the real status:

```sh
npm run typecheck > /tmp/tc.log 2>&1 || { tail -8 /tmp/tc.log; exit 1; }
```

## Workflow: test-driven

Every rule and every behaviour change follows red-green-refactor:

1. Write a failing test that names the spec rule ID in the test name, e.g.
   `"TYPO-01 inserts one space between CJK and Latin"`.
2. Run it and confirm it fails for the expected reason.
3. Implement the minimum that passes.
4. Refactor with the test green.

Tests live beside the code (`src/foo.test.ts`) or under `test/`. Fixtures go in
`test/fixtures/` and are treated as byte-exact (see `.gitattributes`). The fixture corpus must
cover every protected region and every nasty combination — tables, footnotes, math, MDX snippets,
mixed punctuation, CRLF, CJK adjacent to every ASCII punctuation mark, deeply nested lists.

## Documentation moves with the code

Every commit that changes behaviour updates, **in the same commit**:

- the specification's rule text and its section 6 status note, if either is affected;
- `packages/vscode/package.json` **and both** `package.nls.json` and `package.nls.zh-cn.json`, if an
  option was added, renamed or removed;
- `CHANGELOG.md`, if the change is visible to a user.

Tests already enforce most of this, and they are the reason to trust it: `docs.test.ts` fails when
the specification and the readme disagree about what is unimplemented, when a documented option does
not exist, when a core option is neither a setting nor declared as deliberately unexposed, when a
locale is missing a string the manifest references, or when the changelog says nothing while feature
commits are unreleased. `settings.test.ts` fails when the manifest and the core's option surface are
not identical.

What no test can check is prose that is not a claim about something checkable. For that, the rule is
the one that has cost this repository the most rounds: **find the sentence your change makes false,
and change it in the same commit.** Five separate rounds were spent correcting documents that a
previous commit had quietly invalidated.

## Before every commit

Run the full check — typecheck and the whole suite — not the package you happened to touch, and
redirect it rather than piping it (the reason is under *Before tagging a release*):

```sh
npm run ci > /tmp/ci.log 2>&1 || { tail -20 /tmp/ci.log; exit 1; }
```

A commit is made on a green suite or not at all. Then apply *Documentation moves with the code*
above: a commit that leaves a document saying something it has just made false is not finished,
even when every test passes.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

<body — why, not what>

<footers>
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `perf`, `build`.
Scopes: `core`, `blk`, `typo`, `safe`, `fm`, `cfg`, `vscode`, `cli`, `repo`.

Reference spec rule IDs in the body, e.g. `Refs: BLK-06, TYPO-01`. Use `BREAKING CHANGE:` in a
footer for incompatible config or behaviour changes.

Commit in coherent slices — one rule or one refactor per commit — and commit at every green
test milestone. Do not leave the working tree dirty across unrelated work.

## Tags and versions

Versioning follows Semantic Versioning; **tags follow the Linux kernel convention**:

- `vMAJOR.MINOR.PATCH` for a release — e.g. `v0.1.0`
- `-rcN` suffix for a release candidate — e.g. `v0.2.0-rc1`
- Tags are **annotated** (`git tag -a`), never lightweight. The Linux kernel also signs its
  tags; sign here too if you have a GPG key configured (`git tag -s`), otherwise annotate.
- Tag the commit that completes the release, and update `CHANGELOG.md` in the same commit.
- **Push only on explicit request.** An `origin` remote exists
  (`git@github.com:Fux-i/fuxi-fmt.git`) and nothing has been pushed. Do not push branches or
  tags unless asked to.

```sh
git tag -a v0.1.0 -m "fuxi-fmt v0.1.0"
git tag -n          # verify
```

## Adding a rule

1. Confirm the rule exists in the spec. If it does not, propose the spec change first.
2. Add it to the rule registry with its spec ID, default severity and typed options, and add
   its sentence to the catalogue in `packages/core/src/messages.ts` (CFG-08), in both languages.
   No rule spells a message out where it is used: a sentence built by concatenation cannot be
   translated. Then run `npm run l10n` — the editor's bundles are generated from the catalogue
   and a test fails when they are stale, because a bundle that was never regenerated answers in
   the wrong language with no error anywhere.
3. Write tests first — a positive case, a negative case, and a protected-region case proving the
   rule does not leak into code blocks, front matter or inline spans.
4. Verify idempotence (run the formatter twice in the test).
5. Add the config key to the spec's section 6 if it is new.
6. Commit as `feat(<scope>): <rule id> <what it does>`.

## Do not

- Add a dependency to `packages/core` without arguing for it. The core currently has none, and
  the benchmark says a hand-written scan is an order of magnitude faster than Prettier on a
  10k-line file. Do not reach for a formatting framework.
- Use remark/micromark on the formatting path. It parses the reference fixture 20x slower than
  markdown-it (164.5 ms vs 8.3 ms). See spec section 1.3.
- Import pangu or copy its rule set wholesale. Spec section 1.2 lists where it is wrong for
  Markdown; the spec's own rule table is authoritative.
- Weaken a guarantee to make a test pass.
- Push without an explicit request.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Fux-i/fuxi-fmt`, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings. See `docs/agents/triage-labels.md`.

