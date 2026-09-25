/**
 * The source and its schema describe the same thing: every role in palette.json
 * has a schema entry and every schema entry is a role. A role added on one side
 * only fails here.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { loadPalette, type Palette, resolveRole, roleAlpha, roleHex, tokenMap } from "../src/palette.ts"
import { repoRoot } from "../src/render.ts"

const palette: Palette = loadPalette(join(repoRoot, "palette.json"))
const schema = JSON.parse(readFileSync(join(repoRoot, "palette.schema.json"), "utf8")) as {
  properties: { roles: { properties: Record<string, unknown>; required: string[] }; syntax: { properties: Record<string, unknown> }; composites: { properties: Record<string, unknown> }; ansi: { properties: Record<string, unknown> } }
}

test("every source role has a schema entry and vice versa", () => {
  const source = Object.keys(palette.roles).sort()
  const declared = Object.keys(schema.properties.roles.properties).sort()
  assert.deepEqual(declared, source)
  assert.deepEqual([...schema.properties.roles.required].sort(), source)
})

test("every syntax role is bound to a role that exists", () => {
  const syntax = Object.keys(palette.syntax).sort()
  assert.deepEqual(Object.keys(schema.properties.syntax.properties).sort(), syntax)
  for (const houseRole of Object.values(palette.syntax)) {
    assert.ok(palette.roles[houseRole] !== undefined, `syntax role points at missing role ${houseRole}`)
  }
})

test("every composite key names a translucent role", () => {
  for (const name of Object.keys(palette.composites)) {
    assert.equal(resolveRole(palette, name), name, `composite key ${name} is an alias, not the role itself`)
    assert.ok(roleAlpha(palette, name) !== undefined, `composite ${name} has no alpha to composite`)
  }
})

test("every frozen role says so in the schema", () => {
  const frozen = Object.entries(palette.roles)
    .filter(([, value]) => typeof value !== "string" && value.frozen === true)
    .map(([name]) => name)
  assert.ok(frozen.length > 0, "no frozen roles: the tuned translucency values lost their flag")
  for (const name of frozen) {
    const entry = schema.properties.roles.properties[name] as { properties?: { frozen?: { const?: boolean } } }
    assert.equal(entry.properties?.frozen?.const, true, `${name} is frozen in the source but not in the schema`)
  }
})

test("every ansi slot resolves to a colour", () => {
  const tokens = tokenMap(palette)
  for (let slot = 0; slot < 16; slot += 1) {
    const value = tokens.get(`ansi.${slot}`)
    assert.match(String(value), /^#[0-9a-f]{6}$/, `ansi slot ${slot}`)
  }
})

test("the sixteen ansi slots are distinct enough to read as a palette", () => {
  const values = Array.from({ length: 16 }, (_, slot) => tokenMap(palette).get(`ansi.${slot}`))
  assert.ok(new Set(values).size >= 10, `only ${new Set(values).size} distinct terminal colours`)
})

test("aliases resolve to a role that holds a value", () => {
  for (const [name, value] of Object.entries(palette.roles)) {
    if (typeof value === "object" && value.alias !== undefined) {
      assert.notEqual(resolveRole(palette, name), name, `alias ${name} points at itself`)
      assert.match(roleHex(palette, name), /^#[0-9a-f]{6}$/)
    }
  }
})
