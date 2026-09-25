/**
 * colour.ts — colour arithmetic, and nothing else.
 *
 * The renderer hands these functions to a template. They deal in colour models
 * — hex, RGB channels, HSL — and never in an output syntax: a template that
 * needs `rgba(r, g, b, a)`, a hex string with an alpha byte fused onto it, or a
 * bare `r, g, b` triple builds that text itself from `parse`, so no format
 * knowledge reaches this repository.
 *
 * Rounding is `Math.round` per channel, which is the rule the palette's derived
 * values were produced with.
 */

export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }

const HEX_PATTERN = /^#[0-9a-f]{6}$/

export function isHex(text: string): boolean {
  return HEX_PATTERN.test(text)
}

/** Parses `#rrggbb`. Anything else — upper case, three digits, a fused alpha byte — is an error, because the palette records opacity as a number. */
export function parseHex(hex: string): Rgb {
  if (!isHex(hex)) throw new Error(`not a lower-case six-digit hex colour: ${hex}`)
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

/** `hex` moved `amount` of the way to white, hue and saturation untouched. */
export function blendTowardWhite(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex)
  return toHex({ r: r + amount * (255 - r), g: g + amount * (255 - g), b: b + amount * (255 - b) })
}

/** `hex` at `alpha` painted over `baseHex`: the opaque colour that reads the same on that base. */
export function compositeOver(hex: string, alpha: number, baseHex: string): string {
  const top = parseHex(hex)
  const base = parseHex(baseHex)
  const mix = (over: number, under: number) => alpha * over + (1 - alpha) * under
  return toHex({ r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b) })
}

/** Alpha as the palette records it: `0.5`, never `0.50` or `5e-1`. */
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

/** The same saturation and lightness as `hex`, with the hue replaced: keeps a derived colour inside its family. */
export function rotateHue(hex: string, degrees: number): string {
  const { s, l } = toHsl(hex)
  return fromHsl({ h: degrees, s, l })
}

/** WCAG relative-luminance contrast ratio, for the contrast a reader can check. */
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
