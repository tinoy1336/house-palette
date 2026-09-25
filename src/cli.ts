/**
 * cli.ts — the command line over the renderer.
 *
 *   bin/render                          render and write every target
 *   bin/render --check                  compare what a render would write
 *                                       against the files on disk
 *   bin/render --target kitty-palette   one target only, repeatable
 *   bin/render --out <dir>              fixture root in place of $HOME
 *   bin/render --tinshell <dir>         fixture root in place of ../tinshell
 *   bin/render --list                   the targets, held-back entries and apply steps
 *
 * `--check` exits 1 on any drift so a hook can use it unchanged.
 */

import { join } from "node:path"
import { loadPalette } from "./palette.ts"
import { checkFiles, readSource, renderAll, repoRoot, type Roots, writeFiles } from "./render.ts"
import { applySteps, heldBackTargets, targets } from "./targets.ts"

const USAGE = `usage: bin/render [--write | --check] [--target <name>]... [--out <dir>] [--tinshell <dir>] [--list]

  --write      write every rendered file (the default)
  --check      compare a render against the files on disk; exit 1 on drift
  --target     restrict the run to a target, repeatable
  --out        root for {home} destinations (default: $HOME)
  --tinshell   root for {tinshell} destinations (default: ../tinshell)
  --list       print the target registry and exit
`

type Options = {
  action: "write" | "check" | "list"
  targets?: string[]
  roots: Roots
}

export function parseArgs(argv: string[], home: string | undefined): Options {
  const selected: string[] = []
  let action: "write" | "check" | "list" | undefined
  let out: string | undefined
  let tinshell: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string
    const next = () => {
      index += 1
      const value = argv[index]
      if (value === undefined) throw new Error(`${arg} needs a value`)
      return value
    }
    switch (arg) {
      case "--check":
        if (action === "write") throw new Error("--check and --write are mutually exclusive")
        action = "check"
        break
      case "--write":
        if (action === "check") throw new Error("--check and --write are mutually exclusive")
        action = "write"
        break
      case "--list":
        action = "list"
        break
      case "--target":
        selected.push(next())
        break
      case "--out":
        out = next()
        break
      case "--tinshell":
        tinshell = next()
        break
      case "--help":
      case "-h":
        action = "list"
        break
      default:
        throw new Error(`unknown argument: ${arg}`)
    }
  }

  const homeRoot = out ?? home
  if (homeRoot === undefined) throw new Error("no home root: pass --out or set HOME")
  return {
    action: action ?? "write",
    targets: selected.length > 0 ? selected : undefined,
    roots: { home: homeRoot, tinshell: tinshell ?? join(repoRoot, "..", "tinshell") },
  }
}

export function main(argv: string[], home: string | undefined = process.env.HOME): number {
  let options: Options
  try {
    options = parseArgs(argv, home)
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`)
    return 2
  }

  if (options.action === "list") {
    process.stdout.write(list())
    return 0
  }

  try {
    const palette = loadPalette(join(repoRoot, "palette.json"))
    const source = readSource()
    const files = renderAll(palette, source, options.roots, options.targets)
    if (options.action === "write") {
      writeFiles(files)
      process.stdout.write(`wrote ${files.length} files\n`)
      return 0
    }
    const drift = checkFiles(files)
    if (drift.length === 0) {
      process.stdout.write(`checked ${files.length} files: clean\n`)
      return 0
    }
    for (const entry of drift) process.stdout.write(`${entry.kind} ${entry.path}\n`)
    process.stdout.write(`${drift.length} of ${files.length} files drifted\n`)
    return 1
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    return 2
  }
}

function list(): string {
  const lines = [USAGE, "targets:"]
  for (const target of targets) lines.push(`  ${target.name} -> ${target.destination} (${target.syntax})`)
  lines.push("", "held back:")
  for (const entry of heldBackTargets) lines.push(`  ${entry.name} (${entry.syntax})`)
  lines.push("", "apply steps a consumer performs:")
  for (const step of applySteps) lines.push(`  ${step.name} -> ${step.destination}`)
  return `${lines.join("\n")}\n`
}
