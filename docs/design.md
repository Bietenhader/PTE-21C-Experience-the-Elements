<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Design

Direction (SPEC §16): a dark "lab bench at night" — near-black background, muted category fills so the
photographs (from M2) are the colour in the room, saturated category accents on hover, large symbol type,
calm data-dense panels. Light theme is the inverse with the same tokens. The layout morph (M1) is the one
hero animation. **Fin reviews the design at the end of M3**; everything below is in tokens so a redirect is
cheap.

## Tokens

All colour, type and spacing live in [`src/app/tokens.css`](../src/app/tokens.css): page surfaces and text,
tile ink, ten category fills and ten accents per palette, four block colours, three font stacks, spacing,
and the table geometry (`--tile-full`, `--tile-min`, `--tile-aspect`). `src/app/palette.test.ts` fails if
any tile text — normal or muted — drops below 4.5:1 on any category fill, in either palette or theme, or if
a hover accent drops below the 3:1 non-text minimum.

- **Palettes:** *Campion* (hues close to the reference table, darkened until the tile text passes) and
  *Colour-safe* (hues from Okabe & Ito, distinguishable with deuteranopia and protanopia). The switch is a
  setting in M1.
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
