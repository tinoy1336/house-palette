/**
 * A worked example of the template contract: it renders the palette as a
 * Markdown sheet, one table per group, and closes with a contrast figure it
 * computes through the helper API.
 *
 * It imports nothing — a template never reaches into the renderer's source — and
 * everything it reads arrives in `context`. Run it with:
 *
 *   bin/render --template examples/palette-sheet.template.ts \
 *     --out examples/golden/palette-sheet.md \
 *     --record examples/golden/palette-sheet.record.json \
 *     --revision example
 */

/** The value column: a colour, a colour with its opacity and its opaque stand-in, or an opacity alone. */
function describe(colour, token) {
  if (token.alias !== undefined) return `same as \`${token.alias}\``
  if (token.hex === undefined) return `opacity ${colour.formatAlpha(token.alpha)}`
  if (token.alpha === undefined) return `\`${token.hex}\``
  return `\`${token.hex}\` at ${colour.formatAlpha(token.alpha)}, opaque stand-in \`${token.solid}\``
}

export default {
  render(context) {
    const { palette, colour, provenance } = context
    const groups = []
    for (const token of Object.values(palette.tokens)) if (!groups.includes(token.group)) groups.push(token.group)

    const lines = [
      "# Palette sheet",
      "",
      `Rendered from the palette at revision ${provenance.palette.revision}, sha256 ${provenance.palette.sha256.slice(0, 12)}.`,
      `Every value below comes from the palette source; this sheet is generated, so edit that instead.`,
      "",
    ]

    for (const group of groups) {
      lines.push(`## ${group}`, "", "| Token | Value | Purpose |", "| --- | --- | --- |")
      for (const token of Object.values(palette.tokens)) {
        if (token.group === group) lines.push(`| \`${token.name}\` | ${describe(colour, token)} | ${token.purpose} |`)
      }
      lines.push("")
    }

    const base = palette.find("surface.base").hex
    const body = palette.find("text.primary").hex
    lines.push("## Contrast", "", `Body text on the base surface: ${colour.contrastRatio(body, base).toFixed(2)}:1.`, "")

    return lines.join("\n")
  },
}
