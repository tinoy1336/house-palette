/**
 * The renderer's own behaviour: what a template receives, what the record says,
 * and how a template that is missing, malformed, thrown or returning a
 * non-string is refused — always with exit 2 and never with a half-written file.
 */

import assert from "node:assert/strict"
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { paletteRevision, planRender, sha256, type RenderRequest } from "../src/engine.ts"
import { loadPalette } from "../src/palette.ts"
import { literalTemplate, repoPalette, run, withTempDir, writeInto } from "./helpers.ts"

/** Any temporary file a run left behind: a write goes through one and removes it. */
function temporaries(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[]).filter((entry) => entry.includes(".tmp-"))
}

function request(dir: string, overrides: Partial<RenderRequest> = {}): RenderRequest {
  return {
    template: literalTemplate(dir, "rendered\n"),
    out: join(dir, "out", "output.txt"),
    palette: repoPalette,
    revision: "example",
    ...overrides,
  }
}

const CONTEXT_PROBE = `export default {
  render(context) {
    const accent = context.palette.find("accent.primary")
    return JSON.stringify({
      version: context.palette.version,
      tokenCount: Object.keys(context.palette.tokens).length,
      accent: accent.hex,
      purposeIsStated: accent.purpose.length > 20,
      parsedRed: context.colour.parseHex("#0a0c11").r,
      blended: context.colour.blendTowardWhite("#8ab5f7", 0.3),
      alpha: context.colour.formatAlpha(0.55),
      generator: context.provenance.generator,
      revision: context.provenance.palette.revision,
      templateDigestLength: context.provenance.template.sha256.length,
      paletteFrozen: Object.isFrozen(context.palette),
      tokenFrozen: Object.isFrozen(accent),
      contextFrozen: Object.isFrozen(context),
      colourFrozen: Object.isFrozen(context.colour),
    })
  },
}
`

test("a template receives the frozen palette, the colour helpers and its own provenance", async () => {
  await withTempDir(async (dir) => {
    const template = writeInto(join(dir, "probe.ts"), CONTEXT_PROBE)
    const plan = await planRender(request(dir, { template }))
    const seen = JSON.parse(plan.content) as Record<string, unknown>
    const palette = loadPalette(repoPalette)
    assert.equal(seen.version, 2)
    assert.equal(seen.tokenCount, Object.keys(palette.tokens).length)
    assert.equal(seen.accent, "#8ab5f7")
    assert.equal(seen.purposeIsStated, true)
    assert.equal(seen.parsedRed, 10)
    assert.equal(seen.blended, "#adcbf9")
    assert.equal(seen.alpha, "0.55")
    assert.equal(seen.generator, "house-palette")
    assert.equal(seen.revision, "example")
    assert.equal(seen.templateDigestLength, 64)
    assert.deepEqual(
      [seen.paletteFrozen, seen.tokenFrozen, seen.contextFrozen, seen.colourFrozen],
      [true, true, true, true],
      "a template must not be able to change what it was handed",
    )
  })
})

test("the record names the template, the palette and the output by digest", async () => {
  await withTempDir(async (dir) => {
    const options = request(dir)
    const plan = await planRender(options)
    assert.equal(plan.record.version, 1)
    assert.equal(plan.record.template.sha256, sha256(readFileSync(options.template, "utf8")))
    assert.equal(plan.record.palette.sha256, sha256(readFileSync(repoPalette, "utf8")))
    assert.equal(plan.record.palette.revision, "example")
    assert.equal(plan.record.output.sha256, sha256(plan.content))
    assert.equal(plan.palette.sha256, plan.record.palette.sha256)
  })
})

test("the palette revision defaults to the palette's own commit when it sits in a repository", async () => {
  await withTempDir(async (dir) => {
    const plan = await planRender({ ...request(dir), revision: undefined })
    const palette = loadPalette(repoPalette)
    assert.ok(Object.keys(palette.tokens).length > 0)
    assert.match(plan.record.palette.revision, /^[0-9a-f]{7,}$|^unversioned$/)
  })
})

test("a template that is missing, malformed, thrown or returning a non-string is refused", async () => {
  await withTempDir(async (dir) => {
    const cases: [string, string, RegExp][] = [
      ["missing", join(dir, "nope.ts"), /could not be read/],
      ["no default export", writeInto(join(dir, "a.ts"), "export const render = () => \"x\"\n"), /must export default an object with a render\(context\) method/],
      ["default export without render", writeInto(join(dir, "b.ts"), "export default {}\n"), /must export default an object with a render\(context\) method/],
      ["render is not a function", writeInto(join(dir, "c.ts"), "export default { render: 5 }\n"), /must export default an object with a render\(context\) method/],
      ["throws", writeInto(join(dir, "d.ts"), "export default { render: () => { throw new Error(\"refused by the template\") } }\n"), /refused by the template/],
      ["not a string", writeInto(join(dir, "e.ts"), "export default { render: () => 42 }\n"), /returned number; a template returns the exact text of its output/],
      ["null", writeInto(join(dir, "f.ts"), "export default { render: () => null }\n"), /returned null/],
    ]
    for (const [name, template, expected] of cases) {
      await assert.rejects(planRender(request(dir, { template })), expected, name)
    }
  })
})

test("a failing render writes nothing, keeping a previous output untouched", async () => {
  await withTempDir(async (dir) => {
    const options = request(dir, { record: join(dir, "out", "output.record.json") })
    const written = await run(["--template", options.template, "--out", options.out, "--record", options.record as string, "--palette", options.palette, "--revision", "example"])
    assert.equal(written.code, 0)
    const before = readFileSync(options.out, "utf8")

    const broken = writeInto(join(dir, "broken.ts"), "export default { render: () => { throw new Error(\"refused\") } }\n")
    const failed = await run(["--template", broken, "--out", options.out, "--record", options.record as string, "--palette", options.palette])
    assert.equal(failed.code, 2)
    assert.match(failed.err.join("\n"), /refused/)
    assert.equal(readFileSync(options.out, "utf8"), before, "the previous output was overwritten by a failed render")
  })
})

test("the command reports what it wrote and records, and writes both files whole", async () => {
  await withTempDir(async (dir) => {
    const options = request(dir, { record: join(dir, "out", "output.record.json") })
    const result = await run(["--template", options.template, "--out", options.out, "--record", options.record as string, "--palette", options.palette, "--revision", "example"])
    assert.equal(result.code, 0)
    assert.deepEqual(result.out, [`rendered ${options.out}`, `recorded ${options.record}`])
    assert.equal(readFileSync(options.out, "utf8"), "rendered\n")
    const record = JSON.parse(readFileSync(options.record as string, "utf8")) as { palette: { revision: string }; output: { sha256: string } }
    assert.equal(record.palette.revision, "example")
    assert.equal(record.output.sha256, sha256("rendered\n"))
  })
})

test("an existing output is replaced whole: the write goes through a rename, not the destination itself", async () => {
  await withTempDir(async (dir) => {
    const options = request(dir)
    writeInto(options.out, "the bytes a consumer is reading\n")
    // A read-only destination in a writable directory separates the two
    // mechanisms: a write into the destination itself is refused, while a
    // temporary file renamed over it succeeds. The consumer therefore reads
    // either the whole old file or the whole new one, never a truncated mix.
    chmodSync(options.out, 0o444)
    const result = await run(["--template", options.template, "--out", options.out, "--palette", options.palette, "--revision", "example"])
    assert.equal(result.code, 0, result.err.join("\n"))
    assert.equal(readFileSync(options.out, "utf8"), "rendered\n")
    assert.deepEqual(temporaries(dir), [], "the write left a temporary file behind")
  })
})

test("a write that cannot happen is exit 2, and leaves the destination directory alone", async () => {
  await withTempDir(async (dir) => {
    const destination = join(dir, "out")
    mkdirSync(destination, { recursive: true })
    const kept = writeInto(join(destination, "kept.txt"), "kept\n")
    const result = await run(["--template", literalTemplate(dir, "rendered\n"), "--out", destination, "--palette", repoPalette, "--revision", "example"])
    assert.equal(result.code, 2, result.out.join("\n"))
    assert.ok(result.err.join("\n").length > 0, "a failed write said nothing")
    assert.equal(readFileSync(kept, "utf8"), "kept\n", "a failed write disturbed the destination directory")
    assert.deepEqual(temporaries(dir), [], "a failed write left a temporary file behind")
  })
})

test("the output's parent directory is created when it is missing", async () => {
  await withTempDir(async (dir) => {
    const out = join(dir, "missing", "deeper", "output.txt")
    const result = await run(["--template", literalTemplate(dir, "rendered\n"), "--out", out, "--palette", repoPalette, "--revision", "example"])
    assert.equal(result.code, 0, result.err.join("\n"))
    assert.equal(readFileSync(out, "utf8"), "rendered\n")
  })
})

test("the palette revision default resolves the palette's own commit, and unversioned without one", async () => {
  assert.match(paletteRevision(repoPalette), /^[0-9a-f]{7,40}$/, "the palette sits in a repository here")
  await withTempDir(async (dir) => {
    const vendored = writeInto(join(dir, "palette.json"), readFileSync(repoPalette, "utf8"))
    writeInto(join(dir, "palette.schema.json"), readFileSync(join(repoPalette, "..", "palette.schema.json"), "utf8"))
    assert.equal(paletteRevision(vendored), "unversioned")
    const plan = await planRender({ template: literalTemplate(dir, "x\n"), out: join(dir, "nested", "out.txt"), palette: vendored })
    assert.equal(plan.record.palette.revision, "unversioned")
    assert.equal(plan.record.palette.sha256, sha256(readFileSync(repoPalette, "utf8")), "a copy of one palette is the same palette")
  })
})

test("a palette the schema refuses stops the render, naming the path", async () => {
  await withTempDir(async (dir) => {
    const broken = JSON.parse(readFileSync(repoPalette, "utf8")) as { groups: { text: { primary: Record<string, unknown> } } }
    delete broken.groups.text.primary.purpose
    const palettePath = writeInto(join(dir, "palette.json"), `${JSON.stringify(broken, null, 2)}\n`)
    writeFileSync(join(dir, "palette.schema.json"), readFileSync(join(repoPalette, "..", "palette.schema.json")))
    const result = await run(["--template", literalTemplate(dir, "x"), "--out", join(dir, "out.txt"), "--palette", palettePath])
    assert.equal(result.code, 2)
    assert.match(result.err.join("\n"), /groups\.text\.primary: missing required property: purpose/)
    assert.ok(!existsSync(join(dir, "out.txt")))
  })
})
