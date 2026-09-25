-- Palette table for Hyprland's Lua config, read with `local palette = require("palette")`.
-- Colours are Hyprland's own rgba(rrggbbaa) form: alpha 255 for a solid role,
-- the role's alpha where it carries one.

return {
    -- Surfaces
    panel_base = "{{panel-base.hypr}}",
    view_base = "{{view-base.hypr}}",
    window_base = "{{window-base.hypr}}",
    surface_raised = "{{surface-raised.hypr}}",
    keyboard_panel_base = "{{keyboard-panel-base.hypr}}",

    -- Ink
    ink_on_accent = "{{ink-on-accent.hypr}}",
    ink_emphasis = "{{ink-emphasis.hypr}}",
    ink = "{{ink.hypr}}",
    ink_secondary = "{{ink-secondary.hypr}}",
    ink_muted = "{{ink-muted.hypr}}",
    ink_faint = "{{ink-faint.hypr}}",
    ink_faint_solid = "{{ink-faint-solid.hypr}}",

    -- Accent family
    accent = "{{accent.hypr}}",
    accent_soft = "{{accent-soft.hypr}}",
    accent_cyan = "{{accent-cyan.hypr}}",
    accent_violet = "{{accent-violet.hypr}}",

    -- State
    error = "{{error.hypr}}",
    warning = "{{warning.hypr}}",
    success = "{{success.hypr}}",

    -- Window borders
    border_active = "{{border-active.hypr}}",
    border_inactive = "{{border-inactive.hypr}}",

    -- Hairlines, washes and interaction fills
    hairline = "{{hairline.hypr}}",
    border_strong = "{{border-strong.hypr}}",
    hover = "{{hover.hypr}}",
    hover_strong = "{{hover-strong.hypr}}",
    wash = "{{wash.hypr}}",
    card_wash = "{{card-wash.hypr}}",
    selection_menu = "{{selection-menu.hypr}}",
    selection_row = "{{selection-row.hypr}}",
    selection_note = "{{selection-note.hypr}}",
    accent_fill = "{{accent-fill.hypr}}",
    focus_ring = "{{focus-ring.hypr}}",
    danger_fill = "{{danger-fill.hypr}}",
    row_highlight = "{{row-highlight.hypr}}",
    row_active = "{{row-active.hypr}}",
    row_selected = "{{row-selected.hypr}}",
    text_shadow = "{{text-shadow.hypr}}",
}
