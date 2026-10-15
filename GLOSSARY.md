# Glossary

The words this repository uses for its own structure, so that a review can name a
thing without inventing a name for it. The vocabulary is the one from *codebase
design*: a **module** has one **interface**, **depth** is the leverage a caller
gets at that interface, and a **seam** is where the interface lives. Prefer these
words to "component", "service", "API" and "boundary".

## The engine

**Line head** — what a line is once the block quote markers wrapping it are
peeled: its quote depth, where its content starts, and how many columns of
indentation that content carries. There is one reading, `lineContentOf` in
`packages/core/src/blocks.ts`. The region scanner decides indented code by that
column count, so the tab-stop rule belongs to it too.

**Protected region** — a span copied byte for byte: fenced and indented code,
display math, an HTML block or comment, an inline span, a URL, a link destination,
MDX, a wikilink, and TOML front matter. The YAML front matter block is in the same
list, because no Markdown rule may touch it either, but its own rule hands it to a
YAML serializer and the guard checks it by meaning rather than by bytes
(FM-01, FM-03). `scanRegions` finds them all, and the three readings of that one
list — `protectedLines`, `atomicRanges` and `regionMask` — live beside it, so no
two passes can disagree about which lines are untouchable.

**Rule id** — the stable identifier a diagnostic carries, declared once in
`packages/core/src/rules.ts`. Severity is deliberately not part of that
declaration: CFG-02 puts it where the rule raises its diagnostic.

**Option vocabulary** — the declared shape of the adjustable surface: one row per
leaf, with the kind of value it takes and the members it accepts. The config
reader and the option resolver both walk it, so an option that is declared is
read from a file and resolved by construction.

**Line provenance** — where each line of a rebuilt text came from in the input.
The blank-line policy inserts and removes lines, so a diagnostic maps back
through `lineProvenance` before it names a line.

**Table grammar** — what a row, a cell and a delimiter cell are:
`tableRow`, `tableCells` and `isDelimiterRow` in
`packages/core/src/tables.ts`. The table detector reads those rather than a
second copy of the same grammar.

## The adapters

**Adapter** — a concrete thing that satisfies an interface at a seam. The editor
extension and the command line are adapters; `packages/core` is the module they
sit on, and it must not import an editor API.

**Edit** — the core's `TextEdit` plus the lines it spans, so a range selection
can be filtered by line. The editor adapter maps core edits onto it and owns no
edit logic of its own.
