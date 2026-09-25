/**
 * The check path, and the exit codes a consuming repository gates on: 0 when the
 * output and its record are current, 1 for every shape of drift — a missing
 * output, a hand-edited output, a changed template, a moved palette, a palette
 * that is not the pinned digest — and 2 when the template or the palette cannot
 * be rendered at all.
 */

import assert from "node:assert/strict"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { repoPalette, run, withTempDir, writeInto } from "./helpers.ts"

const TEMPLATE = `export default {
  render: (context) => \`body \${context.palette.find("accent.primary").hex}\\n\`,
}
`

type Fixture = { template: string; out: string; record: string; palette: string; args: string[] }

function fixture(dir: string, palette = repoPalette, templateName = "template.ts"): Fixture {
  const template = writeInto(join(dir, templateName), TEMPLATE)
  const out = join(dir, "out", "output.txt")
  const record = join(dir, "out", "output.record.json")
  return {
    template,
    out,
    record,
    palette,
    args: ["--template", template, "--out", out, "--record", record, "--palette", palette, "--revision", "example"],
  }
}

/** A palette copy the test may edit, with its schema beside it. */
function paletteCopy(dir: string): string {
  const palette = writeInto(join(dir, "palette.json"), readFileSync(repoPalette, "utf8"))
  writeFileSync(join(dir, "palette.schema.json"), readFileSync(join(repoPalette, "..", "palette.schema.json")))
  return palette
}

test("a fresh render checks clean", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    assert.equal((await run(files.args)).code, 0)
    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 0)
    assert.deepEqual(checked.out, [`clean ${files.out}`])
  })
})

test("a hand-edited output is drift, by name", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    writeFileSync(files.out, "hand edited\n")
    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 1)
    assert.equal(readFileSync(files.out, "utf8"), "hand edited\n", "the check wrote to the output")
    // The record describes what a render produces, not what the file now holds,
    // so an edit inside the output is one drift, not two.
    assert.deepEqual(checked.out, [`stale ${files.out}`])
  })
})

test("a deleted output is drift", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    rmSync(files.out)
    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 1)
    assert.ok(checked.out.includes(`missing ${files.out}`), checked.out.join("\n"))
  })
})

test("a changed template is drift, even when the bytes it produces are unchanged", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    writeInto(files.template, `${TEMPLATE}// a comment changes the template, not the output\n`)
    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 1)
    assert.match(checked.out.join("\n"), /record-stale .*: template sha256: recorded [0-9a-f]{64}, now [0-9a-f]{64}/)
    assert.ok(!checked.out.some((line) => line.startsWith("stale ")), "the output itself did not change")
  })
})

test("a moved palette is drift: the record names the digest it was rendered from", async () => {
  await withTempDir(async (dir) => {
    const palette = paletteCopy(dir)
    const files = fixture(dir, palette, "accent-template.ts")
    await run(files.args)
    const moved = JSON.parse(readFileSync(palette, "utf8")) as { groups: { accent: { primary: { hex: string } } } }
    moved.groups.accent.primary.hex = "#112233"
    writeFileSync(palette, `${JSON.stringify(moved, null, 2)}\n`)

    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 1)
    assert.match(checked.out.join("\n"), /record-stale .*: palette sha256: recorded [0-9a-f]{64}, now [0-9a-f]{64}/)
    assert.ok(checked.out.some((line) => line.startsWith("stale ")), "the output changed with the palette")
  })
})

test("a pinned palette digest is the gate: a mismatch fails, a match passes", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    const digest = JSON.parse(readFileSync(files.record, "utf8")).palette.sha256 as string
    const matching = await run([...files.args, "--check", "--expect-palette", digest])
    assert.equal(matching.code, 0)
    const pinnedElsewhere = await run([...files.args, "--check", "--expect-palette", "0".repeat(64)])
    assert.equal(pinnedElsewhere.code, 1)
    assert.match(pinnedElsewhere.out.join("\n"), new RegExp(`palette-mismatch ${files.palette}: expected ${"0".repeat(64)}, found ${digest}`))
  })
})

test("a missing record is drift, an unreadable record is a render that cannot happen", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    rmSync(files.record)
    const missing = await run([...files.args, "--check"])
    assert.equal(missing.code, 1)
    assert.ok(missing.out.includes(`record-missing ${files.record}`), missing.out.join("\n"))

    writeFileSync(files.record, "not json\n")
    const unreadable = await run([...files.args, "--check"])
    assert.equal(unreadable.code, 2)
    assert.match(unreadable.err.join("\n"), /record .* could not be read/)
  })
})

test("the gate is decided by content: the same palette under another revision is current", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)

    // A different revision string over the same palette bytes: the checkout
    // moved, the palette did not, so the output a consumer reads cannot change.
    const otherRevision = [...files.args, "--check"]
    otherRevision[otherRevision.indexOf("--revision") + 1] = "another-revision"
    const renamed = await run(otherRevision)
    assert.equal(renamed.code, 0, renamed.out.join("\n"))
    assert.deepEqual(renamed.out, [`clean ${files.out}`])

    // And the default revision, which is the palette's own commit: the path a
    // consumer that pins nothing takes.
    const withoutRevision: string[] = []
    for (let index = 0; index < files.args.length; index += 1) {
      if (files.args[index] === "--revision") {
        index += 1
        continue
      }
      withoutRevision.push(files.args[index] as string)
    }
    const defaulted = await run([...withoutRevision, "--check"])
    assert.equal(defaulted.code, 0, defaulted.out.join("\n"))
  })
})

test("a palette whose content moved is drift, under the revision it was rendered with", async () => {
  await withTempDir(async (dir) => {
    const palette = paletteCopy(dir)
    const files = fixture(dir, palette, "content-template.ts")
    await run(files.args)

    const moved = JSON.parse(readFileSync(palette, "utf8")) as { groups: { accent: { primary: { hex: string } } } }
    moved.groups.accent.primary.hex = "#112233"
    writeFileSync(palette, `${JSON.stringify(moved, null, 2)}\n`)

    const checked = await run([...files.args, "--check"])
    assert.equal(checked.code, 1)
    assert.match(checked.out.join("\n"), /record-stale .*: palette sha256: recorded [0-9a-f]{64}, now [0-9a-f]{64}/)
    assert.ok(!checked.out.join("\n").includes("palette revision"), "the revision is provenance, not a comparison key")
  })
})

test("a record that is not a record ends the run as a render that could not happen", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    const outputBefore = readFileSync(files.out, "utf8")

    const digest = "0".repeat(64)
    const cases: [string, RegExp][] = [
      [JSON.stringify({ version: 1 }), /template\.sha256 must be a sha256 digest/],
      [JSON.stringify({ version: 2, template: { sha256: digest }, palette: { sha256: digest, revision: "r" }, output: { sha256: digest } }), /version must be 1/],
      [JSON.stringify({ version: 1, template: { sha256: digest }, palette: { sha256: digest, revision: "r" }, output: { sha256: "short" } }), /output\.sha256 must be a sha256 digest/],
      [JSON.stringify({ version: 1, template: { sha256: digest }, palette: { sha256: digest, revision: "" }, output: { sha256: digest } }), /palette\.revision must be a revision string/],
      ["[]\n", /it is not an object/],
    ]
    for (const [content, expected] of cases) {
      writeFileSync(files.record, content)
      const checked = await run([...files.args, "--check"])
      assert.equal(checked.code, 2, `${content.trim()}: ${checked.out.join(" | ")}`)
      assert.match(checked.err.join("\n"), expected)
      assert.ok(checked.err.join("\n").includes(`${files.record} is not a record`), checked.err.join("\n"))
      assert.equal(readFileSync(files.out, "utf8"), outputBefore, "the failed gate touched the output")
      assert.ok(!checked.out.join("\n").includes("undefined"), `a field the record does not hold was printed: ${checked.out.join(" | ")}`)
    }
  })
})

test("a missing palette is exit 2, named", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir, join(dir, "nope", "palette.json"))
    const result = await run([...files.args, "--check"])
    assert.equal(result.code, 2)
    assert.match(result.err.join("\n"), /palette .*nope.palette\.json could not be read/)
  })
})

test("a check never writes, and a plain render repairs the drift", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    await run(files.args)
    writeFileSync(files.out, "hand edited\n")
    assert.equal((await run([...files.args, "--check"])).code, 1)
    assert.equal((await run(files.args)).code, 0)
    assert.equal((await run([...files.args, "--check"])).code, 0)
    assert.notEqual(readFileSync(files.out, "utf8"), "hand edited\n")
  })
})

test("bad arguments are exit 2, never drift", async () => {
  await withTempDir(async (dir) => {
    const files = fixture(dir)
    const cases: [string[], RegExp][] = [
      [["--out", files.out], /--template is required/],
      [["--template", files.template], /--out is required/],
      [["--template", files.template, "--out", files.out, "--nonsense"], /unknown argument: --nonsense/],
      [["--template", files.template, "--out", files.out, "--expect-palette", "not-a-digest"], /--expect-palette takes a sha256 digest/],
      [["--template", files.template, "--out", files.out, "--template", files.template], /--template was given twice/],
    ]
    for (const [argv, expected] of cases) {
      const result = await run(argv)
      assert.equal(result.code, 2, argv.join(" "))
      assert.match(result.err.join("\n"), expected, argv.join(" "))
    }
  })
})

test("--help prints the usage and exits 0", async () => {
  const helped = await run(["--help"])
  assert.equal(helped.code, 0)
  assert.match(helped.out.join("\n"), /usage: bin\/render/)
  assert.match(helped.out.join("\n"), /exit codes: 0 current, 1 drift, 2 the render could not happen/)
})
