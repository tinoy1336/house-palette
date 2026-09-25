/**
 * The repository is generic, and this file is what keeps it that way: no
 * consumer, product or toolkit name, no carrier format name, and nothing about
 * the desktop it was built on appears in the palette, the renderer, the example,
 * the tests or the docs.
 *
 * This file is the one exception, because the refused vocabulary has to be
 * written down somewhere; it excludes itself from its own scan, and the matcher
 * is proved against a string it must catch so that a scan finding nothing is a
 * statement about the tree rather than about the list.
 */

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { hostname, userInfo } from "node:os"
import { extname, join, relative } from "node:path"
import { test } from "node:test"
import { repoRoot } from "../src/engine.ts"

/** Names of consumers, products and toolkits: none of them may be a palette key, a purpose, or a line of the renderer. */
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
  "neovim",
  "nvim",
  "alacritty",
  "wezterm",
  "spicetify",
]

/** Carrier format names: the palette names a value for its purpose, never for the file it lands in. */
const FORMATS = ["css", "scss", "ini", "lua", "conf", "toml", "yaml", "xml", "html"]

/** Nothing may read as a note about the machine, its owner or the session that wrote it. */
const PROVENANCE = ["this machine", "my machine", "the owner", "the maintainer", "/home/", "/Users/", "session", "subagent", "foreman", "worker", "crew"]

const SELF = "tests/vocabulary.test.ts"
const SCANNED = [".ts", ".json", ".md", ".yml", ".yaml", ""]

function files(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      const extension = extname(entry.name)
      if (SCANNED.includes(extension) || entry.name === "render") found.push(relative(repoRoot, path))
    }
  }
  walk(repoRoot)
  return found.filter((path) => path !== SELF).sort()
}

function pattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return term.includes("/") || term.includes(" ") ? new RegExp(escaped, "i") : new RegExp(`\\b${escaped}\\b`, "i")
}

function scan(terms: string[]): string[] {
  const violations: string[] = []
  for (const path of files()) {
    const content = readFileSync(join(repoRoot, path), "utf8")
    for (const term of terms) if (pattern(term).test(content)) violations.push(`${path}: ${term}`)
  }
  return violations
}

test("the scan is not vacuous: it reads the repository and catches a string it must", () => {
  const scanned = files()
  assert.ok(scanned.includes("palette.json"), "the palette source is not scanned")
  assert.ok(scanned.includes("src/engine.ts"), "the renderer is not scanned")
  assert.ok(scanned.includes("README.md"), "the README is not scanned")
  assert.ok(scanned.length >= 15, `only ${scanned.length} files scanned`)
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

test("nothing in the repository describes the machine, its owner or the session", () => {
  assert.deepEqual(scan([...PROVENANCE, hostname(), userInfo().username]), [])
})
