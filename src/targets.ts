/**
 * targets.ts — the destinations the renderer owns.
 *
 * A target is only listed here when its load mechanism could be confirmed on
 * this machine: a documentation page, a manual page, or the program's own code.
 * A target whose mechanism is unconfirmed is listed in `heldBackTargets` with
 * the reason, and the renderer never writes it — a file nobody loads is worse
 * than no file, because it looks like the palette is applied.
 *
 * `{home}` is the dotfiles work tree and `{tinshell}` the shell repository, both
 * overridable on the command line so a fixture render and a golden comparison
 * never touch the real tree.
 */

export type HeaderStyle = "block" | "hash" | "dash" | "none"

export type Target = {
  name: string
  /** Destination with `{home}` or `{tinshell}` as its root. */
  destination: string
  /** Template file under templates/. */
  template: string
  /** Comment syntax of the destination format, for the generated-file header. */
  header: HeaderStyle
  syntax: string
  mechanism: string
}

export type HeldBack = {
  name: string
  syntax: string
  reason: string
}

export const targets: Target[] = [
  {
    name: "kitty-palette",
    destination: "{home}/.config/kitty/palette.house.conf",
    template: "kitty-palette.conf",
    header: "hash",
    syntax: "kitty conf fragment",
    mechanism: "kitty's `include` directive, documented in the shipped manual (/usr/share/doc/kitty/html/conf.html, the include directive resolves a relative path against the including file).",
  },
  {
    name: "pi-theme",
    destination: "{home}/.pi/agent/themes/house.json",
    template: "pi-theme.json",
    header: "none",
    syntax: "pi theme JSON",
    mechanism: "pi loads a user theme from `<agent-dir>/themes/<name>.json` and hot-reloads it by name (docs/themes.md in the installed package). JSON has no comment syntax, so the header lives in the manifest.",
  },
  {
    name: "git-colors",
    destination: "{home}/.config/git/colors.inc",
    template: "git-colors.inc",
    header: "hash",
    syntax: "git config fragment",
    mechanism: "git's `include.path`, documented in man git-config (the include.path entry).",
  },
  {
    name: "tmux-colors",
    destination: "{home}/.config/tmux/colors.conf",
    template: "tmux-colors.conf",
    header: "hash",
    syntax: "tmux conf fragment",
    mechanism: "tmux's `source-file`, documented in man tmux (the source-file command).",
  },
  {
    name: "gtk3-fragment",
    destination: "{home}/.config/gtk-3.0/palette.gen.css",
    template: "gtk3-fragment.css",
    header: "block",
    syntax: "GTK3 CSS",
    mechanism: "the `@import` at the head of the live gtk.css, which already loads colors.css the same way.",
  },
  {
    name: "gtk4-fragment",
    destination: "{home}/.config/gtk-4.0/palette.gen.css",
    template: "gtk4-fragment.css",
    header: "block",
    syntax: "GTK4 CSS",
    mechanism: "the `@import` at the head of the live gtk.css, which already loads colors.css the same way.",
  },
  {
    name: "gtk2-fragment",
    destination: "{home}/.config/gtkrc.house",
    template: "gtk2-fragment.rc",
    header: "hash",
    syntax: "GTK2 rc fragment",
    mechanism: "the `include` line of the live ~/.config/gtkrc, which already includes the Breeze rc. GTK2 is not installed on this machine, so the fragment carries solid colours only and is unverified at runtime.",
  },
  {
    name: "hypr-palette",
    destination: "{home}/.config/hypr/palette.lua",
    template: "hypr-palette.lua",
    header: "dash",
    syntax: "Lua table",
    mechanism: "Lua `require` resolves against the config's own directory: `Hyprland --verify-config -c <config>` loads a module sitting beside the config (and a dotted subpath) and reports an error when the module is absent.",
  },
  {
    name: "vesktop-quickcss",
    destination: "{home}/.config/vesktop/settings/quickCss.css",
    template: "vesktop-quickcss.css",
    header: "block",
    syntax: "CSS",
    mechanism: "Vencord's Electron main process watches the QuickCSS file and pushes the new text to the renderer, so an edit applies without a client restart (the watch and its VencordQuickCssUpdate message in the installed vencordDesktopMain.js).",
  },
  {
    name: "ytm-theme-additions",
    destination: "{home}/.config/YouTube Music/themes/house.css",
    template: "ytm-theme-additions.css",
    header: "block",
    syntax: "CSS",
    mechanism: "the app reads every path in `options.themes` of its config.json and injects the file into the web view. Listing this file is a consumer-side edit of a live config, so the fragment stays inert until that entry is added.",
  },
  {
    name: "kdeglobals-fragment",
    destination: "{home}/.config/house-palette/kdeglobals.colours.ini",
    template: "kdeglobals.fragment",
    header: "hash",
    syntax: "KDE INI",
    mechanism: "none: the KDE INI format has no include, so the fragment is staged for an apply step that merges its keys into ~/.config/kdeglobals. That file is a live config and stays out of the renderer's hands.",
  },
  {
    name: "zsh-colors",
    destination: "{home}/.config/zsh/house-colors.sh",
    template: "zsh-colors.sh",
    header: "hash",
    syntax: "shell",
    mechanism: "none: the fragment is sourced by the login shell. Nothing on this machine sets LS_COLORS today, so the export lands nowhere until the shell's own startup file sources this one.",
  },
  {
    name: "tinshell-theme-css",
    destination: "{tinshell}/common/shell/theme.css",
    template: "tinshell-theme.css",
    header: "block",
    syntax: "GTK CSS",
    mechanism: "the shell's apps import this stylesheet first; the shell's own change makes theme.css generated output and moves its non-palette rules to a companion stylesheet.",
  },
  {
    name: "tinshell-tokens-ts",
    destination: "{tinshell}/common/css/tokens.ts",
    template: "tinshell-tokens.ts",
    header: "block",
    syntax: "TypeScript",
    mechanism: "imported by the shell's apps as the runtime string carrier for values CSS cannot reach.",
  },
]

export const heldBackTargets: HeldBack[] = [
  {
    name: "hyprlock-colours",
    syntax: "hyprlock conf",
    reason: "hyprlock's `source` directive could not be confirmed on this machine: it has no manual page, `hyprlock --help` lists no such option, the shipped example config contains no `source` line, and the binary exposes no such config keyword. The design's fallback (a rendered copy of the live file) would rewrite a config a person edits by hand, which the renderer must not do.",
  },
  {
    name: "firefox-profile-css",
    syntax: "CSS",
    reason: "no Firefox profile exists on this machine and no Firefox documentation is installed, so the preference that enables profile stylesheets cannot be confirmed. The design makes this target conditional on that confirmation.",
  },
  {
    name: "vscode-vibrancy-css",
    syntax: "CSS",
    reason: "the existing vibrancy-glass.css holds hand-authored rules that are not palette values (a watermark filter), and the extension reads the whole file as one import. Generating it would clobber that content, and merging into a hand-edited file is outside what the renderer owns.",
  },
  {
    name: "trolltech-palette",
    syntax: "Qt INI",
    reason: "the Qt palette keys are positional colour lists whose slot meaning the design does not state, and the live file is the only key template on this machine. Filling that shape would be guessing a mechanism, so it waits for a stated slot mapping.",
  },
]

/**
 * Apply steps a consumer performs, with the mechanism each one needs. Recorded
 * here rather than in prose so the boundary between a generated file and a live
 * config is visible in the source of the repository that draws it.
 */
export const applySteps: { name: string; destination: string; step: string }[] = [
  {
    name: "kitty-include",
    destination: "{home}/.config/kitty/kitty.conf",
    step: "add `include ~/.config/kitty/palette.house.conf` once; background_opacity stays in kitty.conf and is never generated.",
  },
  {
    name: "pi-theme-selection",
    destination: "{home}/.pi/agent/settings.json",
    step: "set `\"theme\": \"house\"`.",
  },
  {
    name: "git-include",
    destination: "{home}/.gitconfig",
    step: "add `[include] path = ~/.config/git/colors.inc` once.",
  },
  {
    name: "tmux-source",
    destination: "{home}/.tmux.conf",
    step: "add `source-file ~/.config/tmux/colors.conf` once.",
  },
  {
    name: "gtk3-import",
    destination: "{home}/.config/gtk-3.0/gtk.css",
    step: "add `@import 'palette.gen.css';` once, beside the existing colors.css import, and drop the hand-copied @define-color block it replaces.",
  },
  {
    name: "gtk4-import",
    destination: "{home}/.config/gtk-4.0/gtk.css",
    step: "add `@import 'palette.gen.css';` once, beside the existing colors.css import, and drop the hand-copied @define-color block it replaces.",
  },
  {
    name: "gtk2-include",
    destination: "{home}/.config/gtkrc",
    step: "add `include \"<path>/gtkrc.house\"` once, beside the existing Breeze include.",
  },
  {
    name: "hyprland-require",
    destination: "{home}/.config/hypr/hyprland.lua",
    step: "`require(\"palette\")` and read the border colours from it. Verify with a fresh `hyprctl reload` AND an empty `hyprctl configerrors`: a reload prints ok even when a field is rejected.",
  },
  {
    name: "vesktop-quickcss",
    destination: "{home}/.config/vesktop/settings/quickCss.css",
    step: "none: Vencord watches the file.",
  },
  {
    name: "ytm-theme-list",
    destination: "{home}/.config/YouTube Music/config.json",
    step: "add the generated path to `options.themes`. The design's open question — how generated tokens enter ytmd-dark.css, and what happens to the unused ags-glass.css — is unresolved, so this fragment carries variables only.",
  },
  {
    name: "kdeglobals-merge",
    destination: "{home}/.config/kdeglobals",
    step: "merge the fragment's colour keys into the live INI, leaving every other section untouched, then confirm when the running session picks the change up (unconfirmed).",
  },
  {
    name: "zsh-source",
    destination: "{home}/.zshrc",
    step: "source the fragment, and confirm nothing else in the login environment overwrites LS_COLORS (no owner was found on this machine).",
  },
  {
    name: "vscode-vibrancy-rebake",
    destination: "/usr/share/code",
    step: "the injected CSS is baked into a root-owned install, so a changed import needs the existing re-apply path to run, not a reload.",
  },
]
