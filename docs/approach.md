<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Approach and decisions

This file records every **IMPLEMENTER'S CHOICE** from SPEC §19 and every place where the implementation
had to interpret or extend the spec. SPEC.md stays authoritative; when something here conflicts with it,
the spec wins and the conflict is listed in STATUS.md for Fin.

## Implementer's choices (SPEC §19)

| # | Question | Decision | Status |
|---|---|---|---|
| I1 | Pan/zoom library or hand-rolled | **Hand-rolled** (`src/table/TableView.tsx`, `zoom.ts`): panning is the browser's own scrolling; zooming changes the *tile width* rather than scaling a picture, so tiles disclose more fields as they grow (SPEC §7.1), text stays sharp and the FLIP morph never fights a zoom transform. No dependency. | Built in M1 |
| I2 | Marching cubes or raymarching | **Marching cubes in a Web Worker.** The 90 % enclosed-probability threshold is computed on the CPU from the same voxel grid that produces the mesh, so the criterion is honoured exactly; a mesh also gets standard three.js lighting and cheap rotation on phones. | Decided; built in M3 |
| I3 | Typefaces (OFL) | **Alegreya Sans** (titles, symbols, names) — humanist and calligraphic; **IBM Plex Sans Variable** (numbers and UI) — tabular figures plus a width axis (75–100 %) that lets dense tile fields use a slightly condensed cut; **IBM Plex Mono** (configurations). | Done in M0 |
| I4 | Line and level caps | The defaults: strongest **400 lines** per species, lowest **60 levels**, for lanthanides and actinides too. | Decided; applied in M2 |
| I5 | Mapping NIST's IE markers to `flag` | NIST's own definitions (ASD help): **`[ ]` → `interpolated`** (semi-empirical: interpolated or extrapolated) and **`( )` → `calculated`** (ab-initio theory). The spec suggested `estimated` for parentheses; NIST calls them theoretical, so `calculated` is the honest word. Unmarked values → `measured`. The tile shows the markers exactly as NIST prints them. | Done in M0 |
| I6 | Tier B: PySCF or parse the STO tables | **Parse the Bunge (He–Xe) and McLean (Cs–U) Slater-type expansions**: published numbers, no heavy dependency, reproducible. PySCF stays the fallback for elements the tables do not cover. | Decided; v0.2 |

## Licence (SPEC §15.1)

The project is CC BY-NC-SA 4.0 for code and content alike. This non-commercial copyleft was chosen
deliberately for an educational work: it keeps every copy and every modified version free for
non-commercial use, under the same terms. The cost is known and accepted: it excludes commercial reuse and
it is not an OSI-approved open-source licence. Creative Commons itself discourages CC licences for
software; the project accepts that trade-off because no non-commercial code licence offers copyleft.
Commercial licences are available on request. Third-party code and fonts keep their own (permissive)
licences — see NOTICE.md.

## Data: sources added in M0

SPEC §18 builds M0's `index.json` from PubChem, NIST GSIE and NIST AWIC. Four more sources were needed to
fill the tile honestly; all are in `tools/sources.toml`:

- **`iaea_livechart`** (already in the registry, fetched now rather than in M2): SPEC §5.1 takes the
  most-stable mass number from IAEA, and the hyperfine headline needs natural abundances and nuclear spins.
- **`nist_codata`**: the exact eV ↔ kJ/mol factor (e · N_A / 1000) and `src/physics/constants.ts`.
- **`ciaaw`**: IUPAC's single display value for interval elements (AWIC gives only the interval), and a
  cross-check of AWIC against the current IUPAC table (see STATUS.md).
- **`si_brochure`**: Δν_Cs = 9 192 631 770 Hz exactly, the one hyperfine value M0 carries.
- **`iupac_redbook_2005`**: the spellings *aluminium* and *caesium* (PubChem uses U.S. spellings).

## Data: rules the build applies

Every rule below is also logged per element in `tools/build-report.md`.

- **Ground configurations** come from NIST ASD for Z ≤ 108. NIST lists nothing for Z ≥ 109; there the
  configuration is PubChem's (from Los Alamos National Laboratory), flagged `predicted` with a note, and the
  tile marks it †. Ground terms and IE₁ for Z ≥ 109 are `Missing{predicted_only}`.
- **Abbreviated cores** in NIST strings (`[Cd]`, `[Hg]`) are expanded using the definitions printed on the
  NIST help page, which the fetcher downloads and parses rather than typing them in.
- **Ground terms** keep NIST's coupling scheme: LS (`5D4`), jj (`(1/2,1/2)0` for lead) or J only
  (`Sg`, `Bh`, `Hs`). `GroundTerm` therefore gains `coupling` and `parity`, and `S`/`L` are present only
  for LS terms.
- **IE₁** is stored in kJ/mol (SPEC §5.2), converted from NIST's eV with the exact CODATA factor, rounded
  so that the uncertainty keeps two significant digits; the original eV value is kept in the note.
- **Atomic weight.** NIST AWIC as the spec says. Interval elements are an `Interval` whose `conventional`
  value is a full `Quantity` (IUPAC's abridged value, source `ciaaw`) instead of a bare number — a bare
  number inside an AWIC-sourced object would be a number without its own source (SPEC §2.1). The abridged
  value is used only if its ± range covers the AWIC interval (it is rounded, so oxygen's 15.999 sits just
  below its interval yet its range covers it).
- **Most-stable mass number** is the longest-lived ground-state isotope in IAEA data, stored for every
  element without a stable isotope. For technetium this gives **97** (4.21 My) where AWIC and most printed
  tables give 98 (4.2 My); the note says so.
- **Radioactive** means no isotope marked STABLE by IAEA, so bismuth (²⁰⁹Bi, t½ 2 × 10¹⁹ y) carries the trefoil.
- **Hyperfine headline (SPEC §5.1).** "Stable isotope" is read as *naturally occurring* (IAEA abundance
  > 0), so primordial ²⁰⁹Bi, ²³²Th and ²³⁵U can be reference isotopes. Order of the checks: no natural isotope
  → `no_stable_isotope`; ground level J = 0 → `not_applicable` (J = 0); every natural isotope I = 0 →
  `not_applicable` (I = 0); otherwise the reference isotope is the most abundant natural isotope with I ≠ 0,
  and its value comes from `tools/curated/hyperfine.toml` or is `not_measured` (the spec's definition, which
  also covers "not yet compiled"; the note says which).
- **Oxidation states.** PubChem's element pages carry two lists: Jefferson Lab's short list of main states
  (→ `common`, bold on the tile) and Los Alamos's full list (→ `other`, minus the common ones). Where
  Jefferson Lab has no list, all states are `other` and a note says so; Los Alamos's "(predicted)" sets
  `flag: "predicted"`.
- **Category** maps PubChem's group-block field to SPEC §7.3; halogens join the reactive nonmetals, and
  Z ≥ 109 becomes "unknown properties" as the spec says.
- **Standard state.** PubChem's "Expected to be a Solid/Gas" becomes `unknown`.
- **Block and group** follow from the Madelung filling order, which puts Lu and Lr in group 3 and La and Ac
  at the start of the f-block: the IUPAC-2021 default of SPEC §3.
- **Flags** whose source tables do not exist yet (laser cooling, clocks, SI history, essential elements)
  are omitted rather than defaulted to `false`; only `madelungAnomaly` is present in M0.
- **Images** may be an empty list until the image pipeline lands in M2 (the schema allows 0–3).

## App

- **Accessible name and description.** Each tile button's name is "Caesium (Cs), atomic number 55, alkali
  metal. Press Enter for details." — the spec's wording plus the symbol, so speech-input users can say what
  they see (WCAG 2.5.3). The full field list, with sources, is the button's description; while a heatmap or
  map is on, its value is added. axe's experimental `label-content-name-mismatch` heuristic is turned off in
  the end-to-end tests because it demands every visible character of a data tile in the name; a dedicated
  test checks that the name contains the visible symbol and name instead.
- **Progressive disclosure** is CSS container queries on each tile (≥ 110 px every field, 60–110 px
  Z/symbol/name/configuration, < 60 px Z and symbol), type sized in container units. Since M1 the table
  also skips the markup a tile's width cannot show (it knows the width from the zoom), which keeps a phone
  from laying out ~3 000 hidden nodes.
- **Fonts** were copied once from the Fontsource npm packages (v5.3.0) into `public/fonts/` with their OFL
  licence texts; the app has no font dependency at run time. The lone † and ν glyphs use the system font, so
  showing them does not pull in the 47 kB Latin-Extended or 28 kB Greek subsets at start.
- **Base path.** Every build (and `vite preview`) uses `/PTE-21C-Experience-the-Elements/`, so the
  end-to-end tests run exactly what GitHub Pages serves.

## M1: table interaction

- **State.** Two Zustand stores (`src/app/store.ts`): *settings* (layout, group 3, palette, theme, units,
  motion, shortcuts, last panel) saved in `localStorage` with every access in try/catch and every saved value
  re-validated on load; and *view* (open sheet, overlay, search) mirrored in the URL. All changes go through
  `src/app/actions.ts`, which captures the morph before a layout change.
- **Routing (SPEC §9.4).** `#/`, `#/?layout=janet&g3=la&trend=ie1&view=heat`, `#/Cs`, `#/Cs/amo`; table
  state may follow a sheet route too (`#/Fe/orbitals?layout=janet`). Only values that differ from the
  defaults are written. Opening a sheet adds a history entry, so the phone's Back gesture closes it; panel
  and table changes replace the entry. A mistyped link opens the table. A panel opened from a link counts as
  the last panel opened.
- **Morph (SPEC §7.2).** FLIP with the Web Animations API (`src/table/morph.ts`): positions are captured
  before React moves the tiles and replayed as transforms (translate and scale, since fit-to-width changes
  the tile size between 18- and 32-column layouts), 600 ms ease-in-out, 8 ms stagger by Z. Labels that stay
  put are left alone; the rest cross-fade through a ghost layer. The viewport keeps its old height while
  tiles fly so none is clipped. With reduced motion there is no animation at all.
- **Long form and group 3.** SPEC §7.2 fixes the inline f-block at 14 cells with the group-3 column after it,
  and says the toggle swaps La↔Lu (and Ac↔Lr) between the group-3 column and the block while Ce–Yb shift one
  column. That is what the layout does — with La and Ac in group 3, lanthanum therefore stands to the right
  of lutetium. The caption now says so rather than promising an unbroken run of increasing Z. Many printed
  32-column tables instead move the group-3 column (Sc, Y, La, Ac) to the left of the block; that is listed
  for Fin in STATUS.md.
- **Zoom (I1).** Pinch (touch events, so one-finger panning stays native), trackpad pinch and Ctrl/⌘+wheel,
  Safari's gesture events, double-tap or double-click on the background (tiles open the sheet instead), and a
  zoom bar: − / + (×1.25), *Fit width*, *Full-size tiles*. The point under the fingers or pointer stays still.
  Tile width runs from 24 px (WCAG 2.5.8 minimum target) to 1.5 × full size.
- **Keyboard (SPEC §9.5).** Tab follows Z; arrow keys, Home and End move by layout cells
  (`src/table/neighbours.ts`, tested to reach all 118 tiles in every layout); `/`, `L` (Shift+L backwards)
  and `T` are single-key shortcuts, ignored while typing or with a dialog open, and **can be turned off in
  Settings** — WCAG 2.1.4 requires that for single-character shortcuts.
- **Trends (SPEC §8).** One native `<select>` with three groups; arrow trends are disabled outside the two
  standard layouts and switching to Janet or ADOMAH turns an arrow overlay off. *Arrows* are drawn above and
  beside the table and point the way the property grows; the label states the spec's wording ("decreases
  down a group"); exceptions get numbered markers explained in the legend below. *Heatmaps* use viridis
  (perceptually uniform, colour-blind safe), black or white text whichever has the higher contrast (never
  below 4.58:1 — tested over all 4 096 12-bit colours), the value printed on tiles of 40 px and more, and
  hatching plus the Missing reason for gaps. NIST's [ ] and ( ) markers are kept. Energies and temperatures
  follow the units setting. *Maps* use eight tone tokens contrast-tested against the tile text, and every
  tile also prints the class's short label, so colour is never the only cue. "Show as chart" loads D3 on
  first use and plots the property against Z and against group, with a caption and a "Show as table" toggle.
- **D3** is used for scales, colour interpolation and line paths only (`d3-scale`, `d3-scale-chromatic`,
  `d3-shape`, `d3-array`); React draws the SVG. Both the heatmap colours and the chart load lazily.
- **Search (SPEC §7.4).** Name (with *cesium*, *aluminum*, *sulphur* as aliases), symbol, Z, categories,
  blocks, states, "radioactive", "anomalous", and comparisons such as `ionization > 1000`, `ie > 20 eV`,
  `melting < 0 °C`, `period 4`. Numbers without a unit are in the unit currently shown. Elements without a
  value are not compared, and the message says how many. "laser-cooled" and "clock" answer honestly that the
  data arrives in M2. Non-matching tiles recede to the page colour (keeping 4.5:1 text), matches get an
  outline, a live region reads the result, Enter opens the first match.
- **Hover card (SPEC §9.1).** Floating UI (`@floating-ui/react-dom`, positioned `fixed`, flips and shifts at
  the edges). 150 ms hover intent; immediate on keyboard focus; 350 ms long-press on touch, which also
  swallows the click so a peek does not open the sheet. It meets WCAG 1.4.13: Esc dismisses it, the pointer
  can move onto it, it stays until pointer or focus leaves. It repeats what the tile's name and description
  say, so it is hidden from screen readers. Photos arrive in M2; until then an honest placeholder says so.
- **Sheet (SPEC §9.2).** A native `<dialog>` opened with `showModal()` (focus trap, inert page, Esc) —
  centred at 92 % on desktop, a full-height bottom sheet on phones. Light dismiss by `closedby="any"` where
  supported, with a backdrop-click fallback for Safari. Scrolling under it is contained with
  `overscroll-behavior` on the dialog and its backdrop (no `overflow: hidden` on `<body>`). The panel strip is
  a `scroll-snap-type: x mandatory` container with `scroll-snap-stop: always`; a swipe that settles on a
  panel selects it (`scrollend`, debounced scroll as fallback). Tabs follow the ARIA tabs pattern; panels
  other than the current one are `inert`; ←/→ anywhere in the sheet change panel; a live region announces
  the panel. Panels mount when within one snap and stay mounted. Closing returns focus to the tile.
- **Panels.** Each of the eleven lives in `src/panels/<slug>/` (`index.ts` exports `{ slug, title, summary,
  Component, needs }`, `Panel.tsx` is a lazily loaded chunk) and is registered with one line in
  `src/panels/registry.ts`, which also fails fast if the order differs from SPEC §10. In M1 every panel is a
  placeholder that says what it will show and when, and shows no number.
- **Settings (SPEC §9.3).** A dialog: theme, palette, energy unit (kJ/mol or eV — also on the tiles), temperature
  unit (K or °C), motion (follow the system, reduce, full), single-key shortcuts. Layout and group 3 sit
  above the table. Effective theme, palette and motion are written to `<html data-*>` for the CSS.

## M1: performance (SPEC §13.4)

- **Prerendered table.** `npm run build` renders the app with the default settings at build time
  (`src/prerender.tsx` in a Vite SSR build, written into `dist/index.html` by `tools/prerender.mjs`) and
  inlines the stylesheet, so the table paints from the HTML alone, before any script. When the visitor's
  settings and URL match the defaults, `main.tsx` hydrates that markup in place; otherwise it replaces it in
  a single commit (both paths wait for the core data first, so nothing flashes or shifts).
- **Loading order.** `index.json`, `sources.json` and the active layout are preloaded; the script and those
  preloads are `fetchpriority="low"` so they do not compete with the prerendered page's fonts. The other three
  layouts and `trends.json` load after the first render.
- **Below the fold** the legend uses `content-visibility: auto`.
- **Budgets** are checked by `tools/lighthouse.mjs` (`npm run lighthouse`, a CI job): the build is served
  gzip-compressed under the Pages path, like GitHub Pages; Lighthouse's mobile profile must score ≥ 90;
  the JavaScript of the initial load must be ≤ 300 kB gzip; `index.json` ≤ 150 kB gzip; and "first table
  paint" — the first frame after the prerendered table is parsed, recorded as the `pte:table` mark — must
  come before 1.5 s with Lighthouse's mobile throttling *applied* (slow 4G, 4× CPU), not merely simulated.
  Measured in the cloud environment: score 95–96, 103 kB, 20 kB, 1.23 s.
- **Cross-browser.** Pushes and pull requests run the end-to-end tests on Chromium (desktop and an Android
  phone); the nightly workflow adds Firefox, WebKit and an iPhone. Swipe, pinch and long-press tests drive
  real touch events through the DevTools protocol and therefore run on Chromium only.

## Tooling

- Versions are pinned exactly. TypeScript 6.0 is used because typescript-eslint does not yet support
  TypeScript 7; ESLint 9 because eslint-plugin-jsx-a11y (6.10.2, still the latest in M1) does not support
  ESLint 10 yet — ESLint 9 is past end of life, which matters only for a developer tool; revisited each
  milestone. Playwright is pinned to 1.56.1 to match the browsers in the cloud
  environment, with a single `playwright-core` enforced through npm `overrides`.
- Lighthouse is run through its own CLI (Apache-2.0) rather than Lighthouse CI: `@lhci/cli` 0.15 pulls in
  seventeen known vulnerabilities and a package without a licence field, and is not needed for four budgets.
- Two development-only tools are MPL-2.0 (weak copyleft): axe-core (accessibility tests) and lightningcss
  (inside Vite). Neither is shipped to visitors; `npm run check:licences` enforces that only permissive
  packages are.
- Coverage thresholds live in `tools/coverage.toml`, each tagged with the milestone from which it applies,
  so the SPEC §13.1 targets that need M2 data switch on with M2 instead of being weakened.
- `tools/build-report.md` is committed so reviewers see every disagreement between sources and every rule
  applied, and its diff shows what changed after a data refresh.
