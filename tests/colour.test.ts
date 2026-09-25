/**
 * The colour helpers, as a template receives them: a colour model conversion and
 * arithmetic surface, and nothing that knows an output syntax.
 */

import assert from "node:assert/strict"
import { test } from "node:test"
import {
  blendTowardWhite,
  compositeOver,
  contrastRatio,
  formatAlpha,
  fromHsl,
  isHex,
  parseHex,
  rotateHue,
  toHex,
  toHsl,
} from "../src/colour.ts"

test("a colour is parsed only in the shape the palette records", () => {
  assert.deepEqual(parseHex("#0a0c11"), { r: 10, g: 12, b: 17 })
  assert.equal(isHex("#0a0c11"), true)
  for (const rejected of ["#0A0C11", "#abc", "#0a0c11ff", "0a0c11", "rgba(10, 12, 17, 0.5)", "transparent"]) {
    assert.equal(isHex(rejected), false, rejected)
    assert.throws(() => parseHex(rejected), /not a lower-case six-digit hex colour/)
  }
})

test("a colour survives a round trip through the channels and back", () => {
  for (const hex of ["#000000", "#ffffff", "#8ab5f7", "#606163"]) {
    assert.equal(toHex(parseHex(hex)), hex)
  }
})

test("a colour blended toward white keeps its hue", () => {
  assert.equal(blendTowardWhite("#8ab5f7", 0.3), "#adcbf9")
  assert.equal(blendTowardWhite("#8ab5f7", 0), "#8ab5f7")
  assert.equal(blendTowardWhite("#8ab5f7", 1), "#ffffff")
})

test("a translucent colour composites over its base", () => {
  assert.equal(compositeOver("#ffffff", 0.06, "#0a0c11"), "#191b1f")
  assert.equal(compositeOver("#ffffff", 0, "#0a0c11"), "#0a0c11")
  assert.equal(compositeOver("#ffffff", 1, "#0a0c11"), "#ffffff")
})

test("an alpha is written the way the palette records it", () => {
  assert.equal(formatAlpha(0.5), "0.5")
  assert.equal(formatAlpha(0), "0")
  assert.equal(formatAlpha(0.55), "0.55")
})

test("a hue rotation keeps saturation and lightness, and hsl round-trips", () => {
  assert.equal(rotateHue("#8ab5f7", 140), "#8af7ae")
  for (const hex of ["#8ab5f7", "#ff6b6b", "#0a0c11"]) {
    assert.equal(fromHsl(toHsl(hex)), hex, hex)
  }
})

test("contrast is measured against a known pair", () => {
  assert.equal(contrastRatio("#ffffff", "#000000"), 21)
  assert.ok(Math.abs(contrastRatio("#8ab5f7", "#0a0c11") - 9.35) < 0.05)
  assert.ok(contrastRatio("#0a0c11", "#8ab5f7") === contrastRatio("#8ab5f7", "#0a0c11"), "contrast is symmetric")
})
