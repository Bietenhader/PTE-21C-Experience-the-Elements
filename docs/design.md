<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Design

Direction (SPEC §16): a dark "lab bench at night" — near-black background, muted category fills so the
photographs (from M2) are the colour in the room, saturated category accents on hover, large symbol type,
calm data-dense panels. Light theme is the inverse with the same tokens. The layout morph (M1) is the one
hero animation. **Fin reviews the design at the end of M3**; everything below is in tokens so a redirect is
cheap.

## Tokens

All colour, type and spacing live in [`src/app/tokens.css`](../src/app/tokens.css): page surfaces and text,
tile ink, ten category fills and ten accents per palette, four block colours, eight map tones and the
hatching for missing values, three font stacks, spacing, and the table gaps. Tile width and proportions come
from the zoom (`src/table/zoom.ts`). `src/app/palette.test.ts` fails if any tile text — normal or muted —
drops below 4.5:1 on any category fill or map tone, in either palette or theme, or if a hover accent drops
below the 3:1 non-text minimum.

- **Palettes:** *Campion* (hues close to the reference table, darkened until the tile text passes) and
  *Colour-safe* (hues from Okabe & Ito, distinguishable with deuteranopia and protanopia), chosen in
  Settings.
- **Heatmaps** use viridis with black or white text, whichever reads better; **maps** use eight muted tones
  after Okabe & Ito and always print a short label on each tile.
- **Blocks** use Janet's classic colours: s red, p yellow, d blue, f green — a thin bar along each tile's
  bottom, with the letter on full-size tiles, so the block is never carried by colour alone.
- **Forced-colours mode** (Windows High Contrast): tiles get a visible border and the block bar a system colour.

## Type (IMPLEMENTER'S CHOICE I3)

- **Alegreya Sans** — titles, element symbols and names.
- **IBM Plex Sans Variable** — numbers and interface text, with tabular figures; its width axis gives the
  dense tile fields a slightly condensed cut (`font-stretch: 80–87.5 %`).
- **IBM Plex Mono** — electron configurations (and, later, formulas).

All OFL-licensed, self-hosted from `public/fonts/` (Latin, Latin Extended and Greek subsets, loaded only when
a page uses them).

## The tile

```
  132.9055               55     ← standard atomic weight, or (mass number) · Z, ☢ if no stable isotope
  375.7  0.79            +1     ← IE₁ in kJ/mol · Pauling EN · oxidation states, highest first, common bold
                         −1
  Cs                            ← symbol
  Caesium                       ← name (IUPAC spelling)
  [Xe] 6s¹                      ← measured configuration; ◆ differs from Aufbau, † predicted
  ν_hfs 9 192 631 770 Hz · ¹³³Cs ← ground-state hyperfine splitting, or why there is none
  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ s     ← block bar and letter
```

Below 110 px the tile keeps Z, symbol, name and configuration; below 60 px, Z and symbol.

## Motion and overlays (M1)

- **The morph** is the hero animation: tiles fly on ease-in-out curves, staggered by Z so the eye can follow
  a period; labels cross-fade. Settings → Motion offers *follow my system*, *reduce* and *full*; reduced means
  no animation at all, not a faster one.
- **The hover card** is a small raised panel beside the tile: photo strip (an honest placeholder until M2),
  symbol in its category colour, name, Z, category, state, the one-line quantum fact, and how to pin it.
- **The sheet** fills 92 % of a desktop screen over a dimmed backdrop, or the whole phone screen as a bottom
  sheet that slides up (fades in on desktop). Header with photos, symbol, name and facts; then tabs, arrows
  and dots over the swipeable panel strip.
- **Trend arrows** are drawn in the page's text colour above and beside the table, never over the tiles;
  exception markers are small numbered discs in the focus colour.

