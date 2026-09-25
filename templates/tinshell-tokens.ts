/**
 * Palette constants for the shell tree, as JS.
 *
 * The stylesheet carries every one of these as an `--tinshell-*` custom
 * property, and a CSS consumer reads it there. This module exists for the
 * consumers CSS cannot reach: a Cairo painter, a `Pango.FontDescription`, or a
 * config fallback that is a JS value before it is ever CSS text.
 *
 * Palette values only — a token's non-colour companions (the font stack, the
 * radii, the row padding) stay in the shell's own module.
 */

/** Primary text ink. CSS carrier: `--tinshell-ink`. */
export const INK = "{{ink}}"

/** Emphasis ink: the brightest tier, for a glyph or a one-word label. CSS carrier: `--tinshell-ink-emphasis`. */
export const INK_EMPHASIS = "{{ink-emphasis}}"

/** Secondary text ink — timestamps, hints. CSS carrier: `--tinshell-ink-secondary`. */
export const INK_SECONDARY = "{{ink-secondary}}"

/** De-emphasised ink. CSS carrier: `--tinshell-ink-muted`. */
export const INK_MUTED = "{{ink-muted}}"

/** Faint ink, alpha carried. CSS carrier: `--tinshell-ink-faint`. */
export const INK_FAINT = "{{ink-faint.css}}"

/** The suite accent — caret, focus/active control, the active path segment. CSS carrier: `--tinshell-accent`. */
export const ACCENT = "{{accent}}"

/** The lighter accent step, for a name that must read as related to the accent. CSS carrier: `--tinshell-accent-soft`. */
export const ACCENT_SOFT = "{{accent-soft}}"

/** The frosted panel base at the shell's own alpha. CSS carrier: `--tinshell-panel`. */
export const PANEL = "{{glass.shell.css}}"

/** The wash painted inside the panel. CSS carrier: `--tinshell-wash`. */
export const WASH = "{{wash.css}}"

/** The selected row's fill. CSS carrier: `--tinshell-row-selected`. */
export const ROW_SELECTED = "{{row-selected.css}}"

/** The hairline separating blocks on the panel. CSS carrier: `--tinshell-hairline`. */
export const HAIRLINE = "{{hairline.css}}"

/** State colours. CSS carriers: `--tinshell-error`, `--tinshell-warning`, `--tinshell-success`. */
export const ERROR = "{{error}}"
export const WARNING = "{{warning}}"
export const SUCCESS = "{{success}}"

/** The scrollbar pill's three states. CSS carriers: `--tinshell-scrollbar-thumb*`. */
export const SCROLLBAR_THUMB = "{{scrollbar-thumb.css}}"
export const SCROLLBAR_THUMB_HOVER = "{{scrollbar-thumb-hover.css}}"
export const SCROLLBAR_THUMB_ACTIVE = "{{scrollbar-thumb-active.css}}"
