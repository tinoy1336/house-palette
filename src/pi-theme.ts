/**
 * pi-theme.ts — the mapping from pi's theme roles to house roles.
 *
 * pi's theme JSON asks for far more roles than the palette names, and its format
 * cannot carry alpha. So every key here resolves in one of three ways:
 *
 *   - `role:<name>`        the role's colour, unchanged;
 *   - `composite:<name>`   the solid composite the source declares for a
 *                          translucent role, because pi cannot hold alpha;
 *   - `derive:state-bg:<role>`
 *                          the role painted over panel-base at the alpha the
 *                          design's danger-fill uses for state backgrounds.
 *
 * A binding marked `judgement` is a colour choice, not a mechanical
 * consequence: those are the entries to review if a theme reads wrong.
 * Everything else follows from a role or from the design's composite table.
 */

import { compositeOver } from "./colour.ts"
import { roleAlpha, roleHex, type Palette, solidValue } from "./palette.ts"

export type PiBinding = {
  key: string
  source: string
  judgement?: string
}

export const piThemeBindings: PiBinding[] = [
  { key: "accent", source: "role:accent" },
  { key: "border", source: "composite:hairline" },
  { key: "borderAccent", source: "role:accent", judgement: "the border that marks attention takes the one accent, rather than a second step inside the hue" },
  { key: "borderMuted", source: "composite:border-strong" },
  { key: "success", source: "role:success" },
  { key: "error", source: "role:error" },
  { key: "warning", source: "role:warning" },
  { key: "muted", source: "role:ink-muted" },
  { key: "dim", source: "role:ink-faint-solid" },
  { key: "text", source: "role:ink" },
  { key: "thinkingText", source: "role:ink-muted" },
  { key: "selectedBg", source: "composite:accent-fill" },
  { key: "scrollbarTrack", source: "composite:hairline", judgement: "the track reads as a hairline rather than as ink; pi would otherwise fall back to the muted ink tier" },
  { key: "scrollbarThumb", source: "role:ink-faint-solid", judgement: "the thumb takes the faint ink tier; pi would otherwise fall back to full ink" },
  { key: "searchMatchBg", source: "composite:selection-note" },
  { key: "searchMatchText", source: "role:ink-emphasis", judgement: "a search hit is read against a filled row, so its text takes the emphasis tier" },
  { key: "userMessageBg", source: "composite:selection-row" },
  { key: "userMessageText", source: "role:ink", judgement: "message text is body ink" },
  { key: "customMessageBg", source: "composite:selection-menu" },
  { key: "customMessageText", source: "role:ink", judgement: "message text is body ink" },
  { key: "customMessageLabel", source: "role:accent-soft", judgement: "the label reads as a lighter accent, matching syntaxFunction" },
  { key: "toolPendingBg", source: "composite:wash" },
  { key: "toolSuccessBg", source: "derive:state-bg:success", judgement: "pi requires a success background and the design names none; this is the green at the alpha the design uses for the error background, so the two read as a pair" },
  { key: "toolErrorBg", source: "composite:danger-fill" },
  { key: "toolTitle", source: "role:accent", judgement: "the tool title carries the accent edge the design assigns it" },
  { key: "toolOutput", source: "role:ink-secondary", judgement: "tool output sits one tier below body ink" },
  { key: "mdHeading", source: "role:ink-emphasis", judgement: "a heading is the brightest ink, not a hue" },
  { key: "mdLink", source: "role:accent", judgement: "links take the accent, as the shell's active path does" },
  { key: "mdLinkUrl", source: "role:ink-faint-solid", judgement: "the URL behind a link is the faint tier" },
  { key: "mdCode", source: "role:accent-cyan", judgement: "inline code steps off the accent into the cool metric hue" },
  { key: "mdCodeBlock", source: "role:success", judgement: "a code block takes the content green" },
  { key: "mdCodeBlockBorder", source: "composite:hairline", judgement: "a code block border is a hairline" },
  { key: "mdQuote", source: "role:ink-secondary", judgement: "a quote is de-emphasised ink" },
  { key: "mdQuoteBorder", source: "composite:border-strong", judgement: "a quote's edge is the stronger border" },
  { key: "mdHr", source: "composite:border-strong", judgement: "a rule is the stronger border" },
  { key: "mdListBullet", source: "role:accent" },
  { key: "toolDiffAdded", source: "role:success" },
  { key: "toolDiffRemoved", source: "role:error" },
  { key: "toolDiffContext", source: "role:ink-faint-solid" },
  { key: "thinkingOff", source: "role:ink-faint-solid", judgement: "the thinking ladder starts at the faint ink tier" },
  { key: "thinkingMinimal", source: "role:ink-muted", judgement: "the thinking ladder climbs the ink ladder" },
  { key: "thinkingLow", source: "role:ink-secondary", judgement: "the thinking ladder climbs the ink ladder" },
  { key: "thinkingMedium", source: "role:ink", judgement: "the thinking ladder climbs the ink ladder" },
  { key: "thinkingHigh", source: "role:ink-emphasis", judgement: "the thinking ladder climbs the ink ladder" },
  { key: "thinkingXhigh", source: "role:accent", judgement: "past the brightest ink the ladder continues into the accent family rather than into a new hue" },
  { key: "thinkingMax", source: "role:accent-soft", judgement: "the top of the ladder is the lighter accent step" },
  { key: "bashMode", source: "role:success", judgement: "bash mode shares the content green" },
]

/** Colours for the HTML export block, which the format leaves optional. */
export const piExportBindings: PiBinding[] = [
  { key: "pageBg", source: "role:panel-base", judgement: "an exported page takes the panel base" },
  { key: "cardBg", source: "role:view-base", judgement: "an exported card takes the view base" },
  { key: "infoBg", source: "composite:wash", judgement: "an info strip is a wash" },
]

export function resolvePiBinding(palette: Palette, binding: PiBinding): string {
  const [kind, ...rest] = binding.source.split(":")
  switch (kind) {
    case "role":
      return roleHex(palette, rest.join(":"))
    case "composite":
      return solidValue(palette, rest.join(":"))
    case "derive": {
      if (rest[0] !== "state-bg") throw new Error(`unknown derivation: ${binding.source}`)
      const role = rest[1]
      if (role === undefined) throw new Error(`derivation names no role: ${binding.source}`)
      const stateAlpha = roleAlpha(palette, "danger-fill")
      if (stateAlpha === undefined) throw new Error("danger-fill carries no alpha")
      return compositeOver(roleHex(palette, role), stateAlpha, roleHex(palette, "panel-base"))
    }
    default:
      throw new Error(`unknown binding source: ${binding.source}`)
  }
}

export function piThemeColours(palette: Palette): { colors: Record<string, string>; export: Record<string, string> } {
  const colors: Record<string, string> = {}
  for (const binding of piThemeBindings) colors[binding.key] = resolvePiBinding(palette, binding)
  // The nine syntax roles are bound once, in the source's syntax map; pi only
  // names them, so a syntax role cannot point at a house role here and a
  // different one in the shell.
  for (const [piRole, houseRole] of Object.entries(palette.syntax)) colors[piRole] = roleHex(palette, houseRole)
  const exported: Record<string, string> = {}
  for (const binding of piExportBindings) exported[binding.key] = resolvePiBinding(palette, binding)
  return { colors, export: exported }
}
