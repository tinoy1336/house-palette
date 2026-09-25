/**
 * The palette source satisfies the schema this repository ships, the schema and
 * the source name the same groups and tokens in both directions, and every rule
 * the schema states is a rule the validator actually enforces — each one proved
 * by a fixture that breaks it.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { repoRoot } from "../src/engine.ts"
import { formatErrors, validate } from "../src/schema.ts"

type Node = Record<string, any>

const schema: Node = JSON.parse(readFileSync(join(repoRoot, "palette.schema.json"), "utf8"))
const source: Node = JSON.parse(readFileSync(join(repoRoot, "palette.json"), "utf8"))
const clone = (): Node => JSON.parse(JSON.stringify(source))

test("the palette source satisfies its schema", () => {
  assert.deepEqual(validate(schema, source), [])
})

test("the schema and the source name the same groups and tokens", () => {
  const groups = Object.keys(source.groups).sort()
  assert.deepEqual(Object.keys(schema.properties.groups.properties).sort(), groups)
  assert.deepEqual([...schema.properties.groups.required].sort(), groups)
  for (const group of groups) {
    const tokens = Object.keys(source.groups[group]).sort()
    const declared = schema.properties.groups.properties[group]
    assert.deepEqual(Object.keys(declared.properties).sort(), tokens, `group ${group}`)
    assert.deepEqual([...declared.required].sort(), tokens, `group ${group} required list`)
  }
})

test("the schema and the source name the same opaque stand-ins", () => {
  const names = Object.keys(source.composites).sort()
  assert.deepEqual(Object.keys(schema.properties.composites.properties).sort(), names)
  assert.deepEqual([...schema.properties.composites.required].sort(), names)
})

test("every object in the schema is closed to unknown keys", () => {
  assert.equal(schema.additionalProperties, false)
  assert.equal(schema.properties.groups.additionalProperties, false)
  assert.equal(schema.properties.composites.additionalProperties, false)
  for (const [group, declared] of Object.entries(schema.properties.groups.properties) as [string, Node][]) {
    assert.equal(declared.additionalProperties, false, group)
  }
  for (const name of ["opaqueToken", "translucentToken", "opacityToken", "aliasToken", "derivedToken"]) {
    assert.equal(schema.$defs[name].additionalProperties, false, name)
  }
})

test("the schema states a purpose for every token and nothing that is colour, consumer or file", () => {
  const purpose = schema.$defs.purpose
  assert.equal(purpose.type, "string")
  assert.ok(purpose.minLength >= 20, "a purpose sentence is longer than a word")
  assert.match(purpose.description, /not its colour, its consumer or its file/i)
})

test("a token that breaks a rule is rejected, by path", () => {
  const cases: [string, (copy: Node) => void, RegExp][] = [
    ["no purpose", (copy) => delete copy.groups.text.primary.purpose, /groups\.text\.primary: missing required property: purpose/],
    ["an extra property", (copy) => (copy.groups.text.primary.note = "x"), /groups\.text\.primary: unknown property: note/],
    ["an upper-case colour", (copy) => (copy.groups.text.primary.hex = "#FFFFFF"), /groups\.text\.primary\.hex: must match/],
    ["a three-digit colour", (copy) => (copy.groups.text.primary.hex = "#fff"), /groups\.text\.primary\.hex: must match/],
    ["an opacity above one", (copy) => (copy.groups.opacity.panel.alpha = 1.5), /groups\.opacity\.panel\.alpha: must be at most 1/],
    ["a negative opacity", (copy) => (copy.groups.opacity.panel.alpha = -0.1), /groups\.opacity\.panel\.alpha: must be at least 0/],
    ["an alias carrying a colour", (copy) => (copy.groups.border.divider.hex = "#ffffff"), /groups\.border\.divider: unknown property: hex/],
    ["a solid colour with opacity", (copy) => (copy.groups.border.active.alpha = 0.5), /groups\.border\.active: unknown property: alpha/],
    ["an unknown derive op", (copy) => (copy.groups.accent.soft.derive.op = "lighten"), /must match exactly one of the 3 allowed shapes/],
    ["a derive with no source", (copy) => delete copy.groups.accent.soft.derive.from, /must match exactly one of the 3 allowed shapes/],
    ["a version from another shape", (copy) => (copy.version = 1), /version: must be 2/],
    ["a missing group", (copy) => delete copy.groups.terminal, /groups: missing required property: terminal/],
    ["a token in the wrong group", (copy) => (copy.groups.text.flesh = copy.groups.text.primary), /groups\.text: unknown property: flesh/],
    ["an upper-case stand-in", (copy) => (copy.composites["border.hairline"] = "#191B1F"), /composites\.border\.hairline: must match/],
    ["a stand-in that is not a colour", (copy) => (copy.composites["border.hairline"] = "rgb(1,2,3)"), /composites\.border\.hairline: must match/],
  ]
  for (const [name, breakIt, expected] of cases) {
    const copy = clone()
    breakIt(copy)
    const errors = validate(schema, copy)
    assert.ok(errors.length > 0, `${name}: the schema accepted a palette that breaks it`)
    assert.match(formatErrors(errors), expected, name)
  }
})

test("the validator refuses a keyword it does not implement", () => {
  const errors = validate({ type: "string", format: "email" }, "someone@example.com")
  assert.match(formatErrors(errors), /unsupported schema keyword: format/)
})

test("the validator reports the path of a failure and accepts matching data", () => {
  const mini = { type: "object", required: ["a"], properties: { a: { type: "array", items: { type: "string", minLength: 2 } } } }
  assert.deepEqual(validate(mini, { a: ["ab", "cd"] }), [])
  const errors = validate(mini, { a: ["ab", "c"] })
  assert.equal(errors.length, 1)
  assert.equal(errors[0]?.path, "$.a[1]")
  assert.match(String(errors[0]?.message), /at least 2 characters/)
})
