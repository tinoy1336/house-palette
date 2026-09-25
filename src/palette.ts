/**
 * palette.ts — reads the source and turns it into the flat token table the
 * templates address by name.
 *
 * Two rules decide the shape of that table:
 *
 *   - A token is derived from a role, never spelled twice. A template asks for
 *     `accent` or `hairline.css`, never for a hex.
 *   - A role that is not there is an error, not an empty string: an unresolved
 *     placeholder fails the render, so a stale template cannot ship a blank
 *     colour.
 */

import { readFileSync } from "node:fs"
import { blendTowardWhite, compositeOver, formatAlpha, parseHex, toCss, toHypr, toRgbTriple } from "./colour.ts"

export type RoleObject = {
  hex?: string
  alpha?: number
  frozen?: boolean
  note?: string
  derive?: string
  alias?: string
}
export type RoleValue = string | RoleObject

export type Palette = {
  version: number
  roles: Record<string, RoleValue>
  syntax: Record<string, string>
  composites: Record<string, string>
  ansi: Record<string, string>
}

/** Panel-base at one surface's own alpha. The surface list is the whole reason the alphas are roles. */
const GLASS_SURFACES: Record<string, { base: string; alpha: string }> = {
  shell: { base: "panel-base", alpha: "panel-alpha-shell" },
  card: { base: "panel-base", alpha: "panel-alpha-card" },
  "dock-disc": { base: "panel-base", alpha: "panel-alpha-dock-disc" },
  "dock-backdrop": { base: "panel-base", alpha: "panel-alpha-dock-backdrop" },
  "dock-menu": { base: "panel-base", alpha: "panel-alpha-dock-menu" },
  notification: { base: "panel-base", alpha: "panel-alpha-notification" },
  "notification-critical": { base: "panel-base", alpha: "panel-alpha-notification-critical" },
  keyboard: { base: "keyboard-panel-base", alpha: "panel-alpha-keyboard" },
}

export function loadPalette(path: string): Palette {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (typeof parsed !== "object" || parsed === null) throw new Error(`${path}: not an object`)
  const palette = parsed as Palette
  if (palette.version !== 1) throw new Error(`${path}: unsupported version ${String(palette.version)}`)
  for (const [name, value] of Object.entries(palette.roles)) assertRole(path, name, value)
  return palette
}

function assertRole(path: string, name: string, value: RoleValue): void {
  if (typeof value === "string") {
    parseHex(value)
    return
  }
  if (typeof value !== "object" || value === null) throw new Error(`${path}: role ${name} is neither a hex string nor an object`)
  if (value.alias !== undefined) {
    if (Object.keys(value).some((key) => key !== "alias" && key !== "note")) throw new Error(`${path}: role ${name} carries an alias with extra value fields`)
    return
  }
  if (value.hex !== undefined) parseHex(value.hex)
  if (value.hex === undefined && value.alpha === undefined) throw new Error(`${path}: role ${name} has neither a hex nor an alpha`)
  if (value.alpha !== undefined && (value.alpha < 0 || value.alpha > 1)) throw new Error(`${path}: role ${name} alpha ${value.alpha} outside 0–1`)
  if (value.hex !== undefined && value.alpha !== undefined && value.alpha === 1) throw new Error(`${path}: role ${name} carries alpha 1; make it a solid hex instead`)
}

/** Follows an alias chain to the role that actually holds the value. */
export function resolveRole(palette: Palette, name: string): string {
  const seen = new Set<string>()
  let current = name
  while (true) {
    if (seen.has(current)) throw new Error(`alias cycle at role ${current}`)
    seen.add(current)
    const value = palette.roles[current]
    if (value === undefined) throw new Error(`no such role: ${current}`)
    if (typeof value === "object" && value.alias !== undefined) {
      current = value.alias
      continue
    }
    return current
  }
}

export function roleRecord(palette: Palette, name: string): RoleObject {
  const resolved = resolveRole(palette, name)
  const value = palette.roles[resolved]
  if (typeof value === "string") return { hex: value }
  return value
}

export function roleHex(palette: Palette, name: string): string {
  const role = roleRecord(palette, name)
  if (role.hex === undefined) throw new Error(`role ${name} carries no colour`)
  return role.hex
}

export function roleAlpha(palette: Palette, name: string): number | undefined {
  return roleRecord(palette, name).alpha
}

/**
 * The opaque stand-in for an alpha-carrying role: the value the source declares
 * in `composites` when it has one (those were tuned by eye against this base),
 * otherwise the role composited over panel-base with the same rounding rule as
 * every other derivation.
 */
export function solidValue(palette: Palette, name: string): string {
  const resolved = resolveRole(palette, name)
  const declared = palette.composites[resolved]
  if (declared !== undefined) return declared
  const role = roleRecord(palette, resolved)
  if (role.hex === undefined) throw new Error(`role ${resolved} carries no colour`)
  if (role.alpha === undefined) return role.hex
  return compositeOver(role.hex, role.alpha, roleHex(palette, "panel-base"))
}

/**
 * Every token a template may address, flattened to strings.
 *
 * Per role: the bare name, `.hex`, `.alpha`, `.rgb`, `.css`, `.hypr` and
 * `.solid`. An alias publishes the aliased role's whole token set under its own
 * name, so `divider.css` and `hairline.css` cannot disagree.
 */
export function tokenMap(palette: Palette): Map<string, string> {
  const tokens = new Map<string, string>()

  const publish = (name: string, resolved: string) => {
    const role = roleRecord(palette, resolved)
    const hex = role.hex
    const alpha = role.alpha
    if (alpha !== undefined) tokens.set(`${name}.alpha`, formatAlpha(alpha))
    if (hex === undefined) {
      // An alpha-only role (a halo's strength, say) publishes its number as the
      // bare token and nothing else.
      if (alpha !== undefined) tokens.set(name, formatAlpha(alpha))
      return
    }
    tokens.set(name, hex)
    tokens.set(`${name}.hex`, hex)
    tokens.set(`${name}.rgb`, toRgbTriple(hex))
    tokens.set(`${name}.css`, toCss(hex, alpha))
    tokens.set(`${name}.hypr`, toHypr(hex, alpha))
    tokens.set(`${name}.solid`, solidValue(palette, resolved))
    tokens.set(`${name}.solid.rgb`, toRgbTriple(solidValue(palette, resolved)))
  }

  for (const name of Object.keys(palette.roles)) publish(name, resolveRole(palette, name))

  for (const [surface, { base, alpha }] of Object.entries(GLASS_SURFACES)) {
    const glass = toCss(roleHex(palette, base), roleAlpha(palette, alpha))
    tokens.set(`glass.${surface}.css`, glass)
    tokens.set(`glass.${surface}.solid`, solidValue(palette, base))
  }

  for (const [slot, binding] of Object.entries(palette.ansi)) {
    const bright = binding.startsWith("bright:")
    const name = bright ? binding.slice("bright:".length) : binding
    const { hex } = roleRecord(palette, name)
    if (hex === undefined) throw new Error(`ansi slot ${slot} points at a role with no colour: ${name}`)
    // A bright slot is the same role 25 percent closer to white: the terminal
    // palette has no second step for these hues, and a borrowed one would leave
    // the family.
    tokens.set(`ansi.${slot}`, bright ? blendTowardWhite(hex, 0.25) : hex)
  }

  for (const [name, composite] of Object.entries(palette.composites)) tokens.set(`composite.${name}`, composite)

  return tokens
}

/** Frozen roles as written for the manifest: the value a consumer may read back, unchanged. */
export function frozenValues(palette: Palette): Record<string, string> {
  const frozen: Record<string, string> = {}
  for (const [name, value] of Object.entries(palette.roles)) {
    if (typeof value === "string" || value.frozen !== true) continue
    frozen[name] = value.hex === undefined ? formatAlpha(value.alpha ?? 0) : toCss(value.hex, value.alpha)
  }
  return Object.fromEntries(Object.entries(frozen).sort(([a], [b]) => (a < b ? -1 : 1)))
}
