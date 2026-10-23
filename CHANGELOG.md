<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-10-22

The first release: all 118 elements in four layouts, each with a sheet of eleven panels, built from cited
sources only. Live at https://bietenhader.github.io/PTE-21C-Experience-the-Elements/ — the honest limitations
are listed in the README.

### Added — milestone M5 (release)

- The About page's table of how complete the data is now also counts the fields added in M4 (polarizability,
  ionic radii, heat capacity, compounds, reactions, uses, GHS, IARC, isotope uses, discovery places).
- The version number on the page and in the About dialog; README section "Honest limitations".
- A release workflow (`.github/workflows/release.yml`, started by hand) that creates the tag and the GitHub
  Release from this changelog.

### Fixed — after Fin's look at the live site

- iPhone (Safari and Brave): the element sheet's photographs and summary were taller than the screen, so
  the tabs sat under the browser's toolbar and the panels never appeared. On phones the photographs and
  summary now get at most a third of the screen and scroll on their own; the tabs and the panel are always in
  sight, and the end of each panel can be scrolled above a floating toolbar. Tested at iPhone SE and
  iPhone 15 screen sizes.

### Changed — M5

- The licence and credit name is "Serafin Bietenhader".
- The "preview" note above the table is replaced by the version.

### Added — milestone M4 (panels, batch 2)

- **Probability & statistics:** the radial probability P(r) and its cumulative curve for any subshell with a
  radius slider; bosons and fermions per isotope with the first BEC and degenerate Fermi gas; Maxwell–Boltzmann
  speeds and the thermal de Broglie wavelength on a temperature slider down past the recoil limit; the isotope
  mixture and the atomic weight as a statistic; the NIST uncertainty notation explained.
- **Physical & engineering:** phase, density, melting and boiling points; molar and specific heat capacity
  (CRC Handbook); the crystal structure with a 3D unit cell for ten structure types; allotropes; abundance in
  crust, sea water, Solar System and body on one log scale; production, price and the EU critical-raw-material
  flag; sourced uses; GHS hazards from PubChem (EU harmonised classification first).
- **Mathematical & theoretical:** quantum numbers of every valence electron; Hund's rules worked step by step
  against NIST's measured term; the Landé g-factor against NIST's; Slater's screening arithmetic and the
  hydrogenic IE estimate; Aufbau anomalies explained by kind; relativity (Zα, γ, 1s contraction, the limits of
  the table, four notes where relativity changes chemistry); the symmetry of hydrogen.
- **AMO & metrology:** hyperfine structure with F-level diagrams, nuclear moments, atomic clocks from the BIPM
  list, laser cooling with computed Doppler and recoil limits, and the timeline of the second.
- **Chemistry & bonding:** oxidation states with an example compound each, a size ladder (Shannon ionic,
  covalent and van der Waals radii), electronegativity, bonding, well-known compounds checked against PubChem,
  reactions with air, water and acids (HSDB, CAMEO, Greenwood & Earnshaw), coordination numbers.
- **Biology & ecology:** essentiality for plants and humans, the amount in the reference body, toxicity notes,
  IARC groups read from IARC's list at build time, soil and food-web notes, isotope uses with their papers.
- **History & naming:** discovery, the place on a world map (Natural Earth, GeoNames), a timeline of all 118
  discoveries, name and symbol origins, historical photographs where vendored.
- **Electromagnetic:** the static dipole polarizability of all 118 atoms (Schwerdtfeger & Nagle 2019).
- Tests: the 118 × 11 property test (every element on every panel), specs for each new panel (including the
  AMO acceptance for Cs, Rb, Sr, Yb, Al, Hg, Th and helium's not_applicable), unit tests for term symbols,
  Hund's rules, the Landé formula, Slater's steps, anomaly kinds, laser-cooling limits, hyperfine levels and
  thermal speeds.

### Changed — M4

- Properties not yet compiled are listed as "Not yet compiled in PTE-21C" instead of "not measured".
- Units with a subscript (μ_N) are written with a real subscript; very large values with uncertainties in the
  thousands use powers of ten.

### Added — milestone M3 (sheet and panels, batch 1)

- **Orbitals** (Tier A): a 3D picture of every occupied subshell, ordered by orbital energy, at the 90 %
  probability surface; a 3D viewer with real or complex orbitals, phase colours, nodal surfaces, a |ψ|² slice
  and turn buttons; the shell stack (all radial distributions on one axis, linear or log r, with the
  covalent and van der Waals radii); nodes, occupancies, effective charges and orbital energies; the
  approximation badge always shown. Marching cubes in a pool of Web Workers.
- **Electromagnetic & ionization:** the ionization ladder with every stage NIST lists and the shell closures,
  electron affinity, Pauling and Allen electronegativity, Mulliken's computed with its formula, IE₁ on the
  sawtooth of all elements, and the properties not yet compiled shown as missing with the reason.
- **Spectrum & energy levels:** the visible emission strip of the atom (and its ion) in CIE 1931 colours,
  the strongest lines, an approximate overall glow, and a Grotrian diagram with the laser-cooling and clock
  transitions marked.
- **Nucleus & isotopes:** every known isotope by half-life and decay mode, the record of any isotope, decay
  and survival with a calculator, binding energy per nucleon, magic numbers, spin and parity, cosmic origin,
  and the thorium-229 nuclear clock.
- Shared: chart frame with caption and "Show as table", source-chip popovers, KaTeX formulas, keyboard-
  reachable sideways-scrolling tables; three.js, @react-three/fiber and KaTeX (MIT; KaTeX fonts OFL 1.1).
- Tests: the 118 × 4 property test (every element on every new panel, no console errors, every Missing with
  its reason, every ionization stage drawn), the orbital-gallery timing test for Fe, Cs, Gd and Og, axe on
  the new panels, unit tests for the physics (hydrogenic orbitals, Slater's rules, CIE colours, decay,
  isosurface level, marching cubes).

### Changed

- On phones the element sheet's header folds to a name bar while reading a long panel; the tab row keeps
  the current tab in sight.
- Half-lives are converted with the IAEA's year (mean tropical year) everywhere.
- Thorium's and uranium's AGB share in the cosmic origin is labelled "returned, not made".

### Fixed

- NIST levels files kept a series limit instead of the first ionization limit (32 files).
- Isotope mass uncertainties carried floating-point noise; width limits were worded as half-life limits.
- Safari: a scroll event as the sheet closed reset the remembered panel.
- Two quick panel changes (→ → or a tab click during a scroll) could bounce back a panel: the end of the
  earlier scroll was read as a swipe.

### Added — milestone M2 (data complete for v0.1)

- New fetchers: NIST ASD energy levels and spectral lines, NIST SRD 141 orbital energies, the BIPM list of
  standard frequencies, images-of-elements.com and Wikimedia Commons; IAEA nuclear moments from each
  nuclide's level table.
- Curated tables, one source per row: hyperfine constants, laser cooling, clocks and the timeline of the
  second, the elements in the SI, Clementi–Raimondi Z_eff, Allen electronegativities, predictions for
  Z ≥ 109, biology, abundances (crust, sea water, solar system, human body), crystal structures (COD),
  cosmic origin (Kobayashi 2020, approximate), production and prices (USGS 2026), EU critical raw
  materials, discovery history, and a short text in our own words for every element.
- Per-element data files loaded on demand (`elements/`, `isotopes/`, `spectra/`, `levels/`,
  `metrology.json`), each with a JSON Schema.
- Photographs for 90 elements as vendored WebP with full credits, honest placeholders for the rest, and
  `tools/images-report.md` explaining every choice; `CREDITS.md` and `PROVENANCE.md` regenerated.
- The About page (`#/about`): privacy statement, coverage table, every source with licence and retrieval
  date. The element sheet shows the short text; six new categorical maps; search for "laser-cooled",
  "clock" and "essential".
- Golden tests for H-1 and Rb-87 hyperfine values and the Rb-87 D2 cooling limits; a check that no spin-0
  nucleus carries a moment; M2 coverage thresholds switched on.

### Changed

- Ionization energies for Z ≥ 109 are published predictions, marked † (previously "predicted only").
- `sources.json` marks a source as used when any data file cites it.

### Added — milestone M1 (table interaction)

- Four layouts with a FLIP morph (600 ms, 8 ms stagger by Z, labels cross-fading; instant with reduced
  motion) and the group-3 toggle.
- Pan and zoom: native scrolling, pinch, Ctrl/⌘ + wheel, Safari gestures, double-tap, a zoom bar; tiles
  disclose more fields as they grow.
- Trends: all eleven arrow trends of SPEC §8.1 with exceptions, twelve heatmaps with a chart and table view,
  eight categorical maps; new data for them (electron affinity, covalent and van der Waals radii, melting
  and boiling points, density, discovery year, stable isotopes, longest half-life) in `index.json` and
  `trends.json`.
- Search with keywords and numeric comparisons; hover card (hover, focus, long-press); the element sheet's
  frame (modal on desktop, bottom sheet on phones, swipeable panel strip, tabs, ←/→, deep links) with eleven
  placeholder panels; settings dialog; hash routing; keyboard navigation and shortcuts.
- A one-line tip above the table ("zoom in to see more"), worded for mouse or touch, that goes away once
  the visitor has zoomed or dismissed it.
- A prerendered table in `index.html`, hydrated by the app; Lighthouse budgets in CI; a nightly end-to-end
  run on Chromium, Firefox and WebKit.

### Changed (M1)

- The long-form caption describes the La/Ac variant accurately.
- Tile names end "Press Enter for details." now that Enter opens the sheet.

### Added — milestone M0 (skeleton)

- Data pipeline (`tools/`): fetchers for PubChem, NIST ASD ionization energies, NIST AWIC, IAEA LiveChart,
  CODATA 2022 and IUPAC CIAAW; `build.py` producing `public/data/index.json` and `sources.json`;
  `build_layouts.py` producing the four layouts; `report.py` producing PROVENANCE.md and CREDITS.md.
- JSON Schema for every data file, with TypeScript types generated from it.
- The standard 18-column table with all 118 elements; tiles carrying the reference table's fields and the
  ground-state hyperfine slot; legend, block map, tile key.
- Tests: pipeline (schema, provenance, coverage, golden values, layouts), unit (formatting, Madelung, units,
  palette contrast, tile text) and end-to-end (fields, zero third-party requests, axe, keyboard order).
- CI, GitHub Pages deployment, the `PTE-21C.command` launcher and `tools/pipeline.command`.

[Unreleased]: https://github.com/Bietenhader/PTE-21C-Experience-the-Elements/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Bietenhader/PTE-21C-Experience-the-Elements/releases/tag/v0.1.0
