<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
