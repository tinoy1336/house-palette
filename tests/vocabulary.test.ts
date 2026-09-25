/**
 * The guard, and its exact scope.
 *
 * The rule this repository lives by: the palette's names and keys, the renderer
 * and the example carry no consumer, product or toolkit name and no carrier
 * format name. A value is named for its purpose, and the renderer knows no
 * destination. In prose the only format words allowed are the ones this
 * repository's own artifacts are written in — its source, schema and record are
 * JSON, and the example renders a Markdown sheet — which is what SELF_FORMATS
 * lists and why it is exempt.
 *
 * This file is the one place the forbidden vocabulary is written down, so it is
 * the one file outside its own scan. The list itself is pinned by fixtures whose
 * text is written out rather than derived from the list, so trimming a term
 * fails the suite: the fixtures are planted in every kind of file the walk
 * accepts, and every planted name must come back as a violation.
 */

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { test } from "node:test"
import { repoRoot } from "../src/engine.ts"
import { withTempDir, writeInto } from "./helpers.ts"

/** Names of consumers, products and toolkits: none of them may be a palette key, a purpose sentence, a line of the renderer or a line of the docs. */
const CONSUMERS = [
  "kitty",
  "gtk",
  "hypr",
  "hyprland",
  "hyprlock",
  "tmux",
  "zsh",
  "kde",
  "qt",
  "gnome",
  "plasma",
  "xfce",
  "libadwaita",
  "vscode",
  "vesktop",
  "vencord",
  "discord",
  "firefox",
  "youtube",
  "pi",
  "ags",
  "gnim",
  "tinshell",
  "dock",
  "kvantum",
  "clipboard",
  "annotate",
  "notifd",
  "promptd",
  "waybar",
  "sway",
  "mako",
  "dunst",
  "rofi",
  "wofi",
  "fuzzel",
  "neovim",
  "nvim",
  "alacritty",
  "wezterm",
  "spicetify",
]

/**
 * Carrier formats: the palette names a value for its purpose, never for the file
 * it lands in. Two omissions, for collisions rather than for coverage: the word
 * for the ordinary-English-less stylesheet is left out because the word itself
 * is ordinary English, and the short spelling of the data-serialisation language
 * is left out because a workflow's own file name contains it. The languages
 * behind both are covered — the stylesheet carriers by css, scss and sass, the
 * serialisation language by yaml — and a fence language tag in prose is not a
 * carrier claim in any case.
 */
const FORMATS = ["css", "scss", "sass", "ini", "lua", "conf", "toml", "yaml", "xml", "html", "svg"]

/** The formats this repository's own artifacts are written in: allowed in prose, and the reason the scan exempts them. */
const SELF_FORMATS = ["json", "jsonc", "markdown", "md"]

/**
 * The shapes a leaked identity takes: a home path, or a phrase naming the machine
 * or its owner. The scan looks for shapes rather than for the name of the machine
 * running it — a public suite has to behave the same everywhere, and probing the
 * running host fails wherever its login name happens to be an ordinary word.
 */
const PROVENANCE = ["this machine", "my machine", "the owner", "the maintainer", "/home/", "/Users/", "C:\\Users", "session", "subagent", "foreman", "worker", "crew"]

/**
 * Samples written out here rather than read from the lists above: deleting a
 * term from a list leaves these literals behind, so the term is still planted
 * and the suite fails.
 */
const PINNED_CONSUMERS = ["the kitty terminal", "hyprland here", "the tinshell shell", "a gtk theme", "kvantum", "youtube music", "the youtube player", "ags", "gnim", "vesktop"]
const PINNED_FORMATS = ["a css fragment", "an ini file", "a lua table", "a toml file", "a yaml file", "an xml file", "an html page", "an svg icon", "a conf fragment"]

const SELF = "tests/vocabulary.test.ts"

type Tree = { text: string[]; binary: string[] }

/** Every file under `root`, split into the ones that carry text and the ones that do not. No extension list: a new kind of file cannot escape. */
function tree(root: string): Tree {
  const text: string[] = []
  const binary: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      const bytes = readFileSync(path)
      if (bytes.includes(0)) binary.push(relative(root, path))
      else text.push(relative(root, path))
    }
  }
  walk(root)
  return { text: text.sort(), binary: binary.sort() }
}

function pattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return term.includes("/") || term.includes(" ") ? new RegExp(escaped, "i") : new RegExp(`\\b${escaped}\\b`, "i")
}

/** Every file in `root` whose text carries one of `terms`, as `path: term`. */
function scan(terms: string[], root: string = repoRoot): string[] {
  const violations: string[] = []
  for (const path of tree(root).text) {
    if (root === repoRoot && path === SELF) continue
    const content = readFileSync(join(root, path), "utf8")
    for (const term of terms) if (pattern(term).test(content)) violations.push(`${path}: ${term}`)
  }
  return violations
}

/** One file of every kind the walk must accept, each carrying the same planted sentence, plus one binary file it must skip. */
function plantEveryKind(dir: string, sentence: string): { planted: string[]; binary: string } {
  const names = ["planted.ts", "planted.json", "planted.md", "planted.yml", "planted.yaml", "planted.txt", "planted.css", "planted.conf", "planted.sh", "planted.mjs", "planted.toml", "planted.svg", "planted"]
  for (const name of names) writeInto(join(dir, name), `${sentence}\n`)
  writeInto(join(dir, "planted.png"), `\u0000${sentence}\u0000`)
  return { planted: names, binary: "planted.png" }
}

test("the walk reads every kind of file, and only skips the ones that carry no text", async () => {
  await withTempDir((dir) => {
    const scratch = join(dir, "tree")
    writeInto(join(scratch, "a.ts"), "text\n")
    writeInto(join(scratch, "deep", "b.conf"), "text\n")
    writeInto(join(scratch, "shot.png"), "\u0000binary\u0000")
    const found = tree(scratch)
    assert.deepEqual(found.text, ["a.ts", "deep/b.conf"])
    assert.deepEqual(found.binary, ["shot.png"])
  })
})

test("a planted consumer name is caught in every kind of file the walk accepts", async () => {
  await withTempDir((dir) => {
    const { planted, binary } = plantEveryKind(dir, "this file mentions kitty")
    const violations = scan(CONSUMERS, dir)
    for (const name of planted) {
      assert.ok(violations.includes(`${name}: kitty`), `${name} escaped the scan: ${violations.join(", ") || "nothing was reported"}`)
    }
    assert.ok(!violations.some((entry) => entry.startsWith(binary)), "a binary file was scanned as text")
    assert.ok(tree(dir).binary.includes(binary), "the walk did not classify the planted binary file as binary")
  })
})

test("a home path or a machine phrase is caught as a shape, not as this machine's name", async () => {
  await withTempDir((dir) => {
    writeInto(join(dir, "leak.txt"), "the profile lives at /home/somebody/profile and this machine runs it\n")
    writeInto(join(dir, "leak-windows.txt"), "C:\\Users\\somebody\\profile\\palette.json\n")
    const violations = scan(PROVENANCE, dir)
    for (const expected of ["leak.txt: /home/", "leak.txt: this machine", "leak-windows.txt: C:\\Users"]) {
      assert.ok(violations.includes(expected), `${expected} escaped: ${violations.join(", ") || "nothing was reported"}`)
    }
  })
})

test("the walk covers the repository, not a sample of it", () => {
  const scanned = tree(repoRoot).text.filter((path) => path !== SELF)
  for (const path of ["palette.json", "palette.schema.json", "src/engine.ts", "src/colour.ts", "README.md", "AGENTS.md", "docs/template-contract.md", ".github/workflows/ci.yml", "tests/helpers.ts", "examples/palette-sheet.template.ts", "bin/render"]) {
    assert.ok(scanned.includes(path), `${path} is not scanned`)
  }
  assert.ok(scanned.length >= 22, `only ${scanned.length} files scanned`)
  assert.deepEqual(tree(repoRoot).binary, [], "the repository holds a file the walk treats as binary")
})

test("the lists are explicit: long enough to mean something, and free of a term that is not one", () => {
  assert.ok(CONSUMERS.length >= 35, `only ${CONSUMERS.length} consumer names`)
  assert.ok(FORMATS.length >= 10, `only ${FORMATS.length} carrier formats`)
  for (const term of [...CONSUMERS, ...FORMATS]) {
    assert.equal(term, term.toLowerCase(), `${term} is not lower case`)
    assert.ok(term.trim().length > 0, "a term is empty")
  }
  assert.equal(new Set(CONSUMERS).size, CONSUMERS.length, "a consumer name is listed twice")
  assert.equal(new Set(FORMATS).size, FORMATS.length, "a carrier format is listed twice")
  assert.deepEqual(FORMATS.filter((term) => SELF_FORMATS.includes(term)), [], "a term is both forbidden and exempt")
  assert.equal(new Set(SELF_FORMATS).size, SELF_FORMATS.length)
})

test("every planted name is caught, whatever the list says", async () => {
  await withTempDir((dir) => {
    PINNED_CONSUMERS.forEach((sentence, index) => writeInto(join(dir, `consumer-${index}.txt`), `${sentence}\n`))
    PINNED_FORMATS.forEach((sentence, index) => writeInto(join(dir, `format-${index}.txt`), `${sentence}\n`))
    const consumerHits = scan(CONSUMERS, dir)
    const formatHits = scan(FORMATS, dir)
    PINNED_CONSUMERS.forEach((_sentence, index) => {
      assert.ok(consumerHits.some((entry) => entry.startsWith(`consumer-${index}.txt:`)), `planted consumer sample ${index} was not caught`)
    })
    PINNED_FORMATS.forEach((_sentence, index) => {
      assert.ok(formatHits.some((entry) => entry.startsWith(`format-${index}.txt:`)), `planted carrier-format sample ${index} was not caught`)
    })
  })
})

test("the exemption for this repository's own formats is real, not a hole", () => {
  // The exempt words are in the tree, which is why the scan cannot simply ban
  // every format word: the schema, the record and the example's own output
  // syntax are named in prose.
  for (const term of SELF_FORMATS) {
    assert.ok(
      tree(repoRoot).text.some((path) => readFileSync(join(repoRoot, path), "utf8").toLowerCase().includes(term)),
      `${term} is exempt but appears nowhere, so the exemption hides nothing`,
    )
  }
})

test("the matcher catches a name as a word and not inside a longer one", () => {
  assert.ok(pattern("kitty").test("a fragment for kitty lives here"), "the matcher misses a consumer name")
  assert.ok(pattern("this machine").test("written for THIS MACHINE"), "the matcher misses a phrase")
  assert.ok(!pattern("kitty").test("kittycorn"), "the matcher is matching inside a longer word")
})

test("nothing in the repository names a consumer, a product or a toolkit", () => {
  assert.deepEqual(scan(CONSUMERS), [])
})

test("nothing in the repository names a carrier format", () => {
  assert.deepEqual(scan(FORMATS), [])
})

test("nothing in the repository describes the machine, its owner or the run that wrote it", () => {
  assert.deepEqual(scan(PROVENANCE), [])
})
