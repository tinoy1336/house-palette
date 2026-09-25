# house-palette

One palette, and a renderer that turns it into any file a project needs.

The palette is a single source of truth for a set of colours and opacities,
written as purpose-named tokens: what a value is *for*, never what colour it is
or which file it lands in. The renderer knows nothing about any destination — it
loads a template module, hands it the palette and a small colour helper API, and
writes exactly what the template returns. Every template belongs to the project
that uses it, lives in that project's own repository, and is committed beside the
file it produces.

Nothing here defines geometry, motion, glyphs or layout. Nothing here names a
program, a toolkit or a file format.

## What is in the repository

| Path | What it is |
|---|---|
| `palette.json` | The palette: ten groups of tokens, each carrying a value and a one-line purpose. |
| `palette.schema.json` | The schema for that file. The renderer validates the palette against it before rendering anything. |
| `src/colour.ts` | Colour arithmetic: hex, RGB channels, HSL, blending, alpha compositing, contrast. No output syntax. |
| `src/schema.ts` | The validator for the schema, dependency-free. |
| `src/palette.ts` | Loads the palette, proves it against the schema, and resolves it into the frozen token table a template receives. |
| `src/engine.ts` | Template loading, the render context, the record, the byte comparison, the write. |
| `src/cli.ts`, `bin/render` | The command. |
| `examples/` | A worked example template and its committed golden output and record. |
| `tests/` | The test suite: plain `node --test`, no dependency of any kind. |
| `docs/template-contract.md` | The contract a template is written against. |

Node 22 runs the TypeScript sources directly by stripping the types: there is no
build step, no package manager and no lockfile, and an import carries its `.ts`
extension. Keep it that way.

## The palette

Ten groups. Every token's full name is `group.key`, and its purpose is a sentence
in `palette.json` — the source is the list, this is the shape of it:

| Group | What it holds |
|---|---|
| `surface` | The base that translucent surfaces composite over, and the opaque tiers above it. |
| `text` | Text by emphasis tier, from the loudest heading to the quietest label, plus the colour used on a filled accent. |
| `accent` | The accent family: the leading hue, a lighter step of it, and two further hues. |
| `state` | Failure, caution and success. |
| `border` | Edges, separators, and the pair of window border colours. |
| `interaction` | The fills a control takes as it is pointed at, pressed, selected or dragged, and the keyboard focus ring. |
| `opacity` | How much shows through each surface. One opacity per surface: one value does not read the same through two. |
| `effect` | A text shadow, a halo, and the wash laid over a backdrop for legibility. |
| `syntax` | The colours of a code listing by syntactic role. Every one is an alias of another token. |
| `terminal` | The conventional sixteen colour slots of a text console. |

A token is written in exactly one of five shapes:

```jsonc
{ "hex": "#0a0c11", "purpose": "…" }                       // a solid colour
{ "hex": "#ffffff", "alpha": 0.06, "purpose": "…" }        // a colour with its own opacity
{ "alpha": 0.5, "purpose": "…" }                           // an opacity with no colour
{ "alias": "border.hairline", "purpose": "…" }             // the same decision as another token
{ "derive": { "op": "rotate-hue", "from": "accent.primary", "degrees": 140 }, "purpose": "…" }
```

Three derivation operations exist and no more: `blend-toward-white`, `rotate-hue`
and `composite` (a translucent token painted over a solid one). `frozen: true`
marks a value that was tuned by eye: it is carried unchanged, never derived,
averaged or normalised, and a test asserts each one against the number it was
tuned to.

Two tables outside the groups:

- **`composites`** — the opaque stand-in for each translucent token, for a carrier
  that cannot express opacity. A test recomputes every one of them from the token
  and allows one step of rounding per channel.
- The **schema** — every group, every token, and the five shapes. The renderer
  validates the palette against it on every run, so a palette that breaks the
  schema does not render at all.

## The renderer

```sh
bin/render --template <path> --out <path>
bin/render --template <path> --out <path> --check
bin/render --template <path> --out <path> --record <path>
bin/render --template <path> --out <path> --check --expect-palette <sha256>
```

| Option | What it does |
|---|---|
| `--template <path>` | The template module to render. |
| `--out <path>` | The file to write, or the file to compare against with `--check`. |
| `--check` | Renders in memory and compares. Writes nothing. |
| `--record <path>` | A JSON record of what produced the output: written, or compared by `--check`. |
| `--palette <path>` | The palette source. Default: `palette.json` beside the command. |
| `--revision <string>` | The palette revision to record. Default: the palette's own commit when it sits in a repository, otherwise `unversioned`. |
| `--expect-palette <sha256>` | Fail unless the loaded palette is exactly this digest. |

### Exit codes: the promise a gate can rely on

| Code | Meaning |
|---|---|
| `0` | The write succeeded; or `--check` found the output and the record current. |
| `1` | Drift: the output is missing, the output differs from a fresh render, the record differs (the template or the palette moved), or the palette is not the digest that was pinned with `--expect-palette`. The reason is printed, one line each, naming the file and the digest it moved from. |
| `2` | The render could not happen: bad arguments, a palette that is missing or fails the schema, a template that is missing, malformed, thrown, or returning something other than a string. The reason is printed on standard error. |

Everything prints one line per fact and nothing else, so a consuming repository
can gate its commits on the exit code and quote the printed reason when it fails.
Exit `2` is never drift: it means the gate could not do its job, and a gate that
treats it as "current" is broken.

## Writing a template

A template module is an ES module whose default export is an object with a
`render(context)` method that returns the exact text of the output. The renderer
adds nothing to it: no header, no trailing newline, no reformatting. Everything a
template may use arrives in `context`:

- `context.palette` — the frozen palette: `version`, `tokens` (every token by
  full name) and `find(name)`.
- `context.colour` — the frozen helper API: `parseHex`, `toHex`, `toHsl`,
  `fromHsl`, `blendTowardWhite`, `compositeOver`, `rotateHue`, `contrastRatio`,
  `formatAlpha`, `isHex`.
- `context.provenance` — `generator`, `template.sha256`, `palette.sha256` and
  `palette.revision`, for a template that stamps its own header.

Each token is `{ name, group, purpose, hex?, alpha?, solid?, alias?, frozen }`,
where `solid` is what the token reads as on `surface.base`: the declared
composite when the palette has one, otherwise the token painted over that base.

`examples/palette-sheet.template.ts` is a complete worked example: it renders the
whole palette as a Markdown sheet, table per group, and closes with a contrast
figure. Its committed golden output and record are `examples/golden/`:

```sh
bin/render --template examples/palette-sheet.template.ts \
  --out examples/golden/palette-sheet.md \
  --record examples/golden/palette-sheet.record.json \
  --revision example
```

The full contract — what a template exports, what it receives, what it may
return, and how errors surface — is in
[`docs/template-contract.md`](docs/template-contract.md).

## A consuming repository

A project that wants these values writes its own template, in its own
repository, and commits both the generated file and the record beside it:

```sh
bin/render --template tools/theme.template.ts \
  --out src/theme.generated.json \
  --record src/theme.generated.record.json
```

Its gate re-renders and compares, exactly as CI would:

```sh
bin/render --check --template tools/theme.template.ts \
  --out src/theme.generated.json --record src/theme.generated.record.json
# 0 current, 1 drifted, 2 the render could not happen
```

### Pinning the palette revision

The record is identity by content digest, and it holds no path:

```json
{
  "version": 1,
  "template": { "sha256": "…" },
  "palette": { "sha256": "…", "revision": "…" },
  "output": { "sha256": "…" }
}
```

So a palette revision is identified without naming a repository, a path or a
date, and two checkouts render identical records. A consuming repository pins the
revision it rendered against in two steps:

1. **The record.** Committed beside the generated file, it names the palette
   digest the output was produced from. Nothing else detects that the palette
   moved underneath a project: the check fails, printing the recorded digest and
   the one now loaded, and the project re-renders, reads the diff and commits the
   new output and record deliberately.
2. **The digest, in the gate.** Passing `--expect-palette <sha256>` from the
   project's own configuration turns "the palette changed" into a hard failure
   even before the output is compared, which is what a project wants when it must
   choose the moment to take an upstream change.

A mismatch is never silent: the check exits `1` and prints both digests. A
template change is the same shape of event — the record names the template that
produced the current output, so editing a template without re-rendering is drift
even when the bytes it happens to produce are unchanged.

## Tests

```sh
node --test tests/*.test.ts
```

The suite is offline and dependency-free. It covers the schema and every rule in
it (each proved by a fixture that breaks it), the palette's own arithmetic and its
tuned values, the colour helpers, the engine (loading, a malformed template, a
throwing template, a non-string return, no partial write), the check path with
its exit codes, the example end to end against its committed golden output, the
absence of any consumer or format vocabulary in the repository, and determinism:
two runs are byte-identical, and so are a run from another working directory and
a run with the palette loaded from a copy at another path.
