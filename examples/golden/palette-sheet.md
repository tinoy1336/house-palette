# Palette sheet

Rendered from the palette at revision example, sha256 15322952c371.
Every value below comes from the palette source; this sheet is generated, so edit that instead.

## surface

| Token | Value | Purpose |
| --- | --- | --- |
| `surface.base` | `#0a0c11` | The translucent base every glass surface composites over; each surface's own opacity is an opacity.* token. |
| `surface.view` | `#16181c` | The opaque background of a content view that sits above the base. |
| `surface.window` | `#1b1d22` | The opaque background of a floating window. |
| `surface.raised` | `#23262c` | The background of a control or card raised above the view it sits in. |
| `surface.input` | `#171a21` | The base of the on-screen input panel; its own opacity is opacity.input-panel. |

## text

| Token | Value | Purpose |
| --- | --- | --- |
| `text.strong` | `#ffffff` | The highest emphasis text: a heading that must outrank everything around it. |
| `text.primary` | `#e6e6e6` | Default body text: the colour ordinary prose and control labels are drawn in. |
| `text.secondary` | `#c9c9c9` | Supporting text one step below the default. |
| `text.muted` | `#a6a6a6` | Text that must recede: labels, metadata, secondary detail. |
| `text.faint` | `#a6a6a6` at 0.55, opaque stand-in `#606163` | The lowest text tier, carried as translucency so it recedes on any surface. |
| `text.faint-solid` | `#606163` | The opaque stand-in for text.faint, for carriers that cannot express alpha. |
| `text.on-accent` | `#14171c` | Text and icons drawn on a filled accent surface. |

## accent

| Token | Value | Purpose |
| --- | --- | --- |
| `accent.primary` | `#8ab5f7` | The one hue the interface leads with: selection, focus and emphasis. |
| `accent.soft` | `#adcbf9` | A lighter step of the primary accent, for emphasis on a dark surface. |
| `accent.secondary` | `#4cccf2` | A second accent hue, for the places where two accent hues must be told apart. |
| `accent.tertiary` | `#b88cf2` | A third accent hue, one step further from the primary than accent.secondary. |

## state

| Token | Value | Purpose |
| --- | --- | --- |
| `state.error` | `#ff6b6b` | Failure or destruction: invalid input, a destructive action, an error. |
| `state.warning` | `#f0b35a` | Caution: something needs attention but nothing has failed. |
| `state.success` | `#8af7ae` | A completed or healthy condition. |

## border

| Token | Value | Purpose |
| --- | --- | --- |
| `border.hairline` | `#ffffff` at 0.06, opaque stand-in `#191b1f` | The faintest edge: a panel against the surface behind it. |
| `border.divider` | same as `border.hairline` | The separator between the rows of a list; the same decision as border.hairline, so the two cannot drift. |
| `border.strong` | `#ffffff` at 0.1, opaque stand-in `#222429` | A boundary that must be seen, between two regions of one surface. |
| `border.active` | `#cccccc` | The border of the window that holds the focus. |
| `border.inactive` | `#000000` at 0, opaque stand-in `#0a0c11` | The border of a window that does not hold the focus: fully transparent. |

## interaction

| Token | Value | Purpose |
| --- | --- | --- |
| `interaction.hover` | `#ffffff` at 0.08, opaque stand-in `#1e1f24` | The background of a control under the pointer. |
| `interaction.hover-strong` | `#ffffff` at 0.14, opaque stand-in `#2c2e32` | The pointer's background where the surface underneath is already light. |
| `interaction.wash` | `#ffffff` at 0.1, opaque stand-in `#222429` | A thin film laid over a region to lift it off the surface behind. |
| `interaction.card-wash` | `#ffffff` at 0.05, opaque stand-in `#16181d` | The smaller lift applied to a card inside an already raised panel. |
| `interaction.row-highlight` | `#ffffff` at 0.1, opaque stand-in `#232429` | The background of the list row under the pointer. |
| `interaction.row-active` | `#ffffff` at 0.16, opaque stand-in `#313337` | The background of the list row being pressed or dragged. |
| `interaction.row-selected` | `#0a0c11` at 0.72, opaque stand-in `#0a0c11` | The background of the list row that is the current selection. |
| `interaction.selection-menu` | `#8ab5f7` at 0.22, opaque stand-in `#263144` | The selection fill inside a pop-up menu. |
| `interaction.selection-row` | `#8ab5f7` at 0.35, opaque stand-in `#374761` | The selection fill of the active row in a list. |
| `interaction.selection-text` | `#8ab5f7` at 0.45, opaque stand-in `#445878` | The fill behind text a reader has highlighted. |
| `interaction.accent-fill` | `#8ab5f7` at 0.18, opaque stand-in `#212a3a` | The accent laid down as a fill beneath text or an icon. |
| `interaction.focus-ring` | `#8ab5f7` at 0.55, opaque stand-in `#506990` | The ring drawn around the element that holds keyboard focus. |
| `interaction.danger-fill` | `#ff6b6b` at 0.16, opaque stand-in `#311b1f` | The destructive action's fill, at a strength that reads as a warning rather than an alarm. |
| `interaction.scrollbar-thumb` | `#ffffff` at 0.22, opaque stand-in `#404145` | The scrollbar thumb at rest. |
| `interaction.scrollbar-thumb-hover` | `#ffffff` at 0.3, opaque stand-in `#545558` | The scrollbar thumb under the pointer. |
| `interaction.scrollbar-thumb-active` | `#ffffff` at 0.45, opaque stand-in `#78797c` | The scrollbar thumb while it is dragged. |

## opacity

| Token | Value | Purpose |
| --- | --- | --- |
| `opacity.panel` | opacity 0.5 | How much shows through the primary panel surface. |
| `opacity.card` | opacity 0.5 | How much shows through a raised card surface. |
| `opacity.backdrop` | opacity 0.35 | How much shows through the large backdrop behind a set of controls. |
| `opacity.control-disc` | opacity 0.45 | How much shows through the small rounded panel that groups a few controls. |
| `opacity.menu` | opacity 0.55 | How much shows through a pop-up menu. |
| `opacity.message` | opacity 0.5 | How much shows through a message panel. |
| `opacity.message-urgent` | opacity 0.62 | How much shows through a message panel whose text must stay legible against whatever is behind it. |
| `opacity.input-panel` | opacity 0.72 | How much shows through the on-screen input panel. |
| `opacity.terminal` | opacity 0.5 | How much shows through a full-screen text console surface. |

## effect

| Token | Value | Purpose |
| --- | --- | --- |
| `effect.text-shadow` | `#000000` at 0.44, opaque stand-in `#06070a` | The colour behind text so it stays legible over an image; the offset that pairs with it is geometry, not a palette value. |
| `effect.glow-alpha` | opacity 0.22 | How strong the halo around a focused or active element is drawn; the halo's colour is accent.primary. |
| `effect.scrim-base` | `#000000` | The colour the readability wash is painted in. |
| `effect.scrim-opacity` | opacity 0.5 | How strong the readability wash is. |

## syntax

| Token | Value | Purpose |
| --- | --- | --- |
| `syntax.comment` | same as `text.muted` | Source comments: the quietest text in a code listing. |
| `syntax.keyword` | same as `accent.primary` | Language keywords: the words that carry structural meaning. |
| `syntax.function` | same as `accent.soft` | Callable names: a function or a method in a code listing. |
| `syntax.variable` | same as `text.primary` | Identifiers that are neither a call nor a type. |
| `syntax.string` | same as `state.success` | String and character literals. |
| `syntax.number` | same as `state.warning` | Numeric and boolean literals. |
| `syntax.type` | same as `accent.secondary` | Type, class and enum names. |
| `syntax.operator` | same as `text.strong` | Operators and the punctuation that groups expressions. |
| `syntax.punctuation` | same as `text.faint-solid` | Structural punctuation: brackets, separators, terminators. |

## terminal

| Token | Value | Purpose |
| --- | --- | --- |
| `terminal.0` | same as `surface.base` | The default background of a text console. |
| `terminal.1` | same as `state.error` | Failure text in a text console. |
| `terminal.2` | same as `state.success` | Success text in a text console. |
| `terminal.3` | same as `state.warning` | Caution text in a text console. |
| `terminal.4` | same as `accent.primary` | The primary accent hue in a text console. |
| `terminal.5` | same as `accent.tertiary` | The third accent hue in a text console. |
| `terminal.6` | same as `accent.secondary` | The second accent hue in a text console. |
| `terminal.7` | same as `text.muted` | Ordinary foreground text in a text console. |
| `terminal.8` | same as `text.faint-solid` | The faintest readable text in a text console. |
| `terminal.9` | `#ff9090` | A brighter failure colour than slot 1. |
| `terminal.10` | `#a7f9c2` | A brighter success colour than slot 2. |
| `terminal.11` | `#f4c683` | A brighter caution colour than slot 3. |
| `terminal.12` | `#a7c8f9` | A brighter primary accent than slot 4. |
| `terminal.13` | `#caa9f5` | A brighter third accent than slot 5. |
| `terminal.14` | `#79d9f5` | A brighter second accent than slot 6. |
| `terminal.15` | same as `text.primary` | The brightest foreground text in a text console. |

## Contrast

Body text on the base surface: 15.67:1.
