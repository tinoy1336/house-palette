/**
 * The palette's own arithmetic and its locked values: every derived token
 * recomputes from its formula, every opaque stand-in is the token painted over
 * the base surface, every tuned value matches the number it was tuned to, and
 * the text tiers clear the contrast a reader needs.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { blendTowardWhite, compositeOver, contrastRatio, parseHex, rotateHue } from "../src/colour.ts"
import { repoRoot } from "../src/engine.ts"
import { buildPalette, loadPalette, type Palette, type Token } from "../src/palette.ts"

const palette: Palette = loadPalette(join(repoRoot, "palette.json"))
const hexOf = (name: string): string => {
  const hex = palette.find(name).hex
  assert.ok(hex !== undefined, `${name} carries no colour`)
  return hex
}

test("every token states what it is for, and no two state the same thing", () => {
  const tokens = Object.values(palette.tokens)
  assert.ok(tokens.length >= 70, `only ${tokens.length} tokens`)
  const purposes = new Map<string, string>()
  for (const token of tokens) {
    assert.ok(token.purpose.trim().length >= 20, `${token.name}: purpose too short to state anything: ${token.purpose}`)
    assert.ok(!purposes.has(token.purpose), `${token.name} repeats the purpose of ${purposes.get(token.purpose)}`)
    purposes.set(token.purpose, token.name)
  }
})

test("a derived token recomputes from its own formula", () => {
  assert.equal(hexOf("accent.soft"), blendTowardWhite(hexOf("accent.primary"), 0.3))
  assert.equal(hexOf("state.success"), rotateHue(hexOf("accent.primary"), 140))
  assert.equal(hexOf("text.faint-solid"), compositeOver(hexOf("text.faint"), 0.55, hexOf("surface.base")))
})

test("the bright terminal slots are their slot 25 percent toward white", () => {
  const expected: Record<string, string> = {
    "9": "#ff9090",
    "10": "#a7f9c2",
    "11": "#f4c683",
    "12": "#a7c8f9",
    "13": "#caa9f5",
    "14": "#79d9f5",
  }
  for (const [slot, value] of Object.entries(expected)) {
    const token = palette.find(`terminal.${slot}`)
    assert.equal(token.hex, value, `terminal slot ${slot}`)
  }
  assert.equal(hexOf("terminal.9"), blendTowardWhite(hexOf("state.error"), 0.25))
  assert.equal(hexOf("terminal.12"), blendTowardWhite(hexOf("accent.primary"), 0.25))
})

test("every opaque stand-in is its token painted over the base surface", () => {
  const base = hexOf("surface.base")
  const channels = (hex: string) => [parseHex(hex).r, parseHex(hex).g, parseHex(hex).b]
  const translucent = Object.values(palette.tokens).filter((token) => token.hex !== undefined && token.alpha !== undefined && token.alpha > 0)
  assert.ok(translucent.length >= 20, `only ${translucent.length} translucent tokens`)
  for (const token of translucent) {
    const declared = palette.tokens[token.name] as Token
    const computed = compositeOver(token.hex as string, token.alpha as number, base)
    const [a, b] = [channels(declared.solid as string), channels(computed)]
    for (let index = 0; index < 3; index += 1) {
      // One step of slack per channel: the stand-ins were rounded by eye at the
      // half-step boundaries, and a wider gap means a wrong value.
      assert.ok(Math.abs((a[index] as number) - (b[index] as number)) <= 1, `${token.name}: ${declared.solid} against ${computed}`)
    }
  }
})

test("an alias carries the value of the token it names", () => {
  const aliases = Object.values(palette.tokens).filter((token) => token.alias !== undefined)
  assert.ok(aliases.length >= 20, `only ${aliases.length} aliases`)
  for (const token of aliases) {
    const target = palette.find(token.alias as string)
    assert.equal(token.hex, target.hex, `${token.name} against ${target.name}`)
    assert.equal(token.alpha, target.alpha, `${token.name} against ${target.name}`)
    assert.equal(token.solid, target.solid, `${token.name} against ${target.name}`)
  }
})

test("a token name is a group and a key, and the group is the one it sits in", () => {
  for (const [name, token] of Object.entries(palette.tokens)) {
    assert.equal(name, token.name)
    assert.match(name, /^[a-z][a-z0-9-]*\.[a-z0-9-]+$/, name)
    assert.equal(name.slice(0, name.indexOf(".")), token.group, name)
  }
})

test("an unknown token name is an error, not an empty value", () => {
  assert.throws(() => palette.find("text.nonexistent"), /no such token: text\.nonexistent/)
})

test("the token table and every token in it are frozen", () => {
  assert.ok(Object.isFrozen(palette))
  assert.ok(Object.isFrozen(palette.tokens))
  for (const token of Object.values(palette.tokens)) assert.ok(Object.isFrozen(token), token.name)
  assert.throws(() => {
    ;(palette.tokens["text.primary"] as { hex?: string }).hex = "#000000"
  }, TypeError)
})

/** Alphas and colours exactly as they were tuned. A "normalised" or re-derived value fails here. */
const TUNED: Record<string, string> = {
  "text.faint": "#a6a6a6@0.55",
  "border.hairline": "#ffffff@0.06",
  "border.divider": "#ffffff@0.06",
  "border.strong": "#ffffff@0.1",
  "border.active": "#cccccc",
  "border.inactive": "#000000@0",
  "interaction.hover": "#ffffff@0.08",
  "interaction.hover-strong": "#ffffff@0.14",
  "interaction.wash": "#ffffff@0.1",
  "interaction.card-wash": "#ffffff@0.05",
  "interaction.row-highlight": "#ffffff@0.1",
  "interaction.row-active": "#ffffff@0.16",
  "interaction.row-selected": "#0a0c11@0.72",
  "interaction.selection-menu": "#8ab5f7@0.22",
  "interaction.selection-row": "#8ab5f7@0.35",
  "interaction.selection-text": "#8ab5f7@0.45",
  "interaction.accent-fill": "#8ab5f7@0.18",
  "interaction.focus-ring": "#8ab5f7@0.55",
  "interaction.danger-fill": "#ff6b6b@0.16",
  "interaction.scrollbar-thumb": "#ffffff@0.22",
  "interaction.scrollbar-thumb-hover": "#ffffff@0.3",
  "interaction.scrollbar-thumb-active": "#ffffff@0.45",
  "effect.text-shadow": "#000000@0.44",
  "effect.glow-alpha": "0.22",
  "effect.scrim-base": "#000000",
  "effect.scrim-opacity": "0.5",
  "opacity.panel": "0.5",
  "opacity.card": "0.5",
  "opacity.backdrop": "0.35",
  "opacity.control-disc": "0.45",
  "opacity.menu": "0.55",
  "opacity.message": "0.5",
  "opacity.message-urgent": "0.62",
  "opacity.input-panel": "0.72",
  "opacity.terminal": "0.5",
}

const tunedValue = (token: Token): string => {
  if (token.hex === undefined) return String(token.alpha)
  return token.alpha === undefined ? token.hex : `${token.hex}@${token.alpha}`
}

test("the tuned values are exactly what the design states, and nothing else is marked tuned", () => {
  const frozen: Record<string, string> = {}
  for (const token of Object.values(palette.tokens)) if (token.frozen) frozen[token.name] = tunedValue(token)
  assert.deepEqual(frozen, TUNED)
})

test("the text tiers and the accent family clear AA contrast on the base surface", () => {
  const base = hexOf("surface.base")
  for (const name of ["text.strong", "text.primary", "text.secondary", "text.muted", "state.error", "state.warning"]) {
    assert.ok(contrastRatio(hexOf(name), base) >= 4.5, `${name} no longer clears AA on the base surface`)
  }
  const measured: Record<string, number> = { "accent.primary": 9.35, "accent.soft": 11.82, "state.success": 14.9 }
  for (const [name, expected] of Object.entries(measured)) {
    const actual = contrastRatio(hexOf(name), base)
    assert.ok(Math.abs(actual - expected) < 0.05, `${name} measures ${actual.toFixed(2)}, the design states ${expected}`)
  }
})

test("the sixteen terminal slots read as a palette, not as one colour repeated", () => {
  const values = Array.from({ length: 16 }, (_, slot) => hexOf(`terminal.${slot}`))
  assert.ok(new Set(values).size >= 10, `only ${new Set(values).size} distinct terminal colours`)
  for (const value of values) assert.match(value, /^#[0-9a-f]{6}$/)
})

test("the syntax roles are aliases, and each one resolves inside the palette", () => {
  const syntax = Object.values(palette.tokens).filter((token) => token.group === "syntax")
  assert.equal(syntax.length, 9)
  for (const token of syntax) {
    assert.ok(token.alias !== undefined, `${token.name} is not an alias`)
    assert.notEqual(palette.find(token.alias as string).name, token.name)
  }
})

test("a palette that cannot be resolved is refused, naming the reason", () => {
  const source = JSON.parse(readFileSync(join(repoRoot, "palette.json"), "utf8")) as {
    groups: Record<string, Record<string, Record<string, unknown>>>
  }
  const clone = () => JSON.parse(JSON.stringify(source)) as typeof source

  const translucentBase = clone()
  translucentBase.groups.surface.base.alpha = 0.5
  assert.throws(() => buildPalette(translucentBase as never), /surface.base must be an opaque colour/)

  const missingBase = clone()
  delete missingBase.groups.surface.base
  assert.throws(() => buildPalette(missingBase as never), /surface.base/)

  const missingTarget = clone()
  missingTarget.groups.syntax.comment.alias = "text.nonexistent"
  assert.throws(() => buildPalette(missingTarget as never), /no such token: text.nonexistent/)

  const cycle = clone()
  cycle.groups.syntax.comment.alias = "syntax.keyword"
  cycle.groups.syntax.keyword.alias = "syntax.comment"
  assert.throws(() => buildPalette(cycle as never), /alias cycle: syntax.comment -> syntax.keyword -> syntax.comment/)

  const wrongSource = clone()
  wrongSource.groups.text["faint-solid"] = { derive: { op: "composite", from: "text.primary", over: "surface.base" }, purpose: "A composite of a token that carries no opacity of its own." }
  assert.throws(() => buildPalette(wrongSource as never), /composite derives from text.primary, which carries no alpha/)

  const translucentOver = clone()
  translucentOver.groups.text["faint-solid"] = {
    derive: { op: "composite", from: "text.faint", over: "border.hairline" },
    purpose: "A composite derived over a token that carries its own opacity.",
  }
  assert.throws(() => buildPalette(translucentOver as never), /composite derives over border.hairline, which carries its own opacity/)
})
