/**
 * Two runs of one template against one palette produce one output: byte-identical
 * across repeated runs, across a different working directory, and with the
 * palette loaded from a copy at another path. Nothing about the checkout — its
 * path, its working directory, its commit — may reach the output or the record,
 * so a consumer's gate compares bytes rather than machines.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { repoRoot } from "../src/engine.ts"
import { exampleTemplate, repoPalette, run, runInProcess, withTempDir, writeInto } from "./helpers.ts"

const EXAMPLE_ARGS = ["--template", exampleTemplate, "--revision", "example"]

function recordText(path: string): string {
  return readFileSync(path, "utf8")
}

test("two runs of one template produce identical bytes and an identical record", async () => {
  await withTempDir(async (first) => {
    await withTempDir(async (second) => {
      for (const dir of [first, second]) {
        const result = await run([...EXAMPLE_ARGS, "--out", join(dir, "output.md"), "--record", join(dir, "output.record.json")])
        assert.equal(result.code, 0, result.err.join("\n"))
      }
      assert.equal(readFileSync(join(first, "output.md"), "utf8"), readFileSync(join(second, "output.md"), "utf8"))
      assert.equal(recordText(join(first, "output.record.json")), recordText(join(second, "output.record.json")))
    })
  })
})

test("a run from a different working directory produces identical bytes", async () => {
  await withTempDir(async (dir) => {
    const absolute = await run([...EXAMPLE_ARGS, "--out", join(dir, "absolute.md"), "--record", join(dir, "absolute.record.json")])
    assert.equal(absolute.code, 0, absolute.err.join("\n"))

    const relativeArgs = [
      "--template",
      "examples/palette-sheet.template.ts",
      "--palette",
      "palette.json",
      "--revision",
      "example",
      "--out",
      join(dir, "relative.md"),
      "--record",
      join(dir, "relative.record.json"),
    ]
    const relative = runInProcess(repoRoot, relativeArgs)
    assert.equal(relative.code, 0, relative.stderr)

    assert.equal(readFileSync(join(dir, "absolute.md"), "utf8"), readFileSync(join(dir, "relative.md"), "utf8"))
    assert.equal(recordText(join(dir, "absolute.record.json")), recordText(join(dir, "relative.record.json")))
  })
})

test("the palette loaded from a copy at another path renders identical bytes", async () => {
  await withTempDir(async (dir) => {
    const elsewhere = join(dir, "elsewhere")
    writeInto(join(elsewhere, "palette.json"), readFileSync(repoPalette, "utf8"))
    writeInto(join(elsewhere, "palette.schema.json"), readFileSync(join(repoRoot, "palette.schema.json"), "utf8"))

    const original = await run([...EXAMPLE_ARGS, "--out", join(dir, "original.md"), "--record", join(dir, "original.record.json")])
    const copied = await run([
      "--template",
      exampleTemplate,
      "--palette",
      join(elsewhere, "palette.json"),
      "--revision",
      "example",
      "--out",
      join(dir, "copied.md"),
      "--record",
      join(dir, "copied.record.json"),
    ])
    assert.equal(copied.code, 0, copied.err.join("\n"))
    assert.equal(readFileSync(join(dir, "original.md"), "utf8"), readFileSync(join(dir, "copied.md"), "utf8"))
    assert.equal(recordText(join(dir, "original.record.json")), recordText(join(dir, "copied.record.json")))
  })
})

test("a template moved without changing is the same template, by digest", async () => {
  await withTempDir(async (dir) => {
    const moved = writeInto(join(dir, "renamed.template.ts"), readFileSync(exampleTemplate, "utf8"))
    const first = await run([...EXAMPLE_ARGS, "--out", join(dir, "a.md"), "--record", join(dir, "a.record.json")])
    const second = await run(["--template", moved, "--revision", "example", "--out", join(dir, "b.md"), "--record", join(dir, "b.record.json")])
    assert.equal(second.code, 0, second.err.join("\n"))
    assert.equal(first.code, 0)
    assert.equal(readFileSync(join(dir, "a.md"), "utf8"), readFileSync(join(dir, "b.md"), "utf8"))
    assert.equal(recordText(join(dir, "a.record.json")), recordText(join(dir, "b.record.json")))
  })
})

test("no path from the checkout reaches the output or the record", async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, "output.md")
    const record = join(dir, "output.record.json")
    assert.equal((await run([...EXAMPLE_ARGS, "--out", out, "--record", record])).code, 0)
    const content = readFileSync(out, "utf8")
    const recordContent = recordText(record)
    for (const path of [dir, repoRoot, process.cwd()]) {
      assert.ok(!content.includes(path), `the output names ${path}`)
      assert.ok(!recordContent.includes(path), `the record names ${path}`)
    }
    // A record holds digests and a version, nothing else: no separator, so no path.
    assert.ok(!recordContent.includes("/"), recordContent)
  })
})
