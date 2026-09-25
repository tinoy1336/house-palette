/**
 * helpers.ts — the scaffolding every test shares: a throwaway directory, a
 * template file written into it, and a run of the command that reads its exit
 * code back.
 */

import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { main, type Streams } from "../src/cli.ts"
import { repoRoot } from "../src/engine.ts"

export const repoPalette = join(repoRoot, "palette.json")
export const exampleTemplate = join(repoRoot, "examples", "palette-sheet.template.ts")
export const binRender = join(repoRoot, "bin", "render")

export async function withTempDir<T>(body: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "palette-test-"))
  try {
    return await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function writeInto(path: string, content: string): string {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return path
}

/** A template module that returns fixed text: the smallest module satisfying the contract. */
export function literalTemplate(dir: string, body: string, name = "template.ts"): string {
  return writeInto(join(dir, name), `export default { render: () => ${JSON.stringify(body)} }\n`)
}

export type RunResult = { code: number; out: string[]; err: string[] }

/** Runs the command in this process, capturing both streams. */
export async function run(argv: string[]): Promise<RunResult> {
  const out: string[] = []
  const err: string[] = []
  const streams: Streams = { out: (line) => out.push(line), err: (line) => err.push(line) }
  const code = await main(argv, streams)
  return { code, out, err }
}

/** Runs the real entry point as its own process, from a chosen working directory. */
export function runInProcess(cwd: string, argv: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [binRender, ...argv], { cwd, encoding: "utf8", timeout: 60000 })
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}
