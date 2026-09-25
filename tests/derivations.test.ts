/**
 * Every derived value the source records is recomputed here from its own
 * formula, so a hand-edited literal cannot hide among the derivations, and the
 * solid composites — the values alpha-free consumers receive — are checked
 * against the same arithmetic.
 */

import assert from "node:assert/strict"
import { join } from "node:path"
import { test } from "node:test"
import { blendTowardWhite, compositeOver, contrastRatio, parseHex, rotateHue } from "../src/colour.ts"
import { loadPalette, roleAlpha, roleHex, solidValue, tokenMap, type Palette } from "../src/palette.ts"
import { repoRoot } from "../src/render.ts"

const palette: Palette = loadPalette(join(repoRoot, "palette.json"))

test("the derived roles match their own formula", () => {
  const cases: [string, string][] = [
    ["accent-soft", blendTowardWhite(roleHex(palette, "accent"), 0.3)],
    ["ink-faint-solid", compositeOver(roleHex(palette, "ink-muted"), 0.55, roleHex(palette, "panel-base"))],
    ["success", rotateHue(roleHex(palette, "accent"), 140)],
  ]
  for (const [role, computed] of cases) {
    assert.equal(roleHex(palette, role), computed, `${role} does not match its derivation`)
  }
})

test("the bright terminal slots are their base role 25 percent toward white", () => {
  const expected: Record<string, string> = {
    "9": "#ff9090",
    "10": "#a7f9c2",
    "11": "#f4c683",
    "12": "#a7c8f9",
    "13": "#caa9f5",
    "14": "#79d9f5",
  }
  const tokens = tokenMap(palette)
  for (const [slot, value] of Object.entries(expected)) {
    assert.equal(tokens.get(`ansi.${slot}`), value, `ansi slot ${slot}`)
    const base = palette.ansi[slot] as string
    assert.equal(blendTowardWhite(roleHex(palette, base.slice("bright:".length)), 0.25), value)
  }
})

test("every declared composite is the role painted over the panel base", () => {
  for (const name of Object.keys(palette.composites)) {
    const hex = roleHex(palette, name)
    const alpha = roleAlpha(palette, name)
    assert.ok(alpha !== undefined, `${name} has no alpha`)
    const computed = compositeOver(hex, alpha as number, roleHex(palette, "panel-base"))
    const channel = (value: string) => [parseHex(value).r, parseHex(value).g, parseHex(value).b]
    const [declared, derived] = [channel(palette.composites[name] as string), channel(computed)]
    for (let index = 0; index < 3; index += 1) {
      // One step of slack per channel: the declared table was rounded by eye at
      // the half-step boundaries, and a larger gap means a wrong value.
      assert.ok(Math.abs((declared[index] as number) - (derived[index] as number)) <= 1, `${name} composite ${palette.composites[name]} vs computed ${computed}`)
    }
    assert.equal(solidValue(palette, name), palette.composites[name], `${name} composite is not what the renderer hands an alpha-free consumer`)
  }
})

test("the text tiers clear AA contrast on the panel base", () => {
  const panel = roleHex(palette, "panel-base")
  const measured: Record<string, number> = {
    accent: 9.35,
    "accent-soft": 11.82,
    success: 14.9,
  }
  for (const [role, expected] of Object.entries(measured)) {
    const actual = contrastRatio(roleHex(palette, role), panel)
    assert.ok(Math.abs(actual - expected) < 0.05, `${role} measures ${actual.toFixed(2)}, the design states ${expected}`)
    assert.ok(actual >= 4.5, `${role} no longer clears AA on the panel base`)
  }
  for (const role of ["ink", "ink-emphasis", "ink-secondary", "ink-muted", "error", "warning"]) {
    assert.ok(contrastRatio(roleHex(palette, role), panel) >= 4.5, `${role} does not clear AA on the panel base`)
  }
})
