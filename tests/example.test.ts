/**
 * The worked example, end to end: the committed golden output and record are
 * exactly what a render of the example template produces now, and a check
 * against them passes — the whole consumer path (template, palette, record, gate)
 * exercised with no consumer involved.
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { repoRoot, sha256 } from "../src/engine.ts"
import { exampleTemplate, run, withTempDir } from "./helpers.ts"

const goldenOut = join(repoRoot, "examples", "golden", "palette-sheet.md")
const goldenRecord = join(repoRoot, "examples", "golden", "palette-sheet.record.json")

test("the committed golden output is what the example template renders now", async () => {
  assert.ok(existsSync(goldenOut), `missing ${goldenOut}`)
  assert.ok(existsSync(goldenRecord), `missing ${goldenRecord}`)
  await withTempDir(async (dir) => {
    const out = join(dir, "palette-sheet.md")
    const record = join(dir, "palette-sheet.record.json")
    const result = await run(["--template", exampleTemplate, "--revision", "example", "--out", out, "--record", record])
    assert.equal(result.code, 0, result.err.join("\n"))
    assert.equal(readFileSync(out, "utf8"), readFileSync(goldenOut, "utf8"), "regenerate with the command in README.md and read the diff")
    assert.equal(readFileSync(record, "utf8"), readFileSync(goldenRecord, "utf8"), "the record moved without the output")
  })
})

test("a check against the committed example passes", async () => {
  const result = await run(["--template", exampleTemplate, "--revision", "example", "--out", goldenOut, "--record", goldenRecord, "--check"])
  assert.equal(result.code, 0, result.err.join("\n"))
  assert.deepEqual(result.out, [`clean ${goldenOut}`])
})

test("the example record names the committed output by digest", async () => {
  const record = JSON.parse(readFileSync(goldenRecord, "utf8")) as { output: { sha256: string }; palette: { revision: string } }
  assert.equal(record.output.sha256, sha256(readFileSync(goldenOut, "utf8")))
  assert.equal(record.palette.revision, "example")
})

test("the example output carries every token and its purpose", async () => {
  const content = readFileSync(goldenOut, "utf8")
  const { loadPalette } = await import("../src/palette.ts")
  const palette = loadPalette(join(repoRoot, "palette.json"))
  for (const token of Object.values(palette.tokens)) {
    assert.ok(content.includes(`\`${token.name}\``), `${token.name} is not in the sheet`)
    assert.ok(content.includes(token.purpose), `${token.name} purpose is not in the sheet`)
  }
})
