/**
 * palette.ts — loads the palette source, proves it satisfies its schema, and
 * resolves it into the frozen token table a template receives.
 *
 * Three rules decide the shape of that table:
 *
 *   - A token carries the value it resolves to, never a formula a template
 *     would have to evaluate: a template reads `token.hex`, `token.alpha` and
 *     `token.solid` and formats them itself.
 *   - An unresolved name is an error, not an empty value: a template that asks
 *     for a token the palette does not hold fails the render.
 *   - A template cannot change the palette: the table and every token in it are
 *     frozen.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { blendTowardWhite, compositeOver, rotateHue } from "./colour.ts"
import { formatErrors, validate } from "./schema.ts"

export type Token = {
  /** The full name, `group.key`; the same string is the key in the token table. */
  name: string
  group: string
  /** One sentence stating what the value is for. */
  purpose: string
  hex?: string
  alpha?: number
  /** The opaque stand-in: what this token reads as on `surface.base`, for a carrier that cannot express opacity. Absent for a token with no colour. */
  solid?: string
  /** The token this one is an alias of, when it holds no value of its own. */
  alias?: string
  frozen: boolean
}

export type Palette = {
  version: number
  /** Every token by full name, in source order. */
  tokens: Readonly<Record<string, Token>>
  /** The token named `name`; throws when the palette holds no such token. */
  find(name: string): Token
}

type RawToken = {
  hex?: string
  alpha?: number
  alias?: string
  derive?: { op: string; from: string; amount?: number; degrees?: number; over?: string }
  purpose: string
  frozen?: boolean
}

type RawPalette = {
  version: number
  groups: Record<string, Record<string, RawToken>>
  composites: Record<string, string>
}

/** Names every token in source order, with the group it sits in. */
function flatten(raw: RawPalette): { name: string; group: string; token: RawToken }[] {
  return Object.entries(raw.groups).flatMap(([group, tokens]) =>
    Object.entries(tokens).map(([key, token]) => ({ name: `${group}.${key}`, group, token })),
  )
}

export function loadPalette(palettePath: string): Palette {
  const raw = JSON.parse(readFileSync(palettePath, "utf8")) as RawPalette
  const schemaPath = join(dirname(palettePath), "palette.schema.json")
  const errors = validate(JSON.parse(readFileSync(schemaPath, "utf8")), raw)
  if (errors.length > 0) throw new Error(`${palettePath} does not satisfy ${schemaPath}:\n${formatErrors(errors)}`)
  return buildPalette(raw)
}

export function buildPalette(raw: RawPalette): Palette {
  const entries = flatten(raw)
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const resolved = new Map<string, Token>()

  /** The opaque colour every translucent token is composited over. A translucent base would make that arithmetic meaningless. */
  const surfaceBase = (): Token => {
    const entry = byName.get("surface.base")
    if (entry === undefined) throw new Error("the palette holds no surface.base: it is the base every translucent token composites over")
    if (entry.token.hex === undefined || entry.token.alpha !== undefined) throw new Error("surface.base must be an opaque colour: it is the base every translucent token composites over")
    return record("surface.base", [])
  }

  const record = (name: string, seen: string[]): Token => {
    const cached = resolved.get(name)
    if (cached !== undefined) return cached
    if (seen.includes(name)) throw new Error(`alias cycle: ${[...seen, name].join(" -> ")}`)
    const entry = byName.get(name)
    if (entry === undefined) throw new Error(`no such token: ${name}`)
    const base = { name, group: entry.group, purpose: entry.token.purpose, frozen: entry.token.frozen === true }
    const { hex, alpha, alias, derive } = entry.token

    if (alias !== undefined) {
      const target = record(alias, [...seen, name])
      // An alias of a tuned value is tuned as well: it carries the same decision.
      const token = frozen({ ...base, alias, hex: target.hex, alpha: target.alpha, solid: target.solid, frozen: base.frozen || target.frozen })
      resolved.set(name, token)
      return token
    }

    if (derive !== undefined) {
      const target = record(derive.from, [...seen, name])
      let value: string
      if (derive.op === "blend-toward-white") value = blendTowardWhite(requireHex(target, derive.op), derive.amount as number)
      else if (derive.op === "rotate-hue") value = rotateHue(requireHex(target, derive.op), derive.degrees as number)
      else if (derive.op === "composite") {
        const baseToken = record(derive.over as string, [...seen, name])
        if (target.alpha === undefined) throw new Error(`${name}: composite derives from ${derive.from}, which carries no alpha`)
        if (baseToken.alpha !== undefined) throw new Error(`${name}: composite derives over ${baseToken.name}, which carries its own opacity`)
        value = compositeOver(requireHex(target, derive.op), target.alpha, requireHex(baseToken, derive.op))
      } else throw new Error(`${name}: unknown derive op ${derive.op}`)
      const token = frozen({ ...base, hex: value, solid: value })
      resolved.set(name, token)
      return token
    }

    if (hex !== undefined && alpha !== undefined) {
      const declared = raw.composites[name]
      const token = frozen({ ...base, hex, alpha, solid: declared ?? compositeOver(hex, alpha, requireHex(surfaceBase(), "composite")) })
      resolved.set(name, token)
      return token
    }

    const token = frozen({ ...base, hex, alpha })
    resolved.set(name, token)
    return token
  }

  const tokens: Record<string, Token> = {}
  for (const entry of entries) tokens[entry.name] = record(entry.name, [])

  for (const name of Object.keys(raw.composites)) {
    const token = tokens[name]
    if (token === undefined) throw new Error(`composite names a token the palette does not hold: ${name}`)
    if (token.hex === undefined || token.alpha === undefined) throw new Error(`composite names a token that carries no opacity: ${name}`)
  }

  const table = Object.freeze(tokens)
  return Object.freeze({
    version: raw.version,
    tokens: table,
    find(name: string): Token {
      const token = table[name]
      if (token === undefined) throw new Error(`no such token: ${name}`)
      return token
    },
  })
}

function requireHex(token: Token, op: string): string {
  if (token.hex === undefined) throw new Error(`${op} needs a colour, but ${token.name} carries none`)
  return token.hex
}

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value)
}
