<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Approach and decisions

This file records every **IMPLEMENTER'S CHOICE** from SPEC §19 and every place where the implementation
had to interpret or extend the spec. SPEC.md stays authoritative; when something here conflicts with it,
the spec wins and the conflict is listed in STATUS.md for Fin.

## Implementer's choices (SPEC §19)

| # | Question | Decision | Status |
|---|---|---|---|
| I1 | Pan/zoom library or hand-rolled | **Hand-rolled** (`src/table/TableView.tsx`, `zoom.ts`): panning is the browser's own scrolling; zooming changes the *tile width* rather than scaling a picture, so tiles disclose more fields as they grow (SPEC §7.1), text stays sharp and the FLIP morph never fights a zoom transform. No dependency. | Built in M1 |
| I2 | Marching cubes or raymarching | **Marching cubes in a Web Worker.** The 90 % enclosed-probability threshold is computed on the CPU from the same voxel grid that produces the mesh, so the criterion is honoured exactly; a mesh also gets standard three.js lighting and cheap rotation on phones. | Built in M3 (see "M3: panels") |
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
  tile marks it †. In M0 and M1 ground terms and IE₁ for Z ≥ 109 were `Missing{predicted_only}`; since M2
  they are published predictions, flagged (see "M2: data" below).
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
- **Flags** whose source tables did not exist yet (laser cooling, clocks, SI history, essential elements)
  were omitted in M0 rather than defaulted to `false`; since M2 every flag is computed from its table.
- **Images** could be an empty list until the image pipeline landed in M2; now every element has at least
  a photo or a placeholder.

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
  Tile width runs from 24 px (WCAG 2.5.8 minimum target) to 1.5 × full size. Because zooming is how the
  detail is discovered, a one-line tip beside the zoom bar says so (worded for touch or for a mouse); it is
  remembered as seen once the visitor zooms or dismisses it (Fin, M1 review).
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
- **Fonts** use `font-display: optional`, and the three faces the first screen needs (Plex Sans, Alegreya
  Sans 400 and 800) are preloaded. A web font that arrives late is skipped for that visit instead of
  swapped in, because each swap re-lays out all 118 tiles — on a slow phone that is a long, blocking task.
  On a normal connection the fonts arrive within the short wait and are used; afterwards they come from the
  cache.
- **The first measurement is a transition.** Until the table's width has been measured it fits to width in
  CSS, which looks identical, so the re-render with the measured width runs as an interruptible
  `startTransition` update instead of blocking the first frame.
- **Below the fold** the legend uses `content-visibility: auto`.
- **Budgets** are checked by `tools/lighthouse.mjs` (`npm run lighthouse`, a CI job): the build is served
  gzip-compressed under the Pages path, like GitHub Pages; Lighthouse's mobile profile must score ≥ 90;
  the JavaScript of the initial load must be ≤ 300 kB gzip; `index.json` ≤ 150 kB gzip; and "first table
  paint" — the first frame after the prerendered table is parsed, recorded as the `pte:table` mark — must
  come before 1.5 s with Lighthouse's mobile throttling *applied* (slow 4G, 4× CPU), not merely simulated.
  Measured in the cloud environment: score 96 (94 with a 6× CPU slowdown standing in for a slower CI
  machine), 103 kB, 20 kB, about 1.2 s.
- **Calibrated CPU slowdown (since M2).** Lighthouse slows the CPU of whatever machine it runs on by a
  fixed 4×, so GitHub's shared runners — some much slower than others — imitated different phones from run
  to run: the same M1 commit scored 95 on one run and 86 on the next. Following Lighthouse's throttling
  guide, `tools/lighthouse.mjs` now scales the slowdown by the machine's benchmark index (4× at the ≈ 2400
  of the machine the budgets were set on, less on a slower machine, never more than 4×) and takes the
  median of three runs. Both numbers are printed with the result. Measured side by side at a 10× slowdown,
  M1 and M2 score the same (86–89 and 88–89), so M2's data did not slow the page.
- **Cross-browser.** Pushes and pull requests run the end-to-end tests on Chromium (desktop and an Android
  phone); the nightly workflow adds Firefox, WebKit and an iPhone. Swipe, pinch and long-press tests drive
  real touch events through the DevTools protocol and therefore run on Chromium only.

## M2: data

Every rule here is also visible per element in `tools/build-report.md`, `tools/images-report.md` and the
notes inside the data.

### Spectra, levels and orbitals

- **Caps (I4).** NIST ASD lines in the visible window 380–780 nm, the strongest 400 per species; the lowest
  60 levels of the neutral atom. NIST is asked for air wavelengths where it gives them (200–2000 nm) and the
  file says which medium each line is in; the laser-cooling lines are fetched separately in vacuum.
- **Linewidth Γ** for a cooling line is NIST's Einstein coefficient A_ki divided by 2π — a named
  approximation: it assumes the upper level decays only on that line, so where there are other channels the
  true width is slightly larger. Every record says so.
- **Orbital energies** are NIST SRD 141 (LDA and related functionals), converted from hartree with the
  CODATA 2022 factor; one misaligned column in the samarium page is dropped and logged.
- **Allen electronegativity** is kept in eV, as Allen defined it, and not rescaled to look like Pauling's.

### Nuclei and metrology

- **Nuclear moments come from the IAEA level table, level 0**, not from the ground-state CSV: the CSV
  attaches excited-state moments to some ground states (it gives O-16, which has spin 0, a moment of
  1.668 μ_N). A spin-0 nucleus never gets a magnetic moment and spin 0 or ½ never gets a quadrupole
  moment, whatever a table says (Tb-154's level-0 row lists one; the note keeps it). A test checks this.
- **Clocks and standard frequencies** come from the BIPM list (fetched, never typed); its expanded
  uncertainties are divided by their coverage factor so every `unc` is a standard uncertainty. Rb-87's
  ground hyperfine frequency is taken from the same list. Caesium's defining value and the thorium-229
  nuclear transition are the only hand rows.

### The heaviest elements (Z ≥ 109) — a proposal for Fin

NIST lists nothing above hassium. SPEC §13.1 asks for a ground term for all 118 elements and IE₁ for at
least 110, so `tools/curated/superheavy.toml` holds published calculations — each row with its paper's DOI,
flagged `predicted`, and marked † on the tile, exactly like the predicted configurations. They are never
shown as measured. If Fin prefers "only theoretical predictions exist" instead, deleting the file turns them
back into Missing values; nothing else changes.

### Abundances, crystals and origins

- **Solar system.** SPEC names Lodders 2009 or Asplund 2021. We use their successor, **Lodders, Bergemann &
  Palme 2025** (Space Sci. Rev. 221, 23; CC BY 4.0), which is newer and openly licensed; Lodders 2021, which
  was tried first, is not open access. Stored: the proto-solar mass fraction (`abundance.solar`, as the spec
  asks for mass fractions) and today's log ε (`abundance.solarLogEps`, the astronomers' scale, for the log
  heatmap). Every printed column is kept in `abundance.toml`. Two errors in the source are handled openly:
  the samarium mass-fraction row is corrupted (left out) and cobalt's mass fraction disagrees with its own
  atom count by 1.3 % (kept, with a note).
- **Human body.** SPEC names Emsley's book, which we cannot quote from; we use the standard primary
  compilation instead, ICRP Publication 23 "Reference Man" (70 kg adult, 1975). Values printed as "<" are upper limits and become Missing with the limit in the note;
  rubidium is left out because its printed row repeats strontium's. It is one reference body from the 1970s,
  and the notes say so.
- **Crust and sea water** are the Jefferson Lab estimates on PubChem's element pages, flagged `estimated`.
- **Crystal structures** come from one Crystallography Open Database entry (CC0) per element, 91 elements.
  Gases and liquids are given as low-temperature solids and flagged; a temperature is stored only where the
  CIF states one. Pearson symbols use the IUCr letter S for A/B/C-centred cells (older books write C).
  Phosphorus is black phosphorus because COD has no room-temperature white phosphorus. Five rows are flagged
  doubtful with the reason (argon's 1958 cell looks about 1 % small; rubidium, technetium, mercury and
  europium for sample or precision reasons). Entries from before 1947 are avoided because of the old kX unit.
- **Cosmic origin** (`nucleosynthesis.toml`) is read off Fig. 39 of Kobayashi, Karakas & Lugaro 2020 at the
  time the Sun formed, by classifying the figure's pixels, rounded to 5 % steps — an approximate transcription
  of a model, flagged `estimated` everywhere and named as such on screen. Where the paper states the origin
  instead (H from the Big Bang, Be and B from cosmic rays) the row says `paper_statement`. Helium, lithium,
  technetium, promethium and lead cannot be read from the figure and are Missing with the reason. The
  figure itself is copyright and is not used, only the numbers.
- **Production and prices** are USGS Mineral Commodity Summaries 2026 (public domain, data release CC0). A
  price is stored only with its year and only if that year is within five years (SPEC §10.4).
- **Critical raw materials** are the lists of the EU Critical Raw Materials Act (Regulation 2024/1252). The
  field keeps the spec's name `eu2023`; the lists are the ones the 2023 proposal introduced.

### Words and pictures

- **Our own short texts** (`tools/curated/prose/{Z}.md`, 60–120 words) are written from the facts in our
  data and name the sources consulted; nothing is copied. The build checks the word count.
- **History** (`history.toml`) gives discoverers, places, years and name origins in our own words. Map
  coordinates of discovery places were left out: they would be numbers without a source.
- **Photographs.** images-of-elements.com (Jürgen Kummer, CC BY 3.0) first, as SPEC §12 suggests; Wikimedia
  Commons only where a file is pinned in `images.toml`, and only under an allow-listed licence (the most
  permissive one a file offers is used). Photos are resized, never enlarged, to 800 and 320 px WebP and shown
  unmodified otherwise; each carries title, author, licence link and source link. Elements without a photo
  get a placeholder card that says why — never seen in a visible amount, no free photo, or (new) the chosen
  photo could not be downloaded when the data was built. Wikimedia's servers answered this environment with
  "too many requests" for hours, so four pinned photos (Tc, Pm, Th, Pa) are waiting for Fin's local run.
- **Biology** (`biology.toml`) lists only what a textbook or review supports, for Fin to check.
- **Polarizability** is not compiled yet: the reference table (Schwerdtfeger & Nagle 2019) could not be read
  from here. The field stays out of v0.1 rather than being guessed.

### App

- **About page** is a dialog at `#/about` (Back closes it), like the settings: privacy statement, the coverage
  table from `coverage.json`, every source with its licence and retrieval date, and the photo-credit summary.
- **Six more maps** follow from the new tables: laser-cooled, clock species, SI history, essential for
  plants, essential for humans, cosmic origin (approximate).
- **Source status** in `sources.json` is now computed over every data file, not just `index.json`.
- **mendeleev** (MIT) was used only as a transcription of published tables (Clementi–Raimondi Z_eff,
  Allen's configuration energies); its data is credited to the original papers and the package is not a
  dependency. **Pillow** (MIT-CMU) converts photographs during data builds only.

## M3: panels, batch 1

Orbitals, electromagnetic & ionization, spectrum, and nucleus (SPEC §10.1, §10.2, §10.7, §10.8).

### Shared kit

- **Every chart** sits in `ChartFrame` (`src/viz/`): a caption saying what is plotted and from where, the
  chart measured to the available width, and "Show as table". Tables wider than a phone are wrapped in
  `SideScroll`, a labelled region that takes keyboard focus only while it overflows (WCAG 2.1.1).
- **Source chips** open a small popover (title and link, licence, retrieval date, citation); Esc closes it.
  Each panel ends with the list of every source it used.
- **Formulas** are KaTeX, rendered to HTML plus MathML so screen readers read them.
- **Element files say which companion files exist** (`files: {isotopes, spectra, levels}`), so a panel never
  asks for a file that is not there; a 404 would be a console error and would fail the 118 × 4 test.
- **`data-missing=<reason>`** on every rendered Missing value lets the property test check that each one
  names one of the five reasons.

### Orbitals (Tier A)

- **Effective charges:** Clementi–Raimondi from `zeff.toml` where the table has the subshell; otherwise
  Slater's rules (`src/physics/zeff.ts`, tested on N, Zn 4s and Zn 3d), with their own source key
  (`slater1930`). That covers hydrogen (the rules give the exact Z = 1), every element beyond radon, and
  subshells outside the configuration Clementi and Raimondi used (gadolinium's 5d). The badge names the
  fallback when it is used and the table shows its source per row.
- **Order:** by the NIST SRD 141 LDA eigenvalue when every subshell has one (Z ≤ 92); otherwise the
  Madelung order. Beyond uranium the energy column shows Missing with the reason.
- **Grid (I2):** |ψ|² on 96³ points (64³ on phones and touch screens), half-width ⟨r⟩ + 3σ. The 90 % level
  is found by a 4096-bin log histogram of the voxel densities, sorting only the boundary bin — the same
  result as sorting all voxels. |ψ|² is mirror-symmetric in x, y and z for every orbital, so one octant is
  evaluated and mirrored (the signs of ψ under each reflection are derived in `field.ts` and tested against
  direct evaluation). Marching cubes uses three.js's MIT tables in Bourke's numbering, shares each vertex
  between the cells around its edge (indexed geometry), and visits only the surface's bounding box; normals
  come from the field's gradient. About 35 ms per orbital at 96³ on the development VM.
- **Workers:** a pool of min(4, cores − 1) workers with a cache, so the gallery and the viewer never compute
  the same orbital twice; the viewer's first picture waits behind the gallery unless someone asks for it.
  The sheet mounts the panels beside the current one in advance; the gallery starts only when its panel is
  the one shown (the sheet passes `active` to every panel — an IntersectionObserver proved unreliable while
  the phone sheet slides in).
- **Thumbnails** come from one shared WebGL renderer (browsers allow only a few contexts per page; oganesson
  has nineteen subshells), each picture copied into the tile's 2D canvas. Where WebGL runs in software (no
  GPU — detected with `failIfMajorPerformanceCaveat` on a probe canvas), antialiasing is left off: in
  software it costs about four times as much. Without WebGL at all, each tile shows the |ψ|² slice.
- **The viewer** is @react-three/fiber with frames drawn on demand. OrbitControls handle dragging; the arrow
  keys already move between panels, so turning by keyboard is done with buttons (turn, tilt, reset).
  Real orbitals are coloured by the sign of ψ (orange +, blue −); complex ones by the phase of ψ on a colour
  wheel; the legend names both. Nodal surfaces are the ψ = 0 isosurface of real orbitals.
- **Shell stack:** P(r) = r²R² on a linear axis, or r·P(r) on a logarithmic one (probability per unit ln r,
  so areas still compare); the log axis is the default above calcium, where the inner shells would otherwise
  be needles at r ≈ 0. Each curve holds one electron. On the linear axis the y scale follows the valence and
  chosen curves and the inner shells run off the top (the caption says so; the table has their peaks).
  Line style and colour both encode l, and every curve is labelled.
- **Timing (M3 acceptance):** the gallery marks its start and its last picture (`pte:orbitals-ready`) and
  says on screen how long it took on this device, so Fin can check the 2 s criterion on his Mac without
  tools. `tests/e2e/orbitals.spec.ts` asserts 2 s (desktop) and 6 s (phone profile) times
  `PTE_PERF_FACTOR`, 4 by default for CI runners, which are slower and draw WebGL in software; set it to 1
  on an M1 Mac to check the criterion itself.

### Electromagnetic & ionization

- **The ladder** shows every stage NIST lists, on a log axis in the unit chosen in Settings, with dashed lines
  at the noble-gas cores; interpolated and calculated values (NIST's [ ] and ( )) are hollow points.
- **Mulliken electronegativity** is computed in the app, (IE₁ + EA)/2, with its formula shown; it is not a
  stored value. Properties that are not compiled yet (polarizability, magnetic ordering, resistivity,
  superconductivity, work function, band gap) are listed as Missing with the reason, not hidden.

### Spectrum

- **Colours (SPEC §11.6):** CIE 1931 2° colour-matching functions → XYZ → linear sRGB (matrix derived from
  the sRGB primaries and D65) → sRGB encoding; out-of-gamut colours are desaturated toward white. The
  observer table is fetched from the CIE (SHA-256 checked against the CIE's metadata). **Licence note for
  Fin:** the table is the numerical content of an international standard (CIE 018:2019, ISO/CIE 11664-1),
  used as a cited standard table; the CIE's own data file is CC BY-SA 4.0. If Fin prefers not to rely on
  that, the alternative is the analytic fit of Wyman, Sloan & Shirley (2013), a published formula with no
  table (differences well below what a screen shows).
- **The strip** shows the neutral atom's visible lines, brightness √(I/I_max) with a floor of 0.12 so faint
  lines stay visible; lines without a NIST intensity are dashed. "Approximate overall glow" mixes the lines'
  colours by intensity and says it is an approximation. The short legend of NIST's line codes (r, h, w, bl,
  *) is explanatory text taken from NIST's own legend, not data.
- **Grotrian diagram:** columns by term (multiplicity, L, parity); transitions are matched to levels within
  2 × 10⁻⁴ eV; laser-cooling transitions are matched by E = hc/λ (vacuum) and clocks by E = hν. Levels above
  the ionization limit (autoionizing) stay in the table but are not drawn. The limit line is NIST's first
  ionization energy.

### Nucleus

- **The isotope strip** puts half-life on a log axis with named times; the decay mode is a texture as well as
  a colour; abundance is a dot whose size follows it; magic neutron numbers are dashed lines.
- **One year for half-lives:** the IAEA gives half-lives in seconds with the mean tropical year,
  365.242 198 78 d; the app converts back with the same year (`src/physics/decay.ts`, checked against the
  data), so a half-life in years reads exactly as IAEA gives it.
- **Cosmic origin beyond bismuth:** AGB stars cannot make thorium or uranium (their slow neutron captures end
  at lead and bismuth). The green share Kobayashi et al.'s Fig. 39 shows for them is material those stars
  returned in their winds; the curated rows mark it `recycled = ["agb"]` and the panel says "returned, not
  made". A pipeline test keeps any AGB share beyond bismuth from being presented as production.
- **Thorium-229:** the nuclear clock frequency with its paper, and E = hν from the exact SI values of h and e.

### Data fixes found while building the panels

- NIST levels tables list series limits above the ionization limit; the lowest "Limit" row is now kept
  (32 files had a higher one). A test compares every limit with the first ionization energy.
- Isotope mass uncertainties are converted from µu in decimal (no more 2.8699999999999996e-07 u).
- A limit on a level width is worded as the opposite limit on the half-life.
- `refresh_source_status` adds new registry entries and keeps every existing retrieval date.

### Phones

- The element sheet's header (photographs, summary) folds to a name bar once the reader scrolls into a long
  panel, and opens again at the panel's top or with "Show photographs and summary"; the tab row scrolls so
  the current tab is always in sight.
- **Who moves the strip:** while the app scrolls the panel strip to a panel (a tab, a key), only arriving at
  that panel counts; a touch, a pointer press or the wheel hands the strip back to the reader, whose swipe
  then selects the panel it settles on. Before, the end of an earlier scroll could land after the next panel
  had been chosen and undo it.

## M4: panels, batch 2

Probability, physical, mathematical, AMO, chemistry, biology and history (SPEC §10.3–10.6, §10.9–10.11).

### Shared

- **The property test covers all eleven panels** (`tests/e2e/panels.spec.ts`, 118 × 11): no console error,
  no "NaN", "undefined", "Infinity" or "[object Object]" on screen (the panels' own wording avoids those words
  too), every Missing value with one of the five reasons, and every ionization stage drawn.
- **"Not yet compiled" is not "not measured".** Properties PTE-21C has not gathered yet (on the electromagnetic
  panel: magnetic ordering, resistivity, superconductivity, work function, band gap) are named under "Not yet
  compiled in PTE-21C" as plain text. In M3 they were shown as Missing `not_measured`, which was untrue: they
  have been measured; we have not compiled them.

### Electromagnetic: polarizability

- **Static dipole polarizability** of all 118 neutral atoms from Schwerdtfeger & Nagle's 2018 table (Mol. Phys.
  117, 1200 (2019)), the recommended value with its uncertainty, in atomic units, and as a volume in Å³
  (1 a.u. = a₀³, a₀ from CODATA). Transcribed via mendeleev 1.3.0 (MIT), whose metadata cites the table as
  updated by its authors; mendeleev is not a dependency. The table mixes experiment and high-level theory; each
  value's note says so.

### Mathematical & theoretical

- **Computed, not stored.** Quantum numbers, Hund's rules, the Landé formula, Slater's arithmetic and the
  relativity estimates are pure functions in `src/physics/` (`terms.ts`, `zeff.ts` `slaterSteps`,
  `madelung.ts` `anomalyKind`, `relativity.ts`), unit-tested. The only stored inputs are the measured
  configuration and term (NIST), NIST's Landé factors (levels files), CODATA (now with the electron
  g-factor) and `relativity.json`.
- **Hund's rules with several open subshells** (Gd, U, Ru, Pt, …): the spins and orbital momenta are added and
  the third rule is taken from the subshell carrying the largest L. With that, Hund's rules reproduce NIST's
  ground term for every element in LS coupling except cerium (4f 5d pair into ¹G°₄), and the panel says when
  they disagree. For jj-coupled ground levels (Pb, Sg, Bh, Hs) the panel explains why S and L are not good
  quantum numbers instead of comparing.
- **Landé factor:** the LS formula with g_L = 1 and g_s = |g_e| from CODATA, applied to the measured term where
  NIST gives one in LS coupling (else to Hund's term), next to NIST's measured g_J. J = 0 levels have none
  (not_applicable), even where NIST's table prints 0.
- **Aufbau anomalies** are classified by what moved where: an s electron into a d shell left half full or full
  (Cr, Cu, Mo, Pd, Ag, Au); an s electron into d otherwise (Nb, Ru, Rh, Pt); an f electron in d (La, Ce, Gd,
  Ac, Th, Pa, U, Np, Cm); a d electron in p (Lr, relativistic). The explanation is one of four short texts and
  is labelled "explanation, not derivation", as SPEC §10.5 asks.
- **Screening:** Slater's rules for the outermost electron (largest n, then largest l — the one IE₁ removes for
  nearly every element), with each kind of shielding electron, its count and its share; Clementi–Raimondi's
  value for comparison; IE ≈ R∞hc·Z_eff²/n² (and Slater's own n* for n ≥ 4) against NIST's IE₁.
- **Relativity:** v/c ≈ Zα, γ and the 1s contraction 1/γ (Bohr model, named on screen); the point-nucleus limit
  Z = 1/α computed from CODATA; the finite-nucleus limit (≈ 172–173) and four notes where relativity changes
  chemistry (gold's colour, liquid mercury, the lead–acid battery, francium's IE₁ above caesium's), our own
  words, one Crossref-checked paper each, in `tools/curated/relativity.toml` → `public/data/relativity.json`.
- **Symmetry note:** two paragraphs on SO(4) (Fock 1935) and SO(4,2) (Barut & Kleinert 1967) and the 2n²
  degeneracy; registered as references and cited with source chips.

### Chemistry & bonding

- **One curated row per element** in `tools/curated/chemistry.toml`, in our own words: typical bonding,
  reactions with air, water and acids (each note with its source), one to four well-known compounds and an
  example compound for each common oxidation state. `tools/build_chemistry.py` writes the `chemistry` section
  of each element file.
- **Every compound formula is checked against PubChem** (`tools/fetch_pubchem_hsdb.py` caches the compound
  records; 343 compounds cite `pubchem_compounds`). A compound whose PubChem formula disagrees is left out and
  reported. Where PubChem's record is wrong (Li₃N, HfC, TaC, RaCl₂, PuO₂, the Pa and Po oxides) the row cites
  Greenwood & Earnshaw instead; Bh and Hs compounds cite their papers by DOI. A row key `lookup` names
  compounds PubChem files under another name.
- **Reactivity sources** are HSDB and CAMEO Chemicals (the records PubChem holds for the element), or Greenwood
  & Earnshaw where there is none. Each source is registered separately and cached under its own folder in
  `tools/raw/`, so each gets its own retrieval date. CAMEO's facts are restated in our own words only, because
  some CAMEO data belongs to its providers. The panel says these notes describe chemistry, not safe handling.
- **Where nothing is known** the row gives the Missing reason: At, Fr and Es–Lr `not_measured`; Rf–Og
  `not_measured` or `predicted_only` (Türler & Pershina 2013; oganesson Smits et al. 2020); He, Ne and Ar
  compounds `not_applicable`. Rows with only Missing notes name their source in `note_source`, written to
  the element file as `chemistry.sources`.
- **Ions in solution:** where a common oxidation state is found mainly as an ion (NpO₂⁺, PuO₂⁺, AmO₂⁺, AmO₂²⁺)
  the example is the ion, citing Greenwood.
- **Sizes:** Shannon's effective ionic radii (1976; 276 rows over 91 elements, transcribed via mendeleev 1.3.0)
  at coordination 4, 6 and 8 plus the rows Shannon marks most reliable; the ladder shows the six-coordinate
  radius, else Shannon's most reliable, else the first. Covalent (Cordero 2008) and van der Waals radii come
  via PubChem. Metallic radii are not shown: no documented source is registered yet, and the caption says so.
- **Oxidation states** are PubChem's list, common ones in bold as on the tile. Where PubChem's "common" list
  is odd (Pd +3) a note says so; the tile's data is not changed.

### Physical & engineering

- **Basics** (phase, density, melting and boiling points) are PubChem's, in the temperature unit chosen in
  Settings; PubChem gives no uncertainties and the panel says so.
- **Heat capacity:** molar C_p at 25 °C for 85 elements from the CRC Handbook (95th ed.), transcribed via
  mendeleev 1.3.0, whose metadata cites that table, and spot-checked (Fe, Gd, Hg, H₂). The specific heat is
  computed from it and the standard atomic weight, with the formula shown.
- **Crystal structure:** cell parameters from the Crystallography Open Database entry already in the data, and a
  3D unit cell drawn to scale for ten common structure types (the rest show parameters only). three.js loads
  only when a 3D view is first shown, and the cell is drawn only while the panel is open.
- **Abundance** in four places on one log scale (crust, sea water, Solar System, human body). The pipeline puts
  all four on mg/kg (`abundanceByMass`), so the 70 kg reference body stays out of app code; a litre of sea
  water is taken as one kilogram, and the caption says so.
- **Production and price:** USGS world production and a dated unit value; values older than five years are
  not shown. The EU critical-raw-material flag sits here.
- **Uses:** 2–5 bullets per element in our own words, each with its source (mostly USGS, else PubChem, the
  IUPAC discovery reports or BIPM), and only what the source supports. Elements 101–118 say there is no use
  outside research.
- **GHS hazards** from PubChem's compound records: the EU harmonised classification where one exists (29
  elements), else the ECHA C&L notification summary with the most reports (55), with the share of reports
  behind each statement and, prominently, the share saying the substance is not hazardous (iron: 74 %). 34
  have none: not_measured up to Fm (radioactive ones with a note), not_applicable from Z = 100 on, where no
  substance exists to classify. The pictograms are drawn as our own red-bordered diamonds with the code and
  name, not the official symbols. The biology panel shows the same label.
- **Thermal conductivity, expansion, elastic moduli, speed of sound and hardness** are listed as "not yet
  compiled": the only primary table found for conductivity is a scanned PDF.
- **One source per book:** the allotropes and the chemistry panel cite the same Greenwood & Earnshaw entry.

### AMO & metrology

- **Hyperfine:** one card per curated isotope with I, J, A, B and the ground splitting, and an F-level diagram
  with the splitting to scale. Where only the J = ½ splitting is stored, A = splitting ÷ (I + ½), labelled
  "computed; its sign is not given". No hyperfine structure gives not_applicable with the reason (helium:
  I = 0 and J = 0); an element not yet in the curated table gives not_measured with the note "Not yet in
  PTE-21C's curated hyperfine table" (none of the five reasons is closer).
- **Clocks** from the BIPM list, with relative uncertainty and role (Cs defines the second; the Th-229 nuclear
  transition links its paper). **Laser cooling:** λ and Γ/2π from NIST, the Doppler and recoil limits and the
  saturation intensity computed from CODATA and labelled "(computed)", and the first MOT, BEC and degenerate
  Fermi gas with their DOIs. Rows for the natural mixture use the standard atomic weight for the recoil, and
  say so.
- **The timeline of the second** is shared by all elements; this element's entries are marked ◆ and in bold.

### Probability & statistics

- **Where is the electron:** P(r) and its cumulative curve for any subshell, hydrogenic with Clementi–Raimondi
  Z_eff (the same badge as the orbitals panel), the most probable and mean radii marked, and a radius slider.
- **Bosons and fermions** per isotope; the BEC and degenerate-Fermi-gas badges appear only on rows for a
  specific isotope.
- **Thermal motion:** Maxwell–Boltzmann speeds and the thermal de Broglie wavelength, with a log temperature
  slider from 1000 K down to half the recoil limit for laser-cooled elements (else 0.1 μK), and the density a
  condensate would need.
- **Uncertainty:** the NIST bracket notation explained once, with this element's most and least precisely known
  values; "least precisely known" skips values whose uncertainty is as large as the value, and says so.

### Number formatting

- A stored unit with a subscript (`μ_N`, the nuclear magneton) is written μ with subscript N.
- A very large value whose uncertainty is in the thousands or more switches to powers of ten:
  2.020 407 384 335(2) × 10¹⁵ Hz rather than 2 020 407 384 335 000(2000) Hz.

### Biology & ecology, history & naming

- **Builders** for both panels live in `tools/build_lifeandhistory.py`, called from `build_details.py`.
- **New `biology.toml` rows** (isotope uses, soil and food-web notes, toxicity notes, IARC groups) each carry
  their own source; primary-literature rows a Crossref-checked DOI. Fin reviews them (STATUS.md).
- **IARC groups are never typed:** IARC's published list is read at build time and the build fails if an
  agent named in `biology.toml` is not on it. The panel uses IARC's own group names.
- **No toxicity note is not "safe":** where there is none the panel says "We have no curated note… That does
  not mean it is safe." GHS labels appear only where the physical panel's data has them.
- **Discovery places on a map:** coordinates from Natural Earth (22 places) and GeoNames (8; CC BY 4.0);
  Wikidata refused requests (HTTP 429) and was not used. The map is Natural Earth 1:110m land, simplified
  to 0.25° and cut below 60° S (32 KB). Eight discoveries have no single place in `history.toml` (Ti, Ga, As,
  Te, Sm, Dy, Ho, Pt); the panel says so rather than guessing one.
- **Timeline:** all 118 discoveries in decade columns, this element outlined and labelled, with a table view.
- **Historical photos:** only the four already vendored (Pm, Ra, Cm, Fm); nothing new was taken from Commons.
  The K-40 isotope-use row was dropped because its UNSCEAR page could not be reached to check it.

## M5: release v0.1.0

- **Attribution name:** "Serafin Bietenhader" (Fin's answer to F1), in the footer, the About page, the README
  and `package.json`.
- **Version on screen:** the version comes from `package.json` through Vite (`__APP_VERSION__`), so the page,
  the About dialog and the release can never disagree. It replaces the "preview" note above the table.
- **The release is made by GitHub, not from this sandbox:** `.github/workflows/release.yml` is started by hand
  on `main` with the version. It refuses unless `package.json` has that version, `CHANGELOG.md` has a section
  for it and the tag is new, then creates the tag `v<version>` and the GitHub Release with that changelog
  section as its notes, using the workflow's own token and the `gh` tool on the runner (no third-party
  action). No build is attached: the site is on GitHub Pages, and GitHub adds the source archives itself.
- **Coverage on the About page** now counts the M4 fields too, each with a note on why the rest have none.
- **README "Honest limitations":** approximations, predictions for Z ≥ 109, what is not compiled yet,
  transcribed tables, hazard labels, photographs, browsers.

## After M5

Fin's look at the live site, on desktop and on his iPhone (video, 22 October 2026).

### The sheet on iPhones

- **The sheet on short phone screens.** The phone layout stacked the photographs and summary, the tab row
  and the panel in a full-height column, and the header was meant to fold once the reader scrolled into a
  panel. On an iPhone with Safari's bars (about 375 × 548 to 393 × 659 CSS pixels) the header alone was
  taller than the screen: the tab row started below the bottom edge, the panel got no height, so it could not
  be scrolled and the header never folded. The Pixel 7 profile the tests used is tall enough to hide this.
  Now the photographs and summary sit in a box of at most 34 % of the dynamic viewport height that scrolls
  on its own (on desktop the box is `display: contents` and the grid is unchanged); panels end with extra
  room (4 rem plus the safe-area inset) so their last lines can scroll above a floating browser toolbar.
  `tests/e2e/sheet.spec.ts` checks both iPhone sizes: the tab row in the top 70 % of the screen, at least a
  quarter of the screen for the panel, a tap on a tab switches it, and the header folds.

### Biology: six groups of life

- **Fin's request:** "Does life need it?" shows six cards — humans, animals, plants, fungi, bacteria,
  archaea — instead of two. Humans and plants keep their M2 rows and wording unchanged.
- **Data model:** `[[life]]` rows in `biology.toml`, one sourced sentence each (`Z`, `group`, `status`,
  `role`, `source`, `doi`, optional `note`). `build_lifeandhistory.py` merges them into
  `biology.groups.{animals,fungi,bacteria,archaea}` = `{status, roles: [SourcedText, …], note?}`, so a
  group can carry several sentences with their own sources. The build stops on an unknown group, status
  or column, an unregistered source, primary literature without a DOI, rows for one element and group
  that disagree on the status, or two notes for them.
- **Status vocabulary:** `essential` (needed by essentially all members of the group), `some` (used by
  some members — from a few to most — but not all; the sentence says which; shown as "Used by some, not
  all"), `beneficial` (helps, not required), `none` (a source says the group does without it, e.g. fungi
  and selenium). With no row the card says no role is known from PTE-21C's sources and that this does
  not mean there is none — never "not essential", because for microbes absence from a review is not
  evidence of absence. Status is in words; the card border repeats it, never alone.
- **Sources:** open reviews first (Maret 2016, CC BY; Wackett et al. 2004; Zhang & Gladyshev 2011;
  Cyert & Philpott 2013 for baker's yeast), Gladyshev's group's genome surveys for Mo, Ni/Co and Cu,
  Suttle's *Mineral Nutrition of Livestock* (5th ed., 2022; one chapter per element, by DOI; every sentence
  checked against Fin's copy of the book, facts only) for farm animals, including the elements its chapter 17
  counts as "occasionally beneficial" (status `beneficial`), and single
  papers for striking cases (lanthanide methanol dehydrogenase, tungsten enzymes, F430, bromine and
  collagen IV, haemocyanin, vanadium nitrogenase and chloroperoxidase). Every DOI was checked against
  Crossref. Fin reviews all rows.
- **Coverage:** four new rows in the coverage table ("Biology: a role in …"); a `none` row does not count.

## Tooling

- Versions are pinned exactly. TypeScript 6.0 is used because typescript-eslint does not yet support
  TypeScript 7; ESLint 9 because eslint-plugin-jsx-a11y (6.10.2, still the latest in M1) does not support
  ESLint 10 yet — ESLint 9 is past end of life, which matters only for a developer tool; revisited each
  milestone. Playwright is pinned to 1.56.1 to match the browsers in the cloud
  environment, with a single `playwright-core` enforced through npm `overrides`.
- `PW_PORT` lets two checkouts run their Playwright tests side by side, each with its own preview server.
- Lighthouse is run through its own CLI (Apache-2.0) rather than Lighthouse CI: `@lhci/cli` 0.15 pulls in
  seventeen known vulnerabilities and a package without a licence field, and is not needed for four budgets.
- Two development-only tools are MPL-2.0 (weak copyleft): axe-core (accessibility tests) and lightningcss
  (inside Vite). Neither is shipped to visitors; `npm run check:licences` enforces that only permissive
  packages are.
- Coverage thresholds live in `tools/coverage.toml`, each tagged with the milestone from which it applies,
  so the SPEC §13.1 targets that need M2 data switch on with M2 instead of being weakened.
- `tools/build-report.md` is committed so reviewers see every disagreement between sources and every rule
  applied, and its diff shows what changed after a data refresh.
