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
  `surface.base` — never a value picked by eye at the call site.
- **A frozen value is carried, never derived, averaged or normalised.** The
  per-surface opacities exist precisely because one opacity does not read the same
  through two surfaces.

## Rules for the renderer

- No consumer name, no consumer path, no destination and no per-format
  conversion may enter `src/`, the palette, the example, the tests or the docs.
  `tests/vocabulary.test.ts` enforces this over the whole tree, and refuses
  wording that describes a particular machine or its owner.
- Colour helpers deal in colour models only. Formatting for a destination belongs
  to the template that owns that destination.
- The palette is validated against its schema before anything renders, and an
  unknown token name is an error, never a blank value.
- The palettes and tokens handed to a template are frozen.
- Exit codes are a contract: `0` current, `1` drift, `2` the render could not
  happen. Nothing is written on `2`, and an output is written whole or not at all.

## The record, and what a consumer gates on

`--record` writes a JSON record of what produced the output: the template digest,
the palette digest and revision, and the output digest. It holds no path, so it is
identical in every checkout and can be committed beside the generated file. A
consuming repository gates its commits on `--check`, and pins the palette it
rendered against with the recorded digest plus `--expect-palette <sha256>`. The
consumer side is documented in `README.md` and `docs/template-contract.md`.

## Continuous integration

`.github/workflows/ci.yml` runs the suite on every push to `main` and every pull
request: one job, Node 22 pinned, no install step, because there is nothing to
install. A tool that ever needs downloading is pinned to a version and checked by
digest.

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
