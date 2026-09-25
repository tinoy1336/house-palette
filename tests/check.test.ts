/**
 * `bin/render --check` is the drift guard: it compares what a render would write
 * against the bytes on disk, so a stale generated file and a hand edit inside a
 * generated file both fail. Exit codes are asserted through the CLI itself,
 * because a hook depends on them.
 */

import assert from "node:assert/strict"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { main } from "../src/cli.ts"
import { checkFiles } from "../src/render.ts"
import { renderInto, renderOnly, withTempFixture } from "./fixture.ts"

function cli(root: string, ...args: string[]): number {
  return main([...args, "--out", root, "--tinshell", join(root, "tinshell")])
}

test("a fresh render checks clean", () => {
  withTempFixture((root) => {
    const files = renderInto(root)
    assert.deepEqual(checkFiles(files), [])
    assert.equal(cli(root, "--check"), 0)
  })
})

test("a hand-edited generated file fails the check, by name", () => {
  withTempFixture((root) => {
    renderInto(root)
    const edited = join(root, ".config", "kitty", "palette.house.conf")
    const content = readFileSync(edited, "utf8")
    writeFileSync(edited, `${content}background #ff0000\n`)

    const drift = checkFiles(renderOnly(root, ["kitty-palette"]))
    // The manifest goes stale with the file it records the digest of, so the
    // edited file is asserted directly.
    const editedDrift = drift.find((entry) => entry.path === edited)
    assert.equal(editedDrift?.kind, "stale")
    assert.equal(drift.length, 2)
    assert.equal(cli(root, "--check"), 1)
  })
})

test("a deleted generated file is reported as missing", () => {
  withTempFixture((root) => {
    renderInto(root)
    rmSync(join(root, ".config", "tmux", "colors.conf"))
    const drift = checkFiles(renderOnly(root, ["tmux-colors"]))
    assert.equal(drift.find((entry) => entry.path.endsWith("tmux/colors.conf"))?.kind, "missing")
    assert.equal(cli(root, "--check"), 1)
  })
})

test("a stale file is fixed by a plain render", () => {
  withTempFixture((root) => {
    renderInto(root)
    const edited = join(root, ".config", "gtk-3.0", "palette.gen.css")
    writeFileSync(edited, "@define-color ags_accent #ff0000;\n")
    assert.equal(cli(root, "--check"), 1)
    assert.equal(cli(root), 0)
    assert.equal(cli(root, "--check"), 0)
  })
})

test("one target renders on its own", () => {
  withTempFixture((root) => {
    const files = renderInto(root, ["git-colors"])
    assert.deepEqual(
      files.map((file) => file.target),
      ["git-colors", "manifest"],
    )
    assert.equal(cli(root, "--check", "--target", "git-colors"), 0)
  })
})

test("bad arguments and unknown targets are usage errors, not drift", () => {
  withTempFixture((root) => {
    assert.equal(main(["--check", "--write", "--out", root]), 2)
    assert.equal(main(["--out", root, "--target", "no-such-target"]), 2)
    assert.equal(main(["--nonsense", "--out", root]), 2)
  })
})

test("the manifest records every rendered file's destination and digest", () => {
  withTempFixture((root) => {
    renderInto(root)
    const manifest = JSON.parse(readFileSync(join(root, ".config", "house-palette", "manifest.json"), "utf8")) as {
      source: { path: string; sha256: string; revision: string }
      targets: Record<string, { destination: string; sha256: string }>
      frozen: Record<string, string>
    }
    assert.equal(manifest.source.path, "palette.json")
    assert.match(manifest.source.sha256, /^[0-9a-f]{64}$/)
    assert.equal(manifest.source.revision, "fixture")
    assert.ok(Object.keys(manifest.targets).length >= 14)
    for (const [name, entry] of Object.entries(manifest.targets)) {
      assert.match(entry.destination, /^\{(home|tinshell)\}\//, `${name} destination`)
      assert.match(entry.sha256, /^[0-9a-f]{64}$/)
    }
    assert.equal(manifest.frozen["panel-alpha-keyboard"], "0.72")
  })
})
