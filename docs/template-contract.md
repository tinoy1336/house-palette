# The template contract

A template is written in the repository that consumes the palette. This document
is everything needed to write one without reading the renderer's source.

## The module

A template is an ES module whose **default export is an object carrying a
`render` method**:

```ts
export default {
  render(context) {
    return "#0a0c11\n" // the exact text of the output
  },
}
```

Written in TypeScript, it runs directly under Node 22 with the types stripped; it
imports nothing from this repository, and it must not: everything it may use
arrives in `context`.

What the renderer refuses, with exit `2` and a message on standard error:

| Template | Message |
|---|---|
| not loadable (missing, a syntax error, an import that does not resolve) | `template <path> could not be read: …` or `template <path> could not be loaded: …` |
| no default export, or a default export that is not an object | `template <path> must export default an object with a render(context) method` |
| a default export whose `render` is not a function | the same message |
| a `render` that throws | the thrown message, unchanged |
| a `render` that returns anything but a string | `template <path> returned <type>; a template returns the exact text of its output` |

A template that fails writes nothing: the render happens in memory first, and the
output is written to a temporary file and renamed into place, so a file is never
half written and a previous output survives a failed render.

## What a template receives

```ts
type TemplateContext = {
  palette: Palette
  colour: ColourHelper
  provenance: Provenance
}
```

### `context.palette`

Frozen, and one of the few things a template can rely on not changing under it.

```ts
type Palette = {
  version: number
  tokens: Readonly<Record<string, Token>> // every token by full name, in source order
  find(name: string): Token               // throws `no such token: <name>`
}

type Token = {
  name: string // `group.key`
  group: string
  purpose: string // one sentence: what the value is for
  hex?: string // `#rrggbb`, lower case
  alpha?: number // 0 to 1, present only when the token carries opacity
  solid?: string // the opaque stand-in, absent for a token with no colour
  alias?: string // the token this one is an alias of
  frozen: boolean // a value tuned by eye, carried unchanged
}
```

Iterate `Object.values(palette.tokens)` for a stable source order, or address one
by name:

```ts
const accent = context.palette.find("accent.primary")
const line = `accent ${accent.hex}\n`
```

`solid` is what a token reads as against `surface.base`: the palette's declared
composite when it has one, otherwise the token painted over that base. A carrier
that cannot express opacity takes `solid`; a carrier that can takes `hex` and
`alpha`.

### `context.colour`

Frozen colour arithmetic. Every function deals in hex strings, RGB channels and
HSL, never in an output syntax — a template that needs `rgba(r, g, b, a)`, a hex
string with an alpha byte fused onto it, or a bare `r, g, b` triple builds that
text itself from `parseHex`.

| Call | Returns |
|---|---|
| `parseHex("#0a0c11")` | `{ r: 10, g: 12, b: 17 }`; throws on anything but a lower-case six-digit hex |
| `toHex({ r, g, b })` | `#rrggbb` |
| `isHex(text)` | whether the text is a lower-case six-digit hex |
| `toHsl(hex)` / `fromHsl({ h, s, l })` | convert between hex and HSL (`h` in degrees, `s` and `l` in 0–1) |
| `blendTowardWhite(hex, amount)` | the colour moved `amount` of the way to white, hue and saturation untouched |
| `compositeOver(hex, alpha, baseHex)` | the colour at that opacity painted over that base: the opaque value that reads the same |
| `rotateHue(hex, degrees)` | the same saturation and lightness, with the hue replaced |
| `formatAlpha(alpha)` | the alpha as the palette records it (`0.5`, never `0.50`) |
| `contrastRatio(a, b)` | the WCAG relative-luminance contrast ratio between two colours |

### `context.provenance`

For a template that stamps its own header, in its own comment syntax:

```ts
type Provenance = {
  generator: string // the renderer's name
  template: { sha256: string }
  palette: { sha256: string; revision: string }
}
```

`palette.revision` is the caller's `--revision` when one was given, otherwise the
palette's own commit when it sits in a repository, otherwise `unversioned`. The
digests are content hashes, so they are the same on every machine.

## What a template returns

A string, and nothing else: the exact text of the output. The renderer adds
nothing — no header, no trailing newline, no reformatting — so a template decides
its own framing, and a template that wants a generated-file banner writes it:

```ts
export default {
  render({ palette, colour, provenance }) {
    const banner = `// generated from the palette at ${provenance.palette.revision} — do not edit\n`
    return banner + Object.values(palette.tokens)
      .map((token) => `// ${token.name}: ${token.hex ?? colour.formatAlpha(token.alpha)} — ${token.purpose}`)
      .join("\n") + "\n"
  },
}
```

## Where the output goes, and what is recorded

The output path is the caller's `--out`; a template never writes, opens or
deletes a file. With `--record <path>` the renderer also writes what produced the
output:

```json
{
  "version": 1,
  "template": { "sha256": "…" },
  "palette": { "sha256": "…", "revision": "…" },
  "output": { "sha256": "…" }
}
```

It holds digests, never paths, so it is identical in every checkout and can be
committed beside the generated file. `--check` compares the output bytes and the
record: exit `0` current, `1` drifted (`missing`, `stale`, `record-missing`,
`record-stale` naming the field that moved, `palette-mismatch` when
`--expect-palette` disagrees), `2` when the render could not happen.

## Rules a template must respect

- **Read nothing but `context`.** Not the palette's file, not the environment,
  not the clock: two runs of one template against one palette produce one output,
  and a run from another working directory or against a copy of the palette
  produces the same bytes.
- **Never write state into the palette.** It is frozen: an assignment throws.
- **Keep format knowledge on the template's side.** Formatting, escaping,
  naming and file syntax belong to the repository that owns the file.
- **Name the output in the consumer's language.** A generated file is the
  consumer's artifact: commit it there, and gate it there with `--check`.
