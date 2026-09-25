/**
 * The pi theme is the one consumer whose format lists its own required roles, so
 * its completeness is checkable: when the installed package ships its theme
 * schema, every required key must be present in the rendered theme, and every
 * value must be a house colour. Every binding is also asserted to resolve — a
 * mis-typed role name fails here rather than in a terminal.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { loadPalette, roleHex } from "../src/palette.ts"
import { piExportBindings, piThemeBindings, resolvePiBinding } from "../src/pi-theme.ts"
import { repoRoot } from "../src/render.ts"
import { renderInMemory } from "./fixture.ts"

const PI_SCHEMA = join(homedir(), ".local", "lib", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "modes", "interactive", "theme", "theme-schema.json")
const palette = loadPalette(join(repoRoot, "palette.json"))

function renderedTheme(): { name: string; colors: Record<string, string>; export: Record<string, string> } {
  const content = renderInMemory().find((file) => file.target === "pi-theme")?.content as string
  return JSON.parse(content) as { name: string; colors: Record<string, string>; export: Record<string, string> }
}

test("the theme names itself and every value is an opaque house colour", () => {
  const theme = renderedTheme()
  assert.equal(theme.name, "house")
  for (const [key, value] of Object.entries({ ...theme.colors, ...theme.export })) {
    assert.match(value, /^#[0-9a-f]{6}$/, `${key} is not an opaque hex colour: ${value}`)
  }
})

test("every required pi role is present", (context) => {
  let required: string[]
  let optional: string[]
  try {
    const schema = JSON.parse(readFileSync(PI_SCHEMA, "utf8")) as {
      properties: { colors: { required: string[]; properties: Record<string, unknown> } }
    }
    required = schema.properties.colors.required
    optional = Object.keys(schema.properties.colors.properties)
  } catch {
    context.skip("pi's theme schema is not installed on this machine")
    return
  }
  const theme = renderedTheme()
  const missing = required.filter((key) => theme.colors[key] === undefined)
  assert.deepEqual(missing, [], "roles pi requires and the theme does not define")
  const unknown = Object.keys(theme.colors).filter((key) => !optional.includes(key))
  assert.deepEqual(unknown, [], "roles the theme defines that pi does not know")
})

test("every binding points at a house role that exists", () => {
  for (const binding of [...piThemeBindings, ...piExportBindings]) {
    const value = resolvePiBinding(palette, binding)
    assert.match(value, /^#[0-9a-f]{6}$/, `${binding.key} (${binding.source}) resolved to ${value}`)
  }
})

test("the nine syntax roles come from the source's syntax map, not from the bindings", () => {
  const theme = renderedTheme()
  for (const [piRole, houseRole] of Object.entries(palette.syntax)) {
    assert.equal(theme.colors[piRole], roleHex(palette, houseRole), `${piRole} drifted from ${houseRole}`)
  }
  assert.ok(!piThemeBindings.some((binding) => binding.key.startsWith("syntax")), "a syntax role is bound twice")
})

test("the judgement calls are a short, explicit list", () => {
  const judgement = piThemeBindings.filter((binding) => binding.judgement !== undefined)
  assert.ok(judgement.length > 0, "no judgement calls recorded")
  assert.ok(judgement.length < piThemeBindings.length, "every binding marked as a judgement call")
  for (const binding of judgement) {
    assert.ok((binding.judgement as string).length > 20, `${binding.key}: justification too thin to review`)
  }
})

test("the accent family stays the only saturated colour in the theme", () => {
  const theme = renderedTheme()
  const allowed = new Set(
    ["accent", "accent-soft", "accent-cyan", "accent-violet", "error", "warning", "success"].map((role) => roleHex(palette, role)),
  )
  const saturated = Object.entries(theme.colors).filter(([, value]) => {
    const [r, g, b] = [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as [number, number, number]
    return Math.max(r, g, b) - Math.min(r, g, b) > 60
  })
  for (const [key, value] of saturated) {
    assert.ok(allowed.has(value), `${key} uses ${value}, which is not a house accent or state colour`)
  }
})
