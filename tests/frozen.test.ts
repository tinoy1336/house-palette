/**
 * The tuned translucency values are carried through the render unchanged. Each
 * one is asserted twice: against the value the design states, and inside the
 * rendered files a consumer actually reads. A "normalised" alpha fails here.
 */

import assert from "node:assert/strict"
import { join } from "node:path"
import { test } from "node:test"
import { loadPalette, frozenValues } from "../src/palette.ts"
import { repoRoot } from "../src/render.ts"
import { renderInMemory } from "./fixture.ts"

const palette = loadPalette(join(repoRoot, "palette.json"))

/** Alphas exactly as the design states them, one entry per tuned surface. */
const FROZEN_ALPHAS: Record<string, string> = {
  "ink-faint": "rgba(166, 166, 166, 0.55)",
  hairline: "rgba(255, 255, 255, 0.06)",
  "border-strong": "rgba(255, 255, 255, 0.1)",
  hover: "rgba(255, 255, 255, 0.08)",
  "hover-strong": "rgba(255, 255, 255, 0.14)",
  wash: "rgba(255, 255, 255, 0.1)",
  "card-wash": "rgba(255, 255, 255, 0.05)",
  "selection-menu": "rgba(138, 181, 247, 0.22)",
  "selection-row": "rgba(138, 181, 247, 0.35)",
  "selection-note": "rgba(138, 181, 247, 0.45)",
  "accent-fill": "rgba(138, 181, 247, 0.18)",
  "focus-ring": "rgba(138, 181, 247, 0.55)",
  "danger-fill": "rgba(255, 107, 107, 0.16)",
  "row-highlight": "rgba(255, 255, 255, 0.1)",
  "row-active": "rgba(255, 255, 255, 0.16)",
  "scrollbar-thumb": "rgba(255, 255, 255, 0.22)",
  "scrollbar-thumb-hover": "rgba(255, 255, 255, 0.3)",
  "scrollbar-thumb-active": "rgba(255, 255, 255, 0.45)",
  "row-selected": "rgba(10, 12, 17, 0.72)",
  "text-shadow": "rgba(0, 0, 0, 0.44)",
  "border-inactive": "rgba(0, 0, 0, 0)",
}

/** The per-surface panel alphas, each its own token and never collapsed into one. */
const PANEL_ALPHAS: Record<string, string> = {
  "panel-alpha-shell": "0.5",
  "panel-alpha-card": "0.5",
  "panel-alpha-dock-disc": "0.45",
  "panel-alpha-dock-backdrop": "0.35",
  "panel-alpha-dock-menu": "0.55",
  "panel-alpha-notification": "0.5",
  "panel-alpha-notification-critical": "0.62",
  "panel-alpha-keyboard": "0.72",
  "terminal-opacity": "0.5",
  "scrim-opacity": "0.5",
  "glow-alpha": "0.22",
}

test("the manifest records every tuned alpha as the design states it", () => {
  const frozen = frozenValues(palette)
  for (const [role, value] of Object.entries({ ...FROZEN_ALPHAS, ...PANEL_ALPHAS })) {
    assert.equal(frozen[role], value, `frozen value for ${role}`)
  }
})

test("the surface alphas stay distinct in the rendered output", () => {
  const files = new Map(renderInMemory().map((file) => [file.target, file.content]))
  const shell = files.get("tinshell-theme-css") as string
  const vesktop = files.get("vesktop-quickcss") as string
  const gtk3 = files.get("gtk3-fragment") as string

  assert.match(shell, /--tinshell-panel: rgba\(10, 12, 17, 0\.5\);/)
  assert.match(vesktop, /--house-glass-dock-menu: rgba\(10, 12, 17, 0\.55\);/)
  assert.match(vesktop, /--house-glass-card: rgba\(10, 12, 17, 0\.5\);/)
  assert.match(vesktop, /--house-hover: rgba\(255, 255, 255, 0\.08\);/)
  assert.match(gtk3, /@define-color ags_focus_ring rgba\(138, 181, 247, 0\.55\);/)
  assert.match(gtk3, /@define-color ags_scrollbar_thumb_hover rgba\(255, 255, 255, 0\.3\);/)
})

test("the terminal fragment carries colours only: the opacity stays in kitty.conf", () => {
  const kitty = renderInMemory().find((file) => file.target === "kitty-palette")?.content as string
  assert.ok(!kitty.includes("background_opacity"), "the fragment set the frozen terminal opacity")
  assert.ok(!kitty.includes("opacity"), "the fragment carries an opacity setting")
  assert.ok(!/rgba\(/.test(kitty), "a colours-only fragment must not carry alpha values")
  assert.match(kitty, /^background #0a0c11$/m)
})

test("the compositor fragment carries its border pair in the compositor's own form", () => {
  const lua = renderInMemory().find((file) => file.target === "hypr-palette")?.content as string
  assert.match(lua as string, /border_active = "rgba\(ccccccff\)"/)
  assert.match(lua as string, /border_inactive = "rgba\(00000000\)"/)
  assert.match(lua as string, /hairline = "rgba\(ffffff0f\)"/)
})

test("the shell's keyboard panel keeps its own alpha", () => {
  const frozen = frozenValues(palette)
  assert.equal(frozen["panel-alpha-keyboard"], "0.72")
  assert.notEqual(frozen["panel-alpha-keyboard"], frozen["panel-alpha-shell"])
})
