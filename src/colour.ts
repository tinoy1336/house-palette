/**
 * colour.ts — colour arithmetic for the renderer.
 *
 * Every derivation the artifact promises is computed here and asserted against
 * the value the source records, so a wrong number is caught by a test rather
 * than discovered in a stylesheet. Rounding is `Math.round` per channel, which
 * is the rule the derived values in the source were produced with.
 */

export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }

const HEX_PATTERN = /^#[0-9a-f]{6}$/

/** Parses `#rrggbb` and rejects anything else, including eight-digit alpha hex: the source carries alpha as a number, never fused into the hex. */
export function parseHex(hex: string): Rgb {
  if (!HEX_PATTERN.test(hex)) throw new Error(`not a lower-case six-digit hex colour: ${hex}`)
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0")
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** `hex` moved `t` of the way to white, hue and saturation untouched. */
export function blendTowardWhite(hex: string, t: number): string {
  const { r, g, b } = parseHex(hex)
  return toHex({ r: r + t * (255 - r), g: g + t * (255 - g), b: b + t * (255 - b) })
}

/** `hex` at `alpha` painted over `baseHex`: the opaque value that reads the same on that base. */
export function compositeOver(hex: string, alpha: number, baseHex: string): string {
  const top = parseHex(hex)
  const base = parseHex(baseHex)
  const mix = (over: number, under: number) => alpha * over + (1 - alpha) * under
  return toHex({ r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b) })
}

/** CSS colour: the hex when the role is solid, `rgba(r, g, b, a)` when it carries alpha. */
export function toCss(hex: string, alpha?: number): string {
  if (alpha === undefined) return hex
  const { r, g, b } = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${formatAlpha(alpha)})`
}

/** KDE INI and Qt INI take an `R,G,B` triple with no alpha. */
export function toRgbTriple(hex: string): string {
  const { r, g, b } = parseHex(hex)
  return `${r}, ${g}, ${b}`
}

/** Hyprland's `rgba(rrggbbaa)`: the alpha a two-digit hex fraction of 255. */
export function toHypr(hex: string, alpha = 1): string {
  const { r, g, b } = parseHex(hex)
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0")
  return `rgba(${channel(r)}${channel(g)}${channel(b)}${channel(alpha * 255)})`
}

/** Alpha as written in a stylesheet: `0.5`, never `0.50` or `5e-1`. */
export function formatAlpha(alpha: number): string {
  return String(alpha)
}

export function toHsl(hex: string): Hsl {
  const { r, g, b } = parseHex(hex)
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

export function fromHsl({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const segment = Math.floor(h / 60) % 6
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][segment] as [number, number, number]
  return toHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 })
}

/** Same saturation and lightness as `hex`, hue replaced. Keeps a derived colour inside its family. */
export function rotateHue(hex: string, hue: number): string {
  const { s, l } = toHsl(hex)
  return fromHsl({ h: hue, s, l })
}

/** WCAG relative-luminance contrast ratio, used by the contrast assertion. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const { r, g, b: blue } = parseHex(hex)
    const channel = (value: number) => {
      const srgb = value / 255
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(blue)
  }
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}
