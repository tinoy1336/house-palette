/**
 * engine.ts — the renderer's whole job: load a template, hand it the palette
 * and the colour helpers, write what it returns, and record enough for a
 * consumer to gate its own generated files.
 *
 * It knows nothing about any consumer: no destination is decided here, no
 * output syntax is understood here, and the palette is not modified. A render is
 * computed in memory first, so a template that throws leaves the tree alone; the
 * write itself goes to a temporary file and is renamed into place, so a file is
 * never half written.
 */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import * as colourModule from "./colour.ts"
import { loadPalette, type Palette } from "./palette.ts"

/** The colour helpers a template receives, as one frozen object: a template cannot replace a helper. */
export const colour = Object.freeze({ ...colourModule })

export type ColourHelper = typeof colourModule

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

/** The palette source a run reads when the caller names none. */
export const defaultPalettePath = resolve(repoRoot, "palette.json")

/** Recorded as the producer of a rendered file. */
export const GENERATOR = "house-palette"

export type TemplateContext = {
  palette: Palette
  colour: ColourHelper
  provenance: Provenance
}

export type Provenance = {
  generator: string
  template: { sha256: string }
  palette: { sha256: string; revision: string }
}

/** What a template module must be: an ES module whose default export carries `render`. */
export type Template = { render(context: TemplateContext): string }

/** What produced one output. Identity is by content digest, so no path and no machine reaches a consumer's repository. */
export type RenderRecord = {
  version: 1
  template: { sha256: string }
  palette: { sha256: string; revision: string }
  output: { sha256: string }
}

export type RenderRequest = {
  template: string
  out: string
  palette: string
  revision?: string
  record?: string
}

export type RenderPlan = {
  content: string
  record: RenderRecord
  palette: { sha256: string; revision: string }
  templateDigest: string
}

export function sha256(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex")
}

export function shortDigest(digest: string): string {
  return digest.slice(0, 12)
}

/** The palette revision recorded in a run: the palette's own commit when it sits in a repository, otherwise `unversioned`. */
export function paletteRevision(palettePath: string): string {
  try {
    const revision = execFileSync("git", ["-C", dirname(resolve(palettePath)), "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim()
    return revision === "" ? "unversioned" : revision
  } catch {
    return "unversioned"
  }
}

export function loadPaletteRevision(palettePath: string, revision?: string): { palette: Palette; sha256: string; revision: string } {
  let text: string
  try {
    text = readFileSync(palettePath, "utf8")
  } catch (error) {
    throw new Error(`palette ${palettePath} could not be read: ${(error as Error).message}`)
  }
  return {
    palette: loadPalette(palettePath),
    sha256: sha256(text),
    revision: revision ?? paletteRevision(palettePath),
  }
}

/**
 * Imports the template module. A module with no default export, or one whose
 * default export carries no `render` function, is refused here rather than
 * failing later with a less specific message.
 */
export async function loadTemplate(templatePath: string): Promise<Template> {
  const expected = `template ${templatePath} must export default an object with a render(context) method`
  let loaded: unknown
  try {
    loaded = await import(pathToFileURL(resolve(templatePath)).href)
  } catch (error) {
    throw new Error(`template ${templatePath} could not be loaded: ${(error as Error).message}`)
  }
  const candidate = (loaded as { default?: unknown }).default
  if (typeof candidate !== "object" || candidate === null) throw new Error(expected)
  if (typeof (candidate as Template).render !== "function") throw new Error(expected)
  return candidate as Template
}

/** Renders in memory: nothing is written, so a failure costs no file. */
export async function planRender(request: RenderRequest): Promise<RenderPlan> {
  const loaded = loadPaletteRevision(request.palette, request.revision)
  let templateText: string
  try {
    templateText = readFileSync(request.template, "utf8")
  } catch (error) {
    throw new Error(`template ${request.template} could not be read: ${(error as Error).message}`)
  }
  const templateDigest = sha256(templateText)
  const template = await loadTemplate(request.template)
  const provenance: Provenance = Object.freeze({
    generator: GENERATOR,
    template: Object.freeze({ sha256: templateDigest }),
    palette: Object.freeze({ sha256: loaded.sha256, revision: loaded.revision }),
  })
  const context: TemplateContext = Object.freeze({ palette: loaded.palette, colour, provenance })
  const returned: unknown = template.render(context)
  if (typeof returned !== "string") {
    throw new Error(`template ${request.template} returned ${returned === null ? "null" : typeof returned}; a template returns the exact text of its output`)
  }
  return {
    content: returned,
    record: {
      version: 1,
      template: { sha256: templateDigest },
      palette: { sha256: loaded.sha256, revision: loaded.revision },
      output: { sha256: sha256(returned) },
    },
    palette: { sha256: loaded.sha256, revision: loaded.revision },
    templateDigest,
  }
}

export function serialiseRecord(record: RenderRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`
}

/** Writes whole or not at all: a temporary file beside the destination, then a rename. */
export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  try {
    writeFileSync(temporary, content)
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

export function writePlan(plan: RenderPlan, request: RenderRequest): void {
  writeFile(request.out, plan.content)
  if (request.record !== undefined) writeFile(request.record, serialiseRecord(plan.record))
}

/** How an output on disk differs from what a render would write, or undefined when it is current. */
export function compareOutput(path: string, content: string): "missing" | "stale" | undefined {
  if (!existsSync(path)) return "missing"
  return readFileSync(path, "utf8") === content ? undefined : "stale"
}

/**
 * Reads a stored record, refusing anything that is not one: a file whose fields
 * are missing or malformed cannot answer for an output, so it ends the run as a
 * render that could not happen rather than as drift.
 */
export function readRecord(path: string): RenderRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    throw new Error(`record ${path} could not be read: ${(error as Error).message}`)
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`record ${path} is not a record: it is not an object`)
  }
  const record = parsed as Partial<RenderRecord>
  const isDigest = (value: unknown): boolean => typeof value === "string" && /^[0-9a-f]{64}$/.test(value)
  if (record.version !== 1) throw new Error(`record ${path} is not a record: version must be 1`)
  if (!isDigest(record.template?.sha256)) throw new Error(`record ${path} is not a record: template.sha256 must be a sha256 digest`)
  if (!isDigest(record.palette?.sha256)) throw new Error(`record ${path} is not a record: palette.sha256 must be a sha256 digest`)
  if (typeof record.palette?.revision !== "string" || record.palette.revision === "") {
    throw new Error(`record ${path} is not a record: palette.revision must be a revision string`)
  }
  if (!isDigest(record.output?.sha256)) throw new Error(`record ${path} is not a record: output.sha256 must be a sha256 digest`)
  return record as RenderRecord
}

/**
 * The fields of a stored record that no longer match the run that would produce
 * it. Only content decides this: the template bytes, the palette bytes and the
 * output bytes. The palette revision is provenance — it says which checkout a
 * render came from — so a checkout that moved with the same palette is current,
 * and a gate never fails over it.
 */
export function differingFields(expected: RenderRecord, found: RenderRecord): string[] {
  const differences: string[] = []
  const compare = (label: string, a: string | number | undefined, b: string | number | undefined) => {
    if (a === b) return
    differences.push(`${label}: recorded ${String(b)}, now ${String(a)}`)
  }
  compare("record version", expected.version, found.version)
  compare("template sha256", expected.template?.sha256, found.template?.sha256)
  compare("palette sha256", expected.palette?.sha256, found.palette?.sha256)
  compare("output sha256", expected.output?.sha256, found.output?.sha256)
  return differences
}
