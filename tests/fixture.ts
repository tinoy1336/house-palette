/**
 * fixture.ts — shared test helper: render into a throwaway root.
 *
 * The revision is pinned so two renders of the same source are byte-identical
 * and the committed goldens do not move with the repository's own history.
 */

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadPalette } from "../src/palette.ts"
import { readSource, renderAll, type RenderedFile, repoRoot, type Roots, writeFiles } from "../src/render.ts"

export const FIXTURE_REVISION = "fixture"

export function fixtureRoots(root: string): Roots {
  return { home: root, tinshell: join(root, "tinshell") }
}

export function renderInto(root: string, names?: string[]): RenderedFile[] {
  process.env.HOUSE_PALETTE_REVISION = FIXTURE_REVISION
  const palette = loadPalette(join(repoRoot, "palette.json"))
  const files = renderAll(palette, readSource(), fixtureRoots(root), names)
  writeFiles(files)
  return files
}

/** What a render would write, without touching the tree: the drift check's own input. */
export function renderOnly(root: string, names?: string[]): RenderedFile[] {
  process.env.HOUSE_PALETTE_REVISION = FIXTURE_REVISION
  const palette = loadPalette(join(repoRoot, "palette.json"))
  return renderAll(palette, readSource(), fixtureRoots(root), names)
}

export function renderInMemory(names?: string[]): RenderedFile[] {
  process.env.HOUSE_PALETTE_REVISION = FIXTURE_REVISION
  const palette = loadPalette(join(repoRoot, "palette.json"))
  return renderAll(palette, readSource(), { home: "/fixture", tinshell: "/fixture/tinshell" }, names)
}

export function withTempFixture<T>(body: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "house-palette-"))
  try {
    return body(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
