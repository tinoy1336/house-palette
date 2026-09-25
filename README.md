# house-palette

The single source of truth for the house palette: one file of named roles, a
renderer, and one generated file per consumer. Consumers commit the generated
files in their own repositories, so a consumer's build stands alone and drift
shows up in its own `git status`.

Nothing here defines geometry, motion, glyphs or app layout. Those live where
they are consumed.

## Use

```sh
bin/render                       # render and write every target
bin/render --check               # what a render would write, versus what is on disk
bin/render --target kitty-palette
bin/render --list                # targets, held-back entries, apply steps
bin/render --out <dir>           # render into a fixture root instead of $HOME
bin/render --tinshell <dir>      # root for the shell tree (default ../tinshell)
```

`bin/render` runs on plain Node 22 with no dependency of any kind: the sources
are TypeScript, which Node executes directly by stripping the types, so there is
no build step and no lockfile.

## Layout

| Path | What it is |
|---|---|
| `palette.json` | The source of truth: role → value, with alpha explicit and the tuned translucency roles flagged `frozen`. This file is the role table; nothing else may re-spell a value. |
| `palette.schema.json` | Schema for `palette.json`: every role, the colour format, the alpha range and the `frozen` flag. A role added on one side only fails a test. |
| `src/palette.ts` | Loads the source and flattens it into the token table templates address by name (`accent`, `hairline.css`, `hairline.solid`, `glass.shell.css`, `ansi.4`, …). |
| `src/pi-theme.ts` | The mapping from pi's theme roles to house roles, including the solid composites pi needs because its format carries no alpha. |
| `src/render.ts` | Template expansion, the generated-file header, the manifest and the `--check` comparison. |
| `src/targets.ts` | The destinations the renderer owns, the mechanisms that load them, what is held back and why, and the apply steps a consumer performs. |
| `templates/` | One file per output syntax, in the syntax of its destination. |
| `tests/` | Plain `node --test` files; `tests/golden/` is a rendered fixture tree. |
| `bin/render` | The CLI hooks and audits call. |

## Roles

Every role is named for the job it does, never for its colour. `palette.json`
holds the authoritative list and values; the families are:

| Family | Roles |
|---|---|
| Background tiers | `panel-base`, `view-base`, `window-base`, `surface-raised`, `ink-on-accent`, `keyboard-panel-base` |
| Ink tiers | `ink-emphasis`, `ink`, `ink-secondary`, `ink-muted`, `ink-faint`, `ink-faint-solid` |
| Accent family | `accent`, `accent-soft`, `accent-cyan`, `accent-violet` |
| State | `error`, `warning`, `success` |
| Hairlines and washes | `hairline`, `divider`, `border-strong`, `hover`, `hover-strong`, `wash`, `card-wash` |
| Interaction fills | `selection-menu`, `selection-row`, `selection-note`, `accent-fill`, `focus-ring`, `danger-fill`, `row-highlight`, `row-active`, `scrollbar-thumb`, `scrollbar-thumb-hover`, `scrollbar-thumb-active`, `row-selected`, `text-shadow`, `glow-alpha` |
| Compositor borders | `border-active`, `border-inactive` |
| Per-surface panel alphas | `panel-alpha-shell`, `-card`, `-dock-disc`, `-dock-backdrop`, `-dock-menu`, `-notification`, `-notification-critical`, `-keyboard` |
| Frozen glass | `terminal-opacity`, `scrim-opacity`, `scrim-base` |

Alpha decides what a consumer can receive. A role carries either a solid hex or
an explicit alpha; a syntax that cannot hold alpha (pi's theme JSON, GTK2's rc
fragment, a sixteen-slot terminal palette) instead receives the role's **solid
composite** — the same role painted over `panel-base`, declared in
`palette.json` under `composites` so an alpha-free consumer never has to pick a
value by eye.

## Transparency is deliberate and per surface

The panel, the dock's disc and backdrop, the notification cards, the keyboard
panel, the kitty terminal and the VS Code scrim each carry their own opacity,
because the same alpha reads differently through a different surface: an alpha
tuned over the wallpaper is not the alpha that reads correctly over a blurred
panel. Do not normalise them to one value and do not derive one from another.
Each is recorded as its own role, flagged `frozen`, and carried through the
render unchanged. A test asserts every frozen value against the number it is
supposed to be, and the manifest repeats them so a consumer can read them back.

## Generated files

Each generated file starts with a header naming the source, its digest and the
command that regenerates it, and `bin/render --check` fails on any byte that
differs — a hand edit inside a generated file, or a source that moved without a
re-render. JSON has no comment syntax, so the two JSON destinations (pi's theme,
the manifest) carry their provenance in the manifest instead.

The renderer writes only files it owns. It never rewrites a live application
config and never seeds defaults into one; where a destination has no include
mechanism of its own, `src/targets.ts` records the apply step it waits for and
`bin/render --list` prints those steps. The manifest lands at
`$XDG_CONFIG_HOME/house-palette/manifest.json`.

## Drift checks

Two shapes of drift, two checks:

1. **A stale generated file** — `bin/render --check` renders everything in
   memory and compares bytes, then fails naming the destinations that differ.
2. **A palette value re-spelled in a consumer** — a scan of the consumer tree
   for the literals the role set forbids. `palette.json` is the list those scans
   share; the generated files are the only place a value may appear.

Neither check catches a semantic misuse — `error` where `warning` belongs — so
that stays a matter for review.

## Tests

```sh
node --test tests/*.test.ts
```

The suite asserts that the source and its schema describe the same role set,
that every target's template renders with no placeholder left behind, that the
committed goldens match a fresh render byte for byte, that `--check` fails on a
stale, hand-edited or deleted file, that every derived value reproduces its own
formula, and that the frozen translucency values reach the rendered output
exactly as the source records them.

The goldens are a rendered fixture tree under `tests/golden/`. After an intended
change, regenerate them with:

```sh
HOUSE_PALETTE_REVISION=fixture bin/render --out tests/golden --tinshell tests/golden/tinshell
```

The revision is pinned for a fixture render so the goldens do not move with this
repository's own history; a real render records the commit it was made from.
