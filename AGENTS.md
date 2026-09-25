# AGENTS.md — house-palette

Spec sheet for the palette and its renderer. Read this before editing anything in
this tree, and update it in the same change as the code.

## What this repository owns

- `palette.json` — every colour and opacity token, in ten groups, each with a
  purpose sentence.
- `palette.schema.json` — the schema for that file, enforced on every render.
- `src/` — the renderer: colour arithmetic, the schema validator, the palette
  loader, the engine, the command.
- `examples/` — one worked template with its committed golden output and record.
- `docs/template-contract.md` — the contract a consuming repository writes
  against.

What it does not own, and must never contain: a template for a particular
consumer, a consumer's destination path, a per-format conversion, or any
generated file of another project. A template lives in the tree it serves, beside
the file it produces, and that tree gates it with `--check`.

## Commands

```sh
bin/render --template <path> --out <path>            # render and write
bin/render --template <path> --out <path> --check     # compare; 1 on drift
bin/render --template <path> --out <path> --record <path> --check
bin/render --template <path> --out <path> --expect-palette <sha256>
bin/render --help

node --test tests/*.test.ts                           # the whole suite, offline
```

Node 22 runs the TypeScript sources by stripping types: no build step, no package
manager, no lockfile, and an import must carry its `.ts` extension. No syntax that
needs transformation (enums, namespaces, parameter properties) may appear in
`src/`, `tests/` or `examples/`.

Regenerate the example golden after an intended change, then read the diff:

```sh
bin/render --template examples/palette-sheet.template.ts \
  --out examples/golden/palette-sheet.md \
  --record examples/golden/palette-sheet.record.json \
  --revision example
```

## Adding or changing a token

1. Add it to `palette.json` in the group it belongs to, with a purpose sentence.
2. Add the same key to `palette.schema.json` — a test asserts the two sets are
   equal in both directions, so one without the other fails.
3. Use the value shape the value needs: `hex`, `hex` + `alpha`, `alpha`, `alias`,
   or `derive`.
4. If it is derived, write the formula in `derive` and let
   `tests/palette.test.ts` recompute it. A derived number with no formula is how
   a hand-tuned value hides among the derived ones.
5. If it is translucent, add its opaque stand-in to `composites` and let the test
   recompute that too.
6. If it is tuned by eye rather than derived, mark it `frozen` and add it to the
   tuned table in `tests/palette.test.ts`: changing a frozen value is a deliberate
   edit that changes a test.
7. If two tokens must hold the same value, make one an `alias` of the other so
   they cannot drift; never copy the number.
8. Regenerate the example golden and review the rendered diff.

Rules that decide the shape of a name:

- **Name the token for the job it does.** Never for its colour, its consumer or
  the file it lands in. `interaction.selection-text`, not `selection-note`;
  `accent.secondary`, not `accent-cyan`.
- **One purpose sentence per token**, distinct from every other token's: a test
  refuses a repeat, because a repeated purpose means two tokens are one decision.
- **Alpha decides the shape.** A carrier that cannot express opacity takes the
  token's `solid` value — the declared composite, or the token painted over
  `surface.base` — never a value picked by eye at the call site. `solid` is present
  exactly when the token carries a colour: a token that is already opaque carries
  its own hex as its stand-in, and a token that carries only an opacity has no
  stand-in at all.
- **A frozen value is carried, never derived, averaged or normalised.** The
  per-surface opacities exist precisely because one opacity does not read the same
  through two surfaces.

## Rules for the renderer

- **The rule the guard enforces, exactly.** The palette's names and keys, the
  renderer and the example carry no consumer, product or toolkit name and no
  carrier format name. `tests/vocabulary.test.ts` scans every text file in the
  tree for both lists and for wording that describes a particular machine, its
  owner or the run that wrote a file. Two named exceptions, because the rule is
  about names and knowledge rather than about prose: the guard's own file holds
  the refused words, and prose may name the formats this repository's own
  artifacts are written in. The guard plants a consumer name in one file of every
  kind the walk accepts and requires it back as a violation, so trimming either
  list fails the suite.
- Colour helpers deal in colour models only. Formatting for a destination belongs
  to the template that owns that destination.
- The palette is validated against its schema before anything renders, and an
  unknown token name is an error, never a blank value.
- The palettes and tokens handed to a template are frozen.
- Exit codes are a contract: `0` current, `1` drift, `2` the render could not
  happen. Nothing is written on `2`, and an output is written whole or not at all:
  a temporary file beside the destination, then a rename, then the temporary file
  removed if anything fails.

## The record, and what a consumer gates on

`--record` writes a JSON record of what produced the output: the template digest,
the palette digest and revision, and the output digest. It holds no path, so it is
identical in every checkout and can be committed beside the generated file. **The
digests are identity and the revision is provenance**: a gate is decided by content
only, so a checkout that moved without the palette changing leaves a consumer
current. A stored record is validated on read — version, both digests, the
revision — and anything else is exit `2` naming the field, never drift. A
consuming repository gates its commits on `--check`, and pins the palette it
rendered against with the recorded digest plus `--expect-palette <sha256>`. The
consumer side is documented in `README.md` and `docs/template-contract.md`.

## Continuous integration

`.github/workflows/ci.yml` runs the suite on every push to `main` and every pull
request: one job, no install step, because there is nothing to install. The Node
major version is pinned (`22`), so the runner's patch release is its own; an
action is adopted by tag, and the version-and-digest rule below applies to a tool
this repository downloads and runs, not to the runner's own actions.

## Gotchas

- **A template edit is drift even when the bytes are identical.** The record names
  the template that produced the output, so re-render after touching a template.
- **The goldens are the review surface.** Never regenerate one to make a failing
  test pass without reading the diff.
- **Nothing in a render may depend on the working directory, the checkout path or
  the clock.** The determinism test fails on any of them, and it is the only place
  a leaked path would show up.
- **An unknown schema keyword is refused.** The shipped validator implements a
  fixed subset and reports anything else, so a schema can never read as enforced
  while checking nothing.
- **A record that cannot be read is exit `2`, not drift.** A gate that treats `2`
  as "current" is broken.
- **There is no typecheck and no linter, by design.** Node strips the types, so a
  type-level mistake in `src/`, `tests/` or `examples/` is invisible to this suite
  and to CI. Only a mistake that changes behaviour fails.

## Names deferred, deliberately

Some token names describe a convention rather than a job. They are kept for now,
and a rename is a separate, deliberate change: token names are the consumer-facing
API, templates in other repositories address them literally, and every rendered
record elsewhere is compared against output produced through them. A rename would
invalidate that work silently, so it waits until the consuming templates have
settled and can be updated in the same change.

| Token | Why it is arguable | A rename would cost |
|---|---|---|
| `terminal.0` … `terminal.15`, `opacity.terminal` | the slot numbers are a conventional mapping, so the keys mean nothing without knowing that convention | every consumer that reads a slot number, plus the sheet and every record |
| `surface.window`, `border.active`, `border.inactive` | they assume a windowed carrier and focus as something a window holds | few consumers, but the names read well and each purpose sentence says what is meant |
| `interaction.scrollbar-thumb`, `-hover`, `-active` | they name one control of one toolkit; the purpose is the fill of a scroll control | the states are load-bearing for any consumer with a scroll control |
| `text.faint-solid` | the suffix names the mechanism (the opaque stand-in) rather than the job | the pair is documented together and a carrier takes one or the other |
