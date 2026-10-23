# PTE-21C — Experience the Elements

## Build Specification v1.0

**A quantum-aware, photographic, swipeable periodic table for the web.**
*Subtitle: A fresh perspective on the Periodic Table of the Elements.*

> Status: v1.0, 20 October 2026 · Author: Fin (Bietenhader) with Claude · Licence of the project: CC BY-NC-SA 4.0
> Repository: https://github.com/Bietenhader/PTE-21C-Experience-the-Elements
>
> This document is the authoritative source of truth for the implementer (Claude Code). Decisions marked
> **LOCKED** are settled and must not be re-litigated. Items marked **IMPLEMENTER'S CHOICE** are open.
> Items marked **FIN** need a human answer; proceed with the stated default until one arrives.
> When the spec and your instinct disagree, follow the spec and leave a note in `STATUS.md`.

---

## 0. TL;DR for the implementer

Build a static web app (React + TypeScript + Vite, deployed to GitHub Pages) that shows the periodic table of the
elements and, for every element:

1. **Hover** → a floating card with 2–3 photographs of the element in its material form, name, symbol, Z, category,
   and one quantum fact.
2. **Click** → the card pins into a large sheet with **eleven swipeable panels** (trackpad, touch, arrow keys, tabs),
   each a visual deep-dive into one family of properties: orbitals; electromagnetic & ionization; probability &
   statistics; physical & engineering; mathematical & theoretical; AMO & metrology; nucleus & isotopes; spectrum &
   energy levels; chemistry & bonding; biology & ecology; history & naming.
3. **Layouts** → the table itself morphs between the standard 18-column form, the 32-column long form, Janet's
   left-step table and Tsimmerman's ADOMAH table, with a group-3 toggle (Lu/Lr default, La/Ac optional).
4. **Trends** → arrow overlays for the classic monotone trends, heatmaps for any numeric property, and categorical
   maps (block, state, Madelung anomalies, laser-cooled species, SI-defining elements, …).

Everything is generated from public-domain or permissively licensed sources by a Python pipeline that records
provenance for every number. The app makes **zero network requests at runtime**: data and images are vendored.

What makes this more than another periodic table is honesty about quantum reality: measured ground-state
configurations with Madelung-rule violations flagged, term symbols, isotope-resolved values where nature is
isotope-resolved, orbital pictures with their approximation named on screen, relativity made visible, and the
atomic-physics layer that the SI itself is built on (hyperfine splittings, clock transitions, laser cooling).

**A plausible number without a source is a worse failure than a visible gap.** Design accordingly.

---

## 1. Purpose, audience, non-goals

### 1.1 Purpose

Give a curious person an *experience* of each element: what it looks like, what its electrons are doing, where its
numbers come from, and how it connects to the physics of measurement. Make the quantum structure of the table
visible instead of implied.

### 1.2 Audience

Curious adults and students first; physicists, chemists and AMO people second (they will check the numbers — the
numbers must have sources); educators third (projector-friendly dark mode, large type, shareable deep links).

### 1.3 Non-goals (say these plainly in the README)

- Not a chemistry calculator, not a molecule viewer, not a quiz/game. (Molecules may come in a later major version.)
- No accounts, no server, no analytics, no telemetry, no AI chat.
- Not a replacement for NIST, IAEA or PubChem. Every panel links out to its sources.
- No invented values. If a quantity has not been measured, the app says so. If it does not apply (no hyperfine
  structure because I = 0), the app says why.
- No English prose copied from Wikipedia or other share-alike sources (§15). All prose is written for this project.

---

## 2. Principles — LOCKED

These are the project's invariants. Several are test-enforced (§13).

1. **No number without a source.** Every numeric value in the data files is a `Quantity` carrying `unit`,
   `source` (a key into the sources registry) and, where the source gives one, `unc`. The UI can show the source
   of any number in one click.
2. **Missing is shown as missing, with a reason.** Never `0`, never a bare dash. Reasons: `not_measured`,
   `not_applicable` (with a note such as "I = 0, no hyperfine structure"), `no_stable_isotope`, `predicted_only`,
   `source_unavailable_at_build`.
3. **Approximations are named on screen.** Hydrogenic orbitals carry the badge "hydrogenic approximation,
   Clementi–Raimondi Z_eff"; interpolated ionization energies carry NIST's own flags; nucleosynthesis fractions
   carry "approximate".
4. **Isotope-resolved where isotope-dependent.** Mass, spin, moments, hyperfine, half-life and abundance are
   stored per isotope. Element-level headlines are derived and labelled with the isotope they come from.
5. **Measured over conventional.** Ground-state configurations and term symbols come from NIST, not from the
   Aufbau rule. The Aufbau prediction is shown alongside, and disagreement is flagged, not hidden.
6. **Everything regenerated from sources.** The pipeline produces every data file. Hand-curated data lives in
   TOML files with a source per row; hand-written prose lives in Markdown per element. Nothing is typed into the
   app code.
7. **Zero runtime network.** All data, images and fonts are vendored. A Playwright test asserts that no request
   leaves the page's origin.
8. **Reproducible.** `python tools/pipeline.py --all` from a clean checkout rebuilds `public/data/` and
   `public/img/` byte-for-byte except for retrieval timestamps.
9. **Accessible.** Keyboard-complete, screen-reader labelled, WCAG 2.2 AA contrast, no meaning carried by colour
   alone, `prefers-reduced-motion` respected.

---

## 3. Locked decisions

| Decision | Value |
|---|---|
| Name | **PTE-21C — Experience the Elements**; short name `PTE-21C`; package name `pte-21c` |
| Subtitle | "A fresh perspective on the Periodic Table of the Elements" |
| Licence | **CC BY-NC-SA 4.0** for code and content (§15). Not OSI "open source"; described as "free for non-commercial use, copyleft" |
| Platform | Static web app, GitHub Pages, no backend |
| Stack | React 19 + TypeScript (strict) + Vite; three.js via @react-three/fiber; D3 for 2D charts; KaTeX; Floating UI; Zustand; CSS Modules with design tokens; npm |
| Pipeline | Python 3.11+, `tools/`, output committed to `public/data/` and `public/img/` |
| Layouts | 18-column standard, 32-column long form, Janet left-step, ADOMAH — switchable with animated morph |
| Group 3 | Default **Lu/Lr under Sc/Y** (IUPAC 2021 provisional suggestion); toggle to La/Ac |
| Element scope | Z = 1–118 in v0.1. Data model and layouts designed for Pyykkö's predicted 119–172, shipped in v0.2 |
| Orbitals | Tier A (hydrogenic + Z_eff, computed in browser) in v0.1; Tier B (precomputed Hartree–Fock radial functions) in v0.2 |
| Panels | Eleven (§10), in the fixed default order given there |
| Images | Vendored, curated, 2–3 per element; honest placeholders where no free photograph of the bulk element exists |
| Mobile | Pinch-zoomable table with search; tap opens a full-height bottom sheet; long-press peeks (hover equivalent) |
| Hover | 150 ms hover intent; keyboard focus shows the card; click pins |
| Routing | Hash routing (`#/Cs/amo`) in v0.1; prerendered per-element pages with Open Graph tags in v0.2 |
| Launcher | `PTE-21C.command` at repo root (Fin opens tooling from Spotlight; `.command` launches in Terminal) |
| Language | English UI in v0.1 |
| Reference for the tile | Fin's current table (Robert Campion, 2016/2018 design): weight or most-stable mass number, Z, 1st IE in kJ/mol, Pauling electronegativity, oxidation states with common ones bold, symbol, name, electron configuration, category colours — plus the slot it lacks: **ground-state hyperfine splitting** |

---

## 4. Architecture

### 4.1 Data flow

```
 public sources (PubChem, NIST ASD/AWIC/SRD141, IAEA LiveChart, BIPM, Bunge RHF, Commons, images-of-elements.com)
        │  tools/fetch_*.py  (cached raw responses in tools/raw/, gitignored)
        ▼
 curated TOML (tools/curated/*.toml, one source per row) + prose (tools/curated/prose/{Z}.md)
        │  tools/build.py  (normalize → Quantity/Missing → validate against schema/ → emit)
        ▼
 public/data/*.json (committed)  +  public/img/elements/** (committed)  +  PROVENANCE.md, CREDITS.md
        │  vite build
        ▼
 static site → GitHub Pages
```

The pipeline is a developer tool, not a build step. CI never fetches from the internet; it validates the committed
data against the schema and runs the tests.

### 4.2 Repository layout

```
PTE-21C-Experience-the-Elements/
├── README.md                 ← what, why, screenshots, how to run, how to contribute, licence, credits
├── LICENSE                   ← full CC BY-NC-SA 4.0 legal code
├── NOTICE.md                 ← third-party software licences (MIT/ISC/Apache/OFL notices)
├── CREDITS.md                ← generated: every image with author, licence, source
├── PROVENANCE.md             ← generated: every data source, licence, retrieval date, field coverage
├── CONTRIBUTING.md           ← short; contributions are under CC BY-NC-SA 4.0; how to add a curated row
├── CHANGELOG.md
├── STATUS.md                 ← living status: current milestone, open bugs, notes for Fin (update every session)
├── SPEC.md                   ← this document
├── CLAUDE.md                 ← implementer memory: invariants, commands, conventions
├── PTE-21C.command           ← launcher: installs deps if needed, starts dev server, opens browser
├── package.json · vite.config.ts · tsconfig.json · index.html · .nvmrc
├── public/
│   ├── data/
│   │   ├── index.json                 ← tile-level data for all elements (one small file)
│   │   ├── elements/{Z}.json          ← per-element detail for the panels
│   │   ├── isotopes/{Z}.json          ← per-isotope records
│   │   ├── spectra/{Z}.json           ← visible lines for the spectrum strip
│   │   ├── levels/{Z}.json            ← lowest energy levels + transitions for the Grotrian diagram
│   │   ├── layouts/{standard18,long32,janet,adomah}.json
│   │   ├── trends.json                ← trend definitions (§8)
│   │   └── sources.json               ← the sources registry
│   ├── img/elements/{Z}/{k}-800.webp, {k}-320.webp, credits.json
│   └── fonts/                         ← self-hosted OFL fonts
├── schema/                            ← JSON Schema for every file in public/data
├── src/
│   ├── app/        routes, shell, settings store, theming
│   ├── table/      Table, Tile, layout engine, morph (FLIP), zoom/pan, legend, trends overlay
│   ├── hover/      HoverCard
│   ├── sheet/      ElementSheet, PanelStrip (scroll-snap), PanelTabs, panel registry
│   ├── panels/     orbitals/ em/ probability/ physical/ math/ amo/ nucleus/ spectrum/ chemistry/ biology/ history/
│   ├── physics/    hydrogenic.ts zeff.ts madelung.ts relativity.ts lasercooling.ts hyperfine.ts decay.ts
│   │               thermal.ts constants.ts units.ts color/cie.ts
│   ├── viz/        shared D3 chart components, Orbital3D (three.js), SpectrumStrip, UnitCell
│   ├── data/       loaders (lazy per element/panel), generated TypeScript types, Quantity helpers
│   └── ui/         Quantity, Missing, SourceChip, Badge, Formula (KaTeX), Credit
├── tools/
│   ├── pyproject.toml (ruff, pytest)  ·  pipeline.py (orchestrator)  ·  build.py
│   ├── fetch_pubchem.py  fetch_nist_gsie.py  fetch_nist_awic.py  fetch_nist_levels.py  fetch_nist_lines.py
│   ├── fetch_nist_srd141.py  fetch_iaea.py  fetch_bipm.py  fetch_images.py  build_layouts.py
│   ├── build_rhf.py (v0.2)  report.py (coverage + licence audit)
│   ├── curated/   hyperfine.toml lasercooling.toml clocks.toml si_history.toml nucleosynthesis.toml
│   │              biology.toml history.toml crystal.toml abundance.toml production.toml zeff.toml
│   │              electronegativity_allen.toml images.toml (overrides/exclusions) prose/{Z}.md
│   └── tests/
├── tests/e2e/                          ← Playwright
├── docs/  approach.md  data-sources.md  design.md  honesty.md  layouts.md
└── .github/workflows/  ci.yml  deploy.yml
```

### 4.3 Design rules the implementer must hold to

1. **The sources registry is the single source of truth for provenance.** No `source` string that is not a key in
   `sources.json`; CI fails otherwise.
2. **Panels are plugins.** Each panel is a folder exporting `{ slug, title, summary, Component, needs }` and is
   registered in one list. The sheet knows nothing about individual panels. Adding a panel is a folder plus one
   registration line.
3. **Physics is pure and tested.** Everything in `src/physics/` is a pure function with unit tests and no React.
4. **Layouts are data.** A layout is a JSON map Z → `{col, row, labels}` produced by `build_layouts.py`; the morph
   animates between two such maps. No layout logic lives in components.
5. **Nothing is unbounded.** Spectral line lists are capped (§10.8); level diagrams are capped; the orbital grid
   resolution adapts to device; image sizes are fixed.
6. **Explain, don't assert.** Every chart has a caption that says what is plotted and from where.

---

## 5. Core data model

Generated TypeScript types live in `src/data/types.ts`, produced from `schema/` (use `json-schema-to-typescript`).
Shapes, in TypeScript for readability:

```ts
type SourceId = string;                     // key of sources.json

interface Quantity {
  value: number;
  unc?: number;                              // standard uncertainty in the same unit, when the source gives one
  unit: string;                              // SI-ish unit string from the units table (§5.2); "" for dimensionless
  source: SourceId;
  flag?: "measured" | "calculated" | "interpolated" | "estimated" | "predicted";
  note?: string;
}

interface Interval {                         // IUPAC standard atomic weight intervals (H, Li, B, C, N, O, Mg, Si, S, Cl, Ar, Br, Tl, …)
  low: number; high: number; unit: "u"; source: SourceId; conventional?: number;
}

interface Missing {
  missing: true;
  reason: "not_measured" | "not_applicable" | "no_stable_isotope" | "predicted_only" | "source_unavailable_at_build";
  note?: string;                             // e.g. "I = 0 for all stable isotopes: no hyperfine structure"
}

type Q = Quantity | Missing;

interface TextFact { text: string; source: SourceId; }

interface Configuration {
  measured: string;                          // "[Xe] 4f14 5d9 6s1"  (NIST)
  aufbau: string;                            // "[Xe] 4f14 5d10"     (generated by the Madelung rule)
  anomalous: boolean;                        // measured !== aufbau
  valenceSubshells: Array<{ n: number; l: number; occupancy: number }>;
  source: SourceId;
}

interface GroundTerm { term: string; S: number; L: number; J: number; gJ?: Q; source: SourceId; }  // "2S1/2"

interface ImageRef {
  file: string;                              // "img/elements/55/1-800.webp"
  thumb: string;                             // "img/elements/55/1-320.webp"
  width: number; height: number;
  title: string; author: string; licence: string; licenceUrl: string; sourceUrl: string;
  kind: "sample" | "discharge_tube" | "crystal" | "powder" | "liquid" | "historical" | "placeholder";
}

interface ElementIndexEntry {                // public/data/index.json — one entry per element, kept small
  Z: number; symbol: string; name: string;
  category: Category;                        // see §7.3
  block: "s" | "p" | "d" | "f";
  period: number; group: number | null;      // group null for f-block in 18-column form
  standardState: "solid" | "liquid" | "gas" | "unknown";
  atomicWeight: Quantity | Interval | Missing;
  mostStableMassNumber?: number;             // shown in parentheses when atomicWeight is Missing
  radioactive: boolean;                      // no stable isotope
  ie1: Q;                                    // kJ/mol stored; eV displayed on toggle
  electronegativityPauling: Q;
  oxidationStates: { common: number[]; other: number[]; source: SourceId };
  configuration: Configuration;
  groundTerm: GroundTerm | Missing;
  hyperfineHeadline: { isotope: number; splitting: Quantity } | Missing;  // ground-state hfs of the reference isotope
  quantumFact: string;                       // one line for the hover card, generated (§9.1)
  images: ImageRef[];                        // 1–3; placeholder allowed
  flags: { laserCooled: boolean; clockSpecies: boolean; siHistory: boolean; madelungAnomaly: boolean; essentialHuman: boolean; essentialPlant: boolean; };
}
```

`elements/{Z}.json` holds the per-panel detail and is loaded when the sheet opens. Its schema is organized by
panel slug (`orbitals`, `em`, `probability`, …) so a panel reads only its own section; §10 lists the fields.

### 5.1 Headline derivation rules

- `atomicWeight`: NIST AWIC standard atomic weight; interval elements stored as `Interval` with the IUPAC
  conventional value; elements without a standard atomic weight get `Missing{reason:"no_stable_isotope"}` and
  `mostStableMassNumber` = mass number of the longest-lived isotope (from IAEA).
- `hyperfineHeadline`: the ground-state hyperfine splitting of the *reference isotope* — the most abundant stable
  isotope with I ≠ 0 and a J ≠ 0 ground level; if the element has only I = 0 stable isotopes or a J = 0 ground
  level, `Missing{not_applicable}` with the physical reason; if it exists but is not in the curated file,
  `Missing{not_measured}`.
- `ie1`: NIST GSIE value for the neutral atom; NIST's bracket/parenthesis flags map to `flag: "interpolated"` /
  `"estimated"`.

### 5.2 Units

Stored units are fixed per field (kJ/mol for energies of chemistry, eV for atomic levels, Hz for frequencies, pm
for radii, K for temperatures, g/cm³ for density, u for masses, s for half-lives). Display conversions live in
`src/physics/units.ts` with CODATA 2022 factors; the UI unit toggle covers kJ/mol ↔ eV and K ↔ °C.

---

## 6. The data pipeline

### 6.1 Sources registry (`tools/sources.toml` → `public/data/sources.json`)

Every source has `id`, `title`, `url`, `licence`, `licence_url`, `citation`, `retrieved` (set by the pipeline),
`notes`. The initial registry:

| id | What it supplies | Access | Licence / terms |
|---|---|---|---|
| `pubchem` | Core element properties: atomic mass, electron configuration (cross-check only), Pauling electronegativity, atomic radius, IE (cross-check), electron affinity, oxidation states, standard state, melting/boiling point, density, group block, year discovered; GHS hazard data via element pages | REST: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON`; element pages via `rest/pug_view/data/element/{Z}/JSON` | US government work; public domain in the US |
| `nist_gsie` | Ground-state configuration, ground level (term symbol, J), ionization energies for **all** ionization stages with uncertainties and flags | ASD Ionization Energies form `https://physics.nist.gov/PhysRefData/ASD/ionEnergy.html` — request all spectra (`H-Og`), CSV output; cache the raw CSV | NIST; public domain in the US; cite ASD version |
| `nist_levels` | Energy levels (energy, configuration, term, J, Landé g) for neutral atoms | ASD Levels form `levels_form.html`, tab-delimited output, Landé-g enabled; one request per element, polite rate | as above |
| `nist_lines` | Spectral lines with wavelength, relative intensity, Aki for neutral and singly ionized species | ASD Lines form `lines_form.html`, CSV output, 380–780 nm window (plus the cooling/clock lines wherever they fall) | as above |
| `nist_awic` | Standard atomic weights (incl. intervals), isotopic abundances and masses | `https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses` — "Linearized ASCII output", all elements, all isotopes | as above |
| `nist_srd141` | Orbital eigenvalues and total energies for Z = 1–92 in LDA/LSD/RLDA/ScRLDA | `https://www.nist.gov/pml/data/atomic-reference-data-electronic-structure-calculations` (per-element pages; original data files linked from the index) | as above |
| `nist_codata` | Fundamental constants (CODATA 2022) | `https://physics.nist.gov/cuu/Constants/` (ASCII table) | as above |
| `iaea_livechart` | Per-isotope: half-life, decay modes with branching, spin-parity, abundance, atomic mass, mass excess, binding energy per nucleon, magnetic dipole and electric quadrupole moments, discovery year | `https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all` (CSV); ≤ 3 requests/s; set a descriptive `User-Agent` | IAEA Nuclear Data Section; free for use, cite ENSDF and the moment tables as the API guide lists them |
| `bipm_frequencies` | Recommended values of standard frequencies, with the [SRS] secondary-representation flag, species, transition, frequency, uncertainty | `https://www.bipm.org/en/publications/mises-en-pratique/standard-frequencies-by-wavelength` (PDF and machine-readable API) | BIPM; cite |
| `bunge_rhf` (v0.2) | Roothaan–Hartree–Fock wavefunctions He–Xe as Slater-type-orbital expansions | `https://ccl.net/cca/data/atomic-RHF-wavefunctions/` (ASCII) | Published scientific tables (Bunge, Barrientos & Bunge, ADNDT 53, 113 (1993)); numerical data, cite |
| `mclean_rhf` (v0.2) | RHF Slater expansions Z = 55–92 | McLean & McLean, ADNDT 26, 197 (1981); transcribe or compute (§10.1) | as above |
| `clementi_zeff` | Effective nuclear charges per subshell, Z ≤ 86 | Clementi & Raimondi, J. Chem. Phys. 38, 2686 (1963); Clementi, Raimondi & Reinhardt, J. Chem. Phys. 47, 1300 (1967) — transcribed into `curated/zeff.toml`; Slater's rules computed for Z > 86 | published numerical values; cite |
| `steck_alkali` | Hyperfine constants, D-line wavelengths, linewidths, Doppler and recoil temperatures for Na, Rb-85/87, Cs (+ linked Li, K, Sr, Yb sheets) | `https://steck.us/alkalidata/` | compiled reference data; cite the sheet and revision |
| `allegrini2022` | Survey of hyperfine measurements in alkali atoms | arXiv:2209.11423 | cite |
| `arimondo1977` | Classic alkali hyperfine compilation | Rev. Mod. Phys. 49, 31 (1977) | cite |
| `vald_hfs` | Hyperfine A/B constants for levels of 58 isotopes of 30 elements | arXiv:1911.03189 (database description); values via the cited primary papers | cite |
| `olmschenk_catalog` | Which neutral atoms and ions have been laser cooled and trapped, with references | `https://personal.denison.edu/~olmschenks/atom_catalog.html` and `ion_catalog.html` | cite; verify each entry against its primary reference |
| `images_of_elements` | Photographs of elements | `https://images-of-elements.com/{element}.php` | CC BY 3.0 with attribution by link to the element page; 1 request/s, descriptive User-Agent |
| `commons` | Photographs of elements (second source) and historical images | Commons API (`action=query`, `generator=categorymembers`, `prop=imageinfo`, `iiprop=url|extmetadata|size`) | per-file licences; only the allow-list in §15.3 |
| `usgs_mcs` | Annual production and unit value, year-stamped | USGS Mineral Commodity Summaries (PDF/CSV) | US government work; public domain |
| `eu_crm` | EU critical raw materials list | European Commission 2023 list | facts; cite |
| `kobayashi2020` | Nucleosynthesis origin fractions per element | Kobayashi, Karakas & Lugaro, ApJ 900, 179 (2020) | approximate transcription; flag `estimated` |
| `pyykko2011` (v0.2) | Predicted configurations and placements for Z = 119–172 | Pyykkö, Phys. Chem. Chem. Phys. 13, 161 (2011) | facts; cite |
| Curated primary papers | Everything in `curated/*.toml` cites a DOI per row | — | facts; cite |

Fetchers must: send a descriptive `User-Agent` with a contact URL (the repo), respect rate limits, cache raw
responses under `tools/raw/` (gitignored), and never fail the whole build on one source — a failed source yields
`Missing{source_unavailable_at_build}` for its fields and a loud line in the pipeline report.

### 6.2 Curated TOML files (hand-compiled, one source per row)

Each row carries `source = "<registry id>"` and, where applicable, `doi`. Rows without a source are rejected by
the build.

- `hyperfine.toml` — ground-state hyperfine splittings per isotope: `Z, A, I, J, A_MHz, B_MHz, splitting_Hz,
  unc_Hz, source`. First-pass coverage target (compile from Steck, Allegrini 2022, Arimondo 1977, VALD-cited
  primaries, and the ion-clock literature): H-1, D-2, T-3, Li-6/7, Na-23, K-39/40/41, Rb-85/87, Cs-133, Fr-210/211/212
  (as available); the group-13 atoms B-11, Al-27, Ga-69/71, In-115, Tl-203/205; the coinage metals Cu-63/65,
  Ag-107/109, Au-197; N-14, P-31, As-75, Sb-121/123, Bi-209; F-19, Cl-35/37, Br-79/81, I-127; Sc-45, Y-89, La-139,
  Lu-175, Mn-55, Co-59, V-51, Nb-93, Eu-151/153; and the singly charged clock ions Be-9⁺, Mg-25⁺, Ca-43⁺, Sr-87⁺,
  Ba-137⁺, Cd-111/113⁺, Yb-171⁺, Hg-199⁺ (stored with `charge = 1`, shown in the AMO panel as ions). Every row
  verified against its primary; uncertain rows omitted rather than guessed.
- `lasercooling.toml` — per species: `Z, A (or "natural"), charge, transition (term labels), wavelength_nm, Gamma_MHz
  (2π×), source_Gamma (prefer `nist_lines` Aki), first_cooled_year, first_mot_year, bec_year, dfg_year, refs`. The
  Doppler and recoil temperatures are *computed* in the app from Γ, λ and m (§11.3), not stored.
- `clocks.toml` — generated from `bipm_frequencies` plus hand rows for the Th-229 nuclear transition (values and
  uncertainties from the 2024–2026 papers, flagged `measured`) and for Cs's exact defining value.
- `si_history.toml` — rows: `Z, unit, role, from, to, text, source`. Minimum content: Cs (second, 1967–); Kr-86
  (metre, 1960–1983); Pt/Ir (international prototypes of the metre and kilogram); Pt (candela via the freezing
  point of platinum, 1948–1979); Si-28 (kilogram realization by the X-ray-crystal-density method); C-12 (mole,
  1971–2019); H and O (kelvin via the triple point of water, until 2019); I-127 and Ne (iodine-stabilized He–Ne
  laser as a recommended radiation for the metre); Hg-198 (standard lamp wavelengths); Rb-87, Sr-87/88, Yb-171,
  Yb-171⁺, Hg-199⁺, Al-27⁺, Ca-40⁺, Sr-88⁺, In-115⁺ as SRS species (generated from BIPM, not hand-typed).
- `nucleosynthesis.toml` — fractions per process per element (`bigbang, cosmic_rays, agb, massive_stars,
  neutron_star_mergers, white_dwarfs`) from Kobayashi 2020; flag `estimated`.
- `biology.toml` — per element: `essential_human: yes|probable|no`, `essential_plant: yes|beneficial|no`,
  `human_body_mass_fraction`, roles (short, own words), toxicity class, GHS pictograms (from PubChem). Plant
  essentials to seed, each with a textbook or review DOI: C, H, O, N, P, K, Ca, Mg, S, Fe, Mn, Zn, Cu, B, Mo, Cl,
  Ni; beneficial: Na, Si, Co, Se, Al. **FIN** reviews this file at M4 — he is the plant scientist.
- `history.toml` — discovery year, discoverer(s), place, name origin (own words), isolated-year where different,
  symbol history; sources: IUPAC element pages, PubChem `YearDiscovered`, primary histories.
- `crystal.toml` — room-temperature crystal structure: lattice type, space group, Pearson symbol, lattice
  parameters, source (Crystallography Open Database, CC0, or Materials Project, CC BY 4.0, or Donohue 1974).
- `abundance.toml` — crust (Rudnick & Gao 2003), ocean (Nozaki 1997/2001), solar system (Lodders 2009 or Asplund
  2021), human body (Emsley); mass fractions with sources.
- `production.toml` — from USGS MCS: annual production, unit value, year.
- `zeff.toml` — Clementi–Raimondi effective nuclear charges per subshell.
- `electronegativity_allen.toml` — Allen's configuration-energy electronegativities (Allen 1989; Mann et al. 2000).
- `images.toml` — per element: pinned Commons file names or images-of-elements URLs to prefer, exclusions, and
  placeholder text overrides.
- `prose/{Z}.md` — 60–120 words per element in our own words: what it is, one surprising fact, one quantum fact.
  Front-matter lists the sources consulted. No sentence copied from any source.

### 6.3 Generated layouts (`build_layouts.py`) — see §7.2 for the rules.

### 6.4 Reports

`tools/report.py` writes `PROVENANCE.md` (sources, licences, retrieval dates, per-field coverage over 118
elements), `CREDITS.md` (images), and prints a licence audit that fails on any image or source outside the
allow-list (§15.3). The coverage table is also exposed in the app's About page.

---

## 7. The table

### 7.1 Tile

The tile mirrors the reference table at full size and discloses progressively as it shrinks:

- **≥ 110 px wide:** atomic weight (or `(mass number)` for elements without a standard weight) top-left; Z
  top-right; second line IE₁ and Pauling EN; oxidation states stacked at the right edge with common ones bold;
  large symbol; name; electron configuration in noble-gas notation with a ◆ marker and tooltip when `anomalous`;
  bottom line: hyperfine headline (`ν_hfs 9 192 631 770 Hz · ¹³³Cs`, or a muted `no hfs (I = 0)` / `hfs n/m`).
- **60–110 px:** Z, symbol, name, configuration.
- **< 60 px:** Z and symbol only.
- Category colour fills the tile; a thin block-colour bar at the bottom (s/p/d/f) so the block is readable in
  every layout. Radioactive elements get the trefoil glyph in the corner, as in the reference.
- Tiles are buttons: `aria-label="Caesium, atomic number 55, alkali metal. Press Enter for details."`

Below the table: category legend, block legend (the small s/p/d/f block diagram, redrawn to match the active
layout), notes (`1 kJ/mol ≈ 96.485 eV`-style conversions), and the active layout's row/column labels (groups 1–18
and periods for the standard forms; n+l rows and l blocks for Janet; n rows and l blocks for ADOMAH).

### 7.2 Layouts — rules for `build_layouts.py`

All four layouts share a 32-column coordinate space so the morph is a pure translation of tiles.

**standard18**: the IUPAC-style 18-column form, 7 periods, f-block detached in rows 9–10 with a one-row gap and
asterisk markers in group 3 (as in the reference). The detached rows are **15 cells wide**: variant `lu` (Lu and
Lr under Y) fills cells 1–14 with La–Yb and Ac–No; variant `la` (La and Ac under Y) fills cells 2–15 with Ce–Lu
and Th–Lr. Ce–Yb and Th–No therefore occupy the same cells in both variants, and toggling moves exactly four
tiles (La, Lu, Ac, Lr) — which is what makes the morph legible. (Columns 1–18 are centred in the 32-column
space.)

**long32**: the 32-column long form with the f-block inline between groups 2 and 3; the same group-3 variants
decide whether La/Ac or Lu/Lr occupy the group-3 column. Here the inline block is necessarily 14 wide, so
toggling swaps La↔Lu and Ac↔Lr between the group-3 column and the block and shifts Ce–Yb and Th–No by one column.

**janet** (left-step): rows are the values of n+l, blocks are right-aligned: f occupies columns 1–14, d columns
15–24, p columns 25–30, s columns 31–32. Row k holds the subshells with n+l = k in order of increasing n
(decreasing l), elements by Z ascending left to right. Resulting rows: 1 → H, He; 2 → Li, Be; 3 → B–Ne, Na, Mg;
4 → Al–Ar, K, Ca; 5 → Sc–Zn, Ga–Kr, Rb, Sr; 6 → Y–Cd, In–Xe, Cs, Ba; 7 → La–Yb, Lu–Hg, Tl–Rn, Fr, Ra;
8 → Ac–No, Lr–Cn, Nh–Og, (119, 120). Row lengths 2, 2, 8, 8, 18, 18, 32, 32. The left-step table places elements
by the idealized Madelung filling, deliberately ignoring the measured anomalies — say so in the layout caption.

**adomah** (horizontal form, after Tsimmerman, perfectperiodictable.com): rows are the values of n, drawn with n
increasing *upward* (n = 1 at the bottom); blocks right-aligned exactly as in `janet`. Row n holds the subshells
with that n in order of decreasing l: n = 4 → 4f (La–Yb) | 4d (Y–Cd) | 4p (Ga–Kr) | 4s (K, Ca). The Madelung
filling order appears as the diagonals (n+l strata). Optional labels for m_l and m_s per column within a block
(Tsimmerman's convention) are a v0.2 nicety.

`janet` and `adomah` are unaffected by the group-3 toggle (both inherently put Lu/Lr at the start of the d-block).
Positions for Z = 119–172 are generated from Pyykkö's predicted configurations in v0.2 and flagged `predicted`.

**Morph.** Switching layouts animates each tile from its old to its new cell with a FLIP transform (600 ms,
ease-in-out, 8 ms stagger by Z), labels cross-fading; `prefers-reduced-motion` → instant. The table container
resizes to fit. Tests assert every Z appears exactly once in every layout and that `janet` row lengths are as
listed.

### 7.3 Categories and palette

Categories as in the reference: alkali metals, alkaline earth metals, lanthanides, actinides, transition metals,
post-transition metals, metalloids, reactive nonmetals, noble gases, unknown properties (Z ≥ 109 where chemistry
is unmeasured). Two palettes, switchable in settings: **Campion** (hues close to the reference table, adjusted
until every tile's text passes 4.5:1) and **Colour-safe** (derived from Okabe–Ito, distinguishable under
deuteranopia/protanopia). Category is also written in the tile's accessible label and in the hover card.

### 7.4 Zoom, pan, search

The table sits in a pan/zoom container (pointer events; pinch on touch; trackpad pinch and ⌘/Ctrl+wheel on
desktop). Fit-to-width on load, double-tap to zoom a region, a "fit" button. A search field (name, symbol, Z,
"ionization > 1000", "laser-cooled") highlights matches and dims the rest; Enter opens the first match.
**IMPLEMENTER'S CHOICE:** a small MIT library such as `panzoom` or a hand-rolled 150-line pointer handler.

---

## 8. Trends and overlays

A "Trend" control offers three overlay kinds, drawn on an SVG layer over the table and readable in every layout
(arrows follow the active layout's period/group axes in the two standard forms; in `janet`/`adomah` only heatmaps
and maps are offered, since the classical arrows presuppose groups and periods).

**8.1 Arrow trends** (the two attached reference graphics are copyrighted; redraw in the project's style): each
trend declares a direction along the period and along the group, with a label, a one-sentence physical cause, and
a list of notable exceptions shown as small markers.

| Trend | Across a period → | Down a group ↓ | Exceptions marked |
|---|---|---|---|
| Atomic radius | decreases | increases | d-block contraction, lanthanide contraction |
| 1st ionization energy | increases | decreases | Be→B, N→O, Mg→Al, P→S dips (subshell and pairing) |
| Electron affinity | increases (general) | decreases (weak) | noble gases, N, group 2 |
| Electronegativity (Pauling) | increases | decreases | — |
| Metallic character | decreases | increases | — |
| Nonmetallic character | increases | decreases | — |
| Effective nuclear charge (valence) | increases | about constant | — |
| Shielding | about constant | increases | — |
| Polarizability | decreases | increases | — |
| Ionic radius (same charge) | decreases | increases | — |
| Reactivity | metals: increases ↓ (left); nonmetals: decreases ↓ (right) | two-arrow special case | noble gases |

**8.2 Heatmaps**: any numeric field of `index.json` or a declared panel field (IE₁, EN, EA, radius, polarizability,
melting point, density, atomic volume, Z_eff, 1s electron speed Zα, hyperfine splitting, longest half-life,
number of stable isotopes, crustal and solar abundance (log), …). Colour scale with legend; the value printed on
each tile when it fits; "show as chart" opens a drawer with the property vs Z (the sawtooth) and vs group.

**8.3 Categorical maps**: block; state at STP; **Madelung anomalies**; laser-cooled (neutral / ion / both);
clock species (SRS and candidates); SI-defining elements (historical and current); essential for humans / for
plants; **nucleosynthesis origin** (dominant process, Johnson-style); radioactive vs stable; discovery era.

v0.1 ships all arrow trends, ≥ 10 heatmaps and ≥ 6 maps; the rest follow as data lands.

---

## 9. Interaction

### 9.1 Hover card

Floating UI, anchored to the tile, 150 ms hover intent, dismissed on leave; shown on keyboard focus; on touch
devices shown on long-press (350 ms) as a "peek". Content: 2–3 thumbnails (320 px, lazy), name, symbol, Z,
category, standard state, and `quantumFact` — one generated line chosen by priority: a clock/SI role ("defines
the SI second"), a Madelung anomaly ("ground state 4f¹⁴5d⁹6s¹ — the Aufbau rule predicts 5d¹⁰"), a
laser-cooling or BEC first, a relativistic note (Au, Hg, Pb, Cs), else the ground term. Footer: "click to pin".
Image credits appear on hover over each thumbnail and in full in the sheet.

### 9.2 Pinned sheet

Click (or Enter/Space, or tap) opens the sheet: desktop — a centred modal ≈ 92 % of the viewport with a dimmed
backdrop; phone — a full-height bottom sheet. Header: photo strip (800 px images, swipeable, with credits), symbol,
name, Z, category, prose paragraph. Body: the **panel strip** — a horizontal `scroll-snap-type: x mandatory`
container, one panel per snap point, so two-finger trackpad swipes and touch swipes both work without JS; plus
panel tabs (with `aria-selected`), prev/next arrows, ←/→ keys, and dots. The current panel is written to the URL
(`#/Cs/amo`); panel slugs: `orbitals em probability physical math amo nucleus spectrum chemistry biology history`.
Panels mount lazily when they come within one snap of view. Esc closes and returns focus to the tile. The last
opened panel is remembered (localStorage) and used as the default for the next element.

### 9.3 Settings

Layout, group-3 variant, palette, units, reduced motion (follows system by default), theme (dark default; light
available). Persisted in localStorage; all wrapped in try/catch.

### 9.4 Routing

`#/` table · `#/?layout=janet&g3=la&trend=ie1&view=heat` table state · `#/Cs` opens the sheet at the remembered
panel · `#/Cs/amo` opens a specific panel. Hash routing works on GitHub Pages without a 404 fallback. v0.2 adds
prerendered `/element/cs/` pages with Open Graph tags for link previews.

### 9.5 Keyboard

Tab order follows Z; arrow keys move between tiles in the active layout (grid navigation); `/` focuses search;
`L` cycles layouts; `T` opens the trend menu; Enter/Space opens; Esc closes.

---

## 10. The eleven panels

Common contract for every panel: a title, a one-line summary, a body of visual blocks, and a footer listing the
sources used on this panel (chips that open the registry entry). Every number is a `<Quantity>` component that
renders value, unit, uncertainty in NIST style (`1 420 405 751.768(2) Hz`), and a source chip; every absent value is
a `<Missing>` component with its reason. Every chart has a "show as table" toggle for screen readers and for people
who want the numbers. Charts are D3-driven SVG inside React; 3D is three.js in a lazily loaded chunk.

Element-detail fields below are stored under `elements/{Z}.json[<slug>]` unless another file is named.

### 10.1 Orbitals (`orbitals`)

*Purpose:* show what this atom's electrons are doing, at honest fidelity.

- **Orbital gallery.** One 3D isosurface per occupied subshell (1s … valence), hydrogenic with Clementi–Raimondi
  Z_eff (Tier A, §11.1), drawn at the 90 % enclosed-probability threshold; toggle real ↔ complex orbitals (p_x, p_y,
  p_z vs m_l = −1, 0, +1), phase colouring, nodal surfaces, a slice plane showing |ψ|². The valence subshell is
  highlighted; the gallery is sorted by energy using NIST SRD 141 eigenvalues when available.
- **Shell stack.** All occupied radial distribution functions P(r) = r²|R_nl|² on one axis at true relative scale
  (log-r option). This is where 4f sits inside 6s for the lanthanides. Markers for ⟨r⟩, the most probable radius,
  and the covalent and van der Waals radii for comparison.
- **Nodes.** Table: n, l, radial nodes n−l−1, angular nodes l, occupancy, eigenvalue (SRD 141, eV).
- **Badge, always visible:** "Hydrogenic approximation with Clementi–Raimondi Z_eff. Angular shapes are exact for one
  electron; radial scale is approximate for many-electron atoms. Tier B (Hartree–Fock radial functions) planned."
- Fields: `zeff[{n,l,value,source}]`, `eigenvalues[{n,l,eV,method,source}]`, `radii{covalent, vdw, metallic,
  calculated}` as `Q`.
- v0.2 (Tier B): precomputed radial functions from Bunge (He–Xe) and McLean (Cs–U) STO expansions, or from a
  spherically averaged atomic Hartree–Fock run (PySCF, Apache-2.0) in the pipeline; the stack switches to measured
  ⟨r⟩ with a comparison to Tier A so the approximation error becomes visible.

### 10.2 Electromagnetic & ionization (`em`)

- **The ionization ladder:** IE₁ … IE_Z from NIST GSIE on a log axis vs ionization stage, with shell closures
  annotated (the staircase that *is* shell structure). Uncertainties and NIST flags shown.
- Electron affinity; electronegativity on three scales (Pauling from PubChem, Allen from `curated`, Mulliken computed
  from IE₁ and EA with the formula shown); static dipole polarizability (Schwerdtfeger & Nagle 2019 table, via
  curated TOML); magnetic ordering and susceptibility; electrical resistivity/conductivity; superconducting T_c
  for the element where known; work function; band gap for semiconductors.
- A "trend context" sparkline: this element's IE₁ marked on the IE₁-vs-Z sawtooth.
- Fields: `ionizationEnergies[{stage, kJmol, eV, unc, flag}]`, `electronAffinity`, `en{pauling, allen, mulliken}`,
  `polarizability`, `magnetic{order, chi_molar}`, `resistivity`, `superconductingTc`, `workFunction`, `bandGap`.
  Physical-property rows beyond PubChem come from `curated/` with a DOI each; v0.1 may leave many `Missing`.

### 10.3 Probability & statistics (`probability`)

- **Where is the electron?** Radial probability density and its cumulative distribution for the valence subshell
  (and any selected subshell): "probability the electron is within r"; markers for most probable and mean radius.
- **Quantum statistics by isotope:** boson or fermion (integer vs half-integer total spin), with badges for BEC
  achieved / Fermi degeneracy achieved and their years (from `lasercooling.toml`).
- **Thermal statistics:** Maxwell–Boltzmann speed distribution for the reference isotope with a temperature slider
  from 1000 K down to the Doppler and recoil limits (where laser-cooled); thermal de Broglie wavelength λ_dB and the
  degeneracy criterion n·λ_dB³ ≈ 2.612 displayed as "at this temperature you would need a density of … for a BEC".
- **Mixture statistics:** natural abundance of isotopes (bars), the atomic weight as an interval where IUPAC gives
  one, with the explanation that the "weight" is a statistic over terrestrial samples.
- **Uncertainty as a first-class citizen:** this panel explains the `(2)` notation once, with the element's most and
  least precisely known quantities.
- Fields derive from `isotopes/{Z}.json` and §10.1; no new stored fields beyond `referenceIsotope`.

### 10.4 Physical & engineering (`physical`)

- Phase at STP, density, melting and boiling points (with uncertainty where known), heat capacity, thermal
  conductivity, thermal expansion, Young's/bulk/shear moduli, Poisson ratio, speed of sound, hardness (Mohs,
  Vickers, Brinell), crystal structure with a rotatable unit cell (three.js, from `crystal.toml`), allotropes,
  abundance bars (crust, ocean, solar system, human body; log scale), annual production and unit value
  year-stamped (USGS), EU critical-raw-material flag, main uses (own prose, 3–5 bullets), GHS hazard pictograms.
- Price is never shown without its year; if the latest USGS value is older than 5 years, it is omitted.
- Fields: `thermal{...}`, `mechanical{...}`, `crystal{lattice, spaceGroup, pearson, a, b, c, alpha, beta, gamma}`,
  `allotropes[]`, `abundance{crust, ocean, solar, body}`, `production{tonnesPerYear, year, unitValueUSDperkg}`,
  `critical{eu2023: boolean}`, `uses[]`, `hazards{ghsPictograms[], signalWord}`.

### 10.5 Mathematical & theoretical (`math`)

- **Quantum numbers:** the valence electrons' n, l, m_l, m_s; the ground term ²ˢ⁺¹L_J with S, L, J spelled out;
  Landé g_J (NIST) next to the LS-coupling formula; Hund's rules applied step by step for this configuration.
- **Aufbau vs reality:** the Madelung prediction next to the NIST configuration; when they differ, a short
  explanation chosen from a small set (half-filled/filled d or f stability; relativistic stabilization of s;
  near-degeneracy of (n−1)d and ns) — generated from the kind of anomaly, flagged as explanation, not derivation.
- **Screening:** Slater's rules worked for the valence electron (the arithmetic shown), Clementi–Raimondi Z_eff per
  subshell for comparison, and the hydrogenic scaling E_n ≈ −13.6 eV·Z_eff²/n² compared with the measured IE₁.
- **Relativity:** 1s electron speed v/c ≈ Zα, γ = 1/√(1−(Zα)²), the implied 1s contraction, and where the table
  ends (Z = 137 for a point nucleus; ≈ 173 with a finite nucleus); a note on the elements where relativity changes
  chemistry (Au colour, Hg liquid, Pb-acid voltage, Cs/Fr IE ordering).
- **Symmetry note:** one paragraph on the SO(4,2) dynamical-group picture of the table and the 2n² shell
  degeneracy, written for curious readers; formulas via KaTeX.
- v0.2: Pyykkö's predicted period-8 placement for the element's heavier homologue.
- Fields: `quantumNumbers[]`, `hund{steps[]}`, `slater{steps[], zeff}`, `relativity{beta, gamma, contraction}`
  (computed; constants from `nist_codata`).

### 10.6 AMO & metrology (`amo`) — the Phillips panel

- **Hyperfine structure:** for each isotope with I ≠ 0 and J ≠ 0: I, A (and B), the ground-state splitting with
  uncertainty, a level diagram of F states; the headline isotope first. If none: the physical reason.
- **Nuclear moments:** μ (μ_N) and Q (b) per isotope (IAEA).
- **Clock transitions:** BIPM recommended frequencies for this element (species, transition, frequency, relative
  uncertainty, SRS flag), with Cs's exact 9 192 631 770 Hz marked "defines the SI second (1967–)". The Th-229 nuclear
  transition appears here and in §10.7.
- **Laser cooling:** cooling and repump transitions (λ, Γ/2π), computed Doppler temperature, recoil temperature and
  recoil velocity, saturation intensity; first cooled / first MOT / BEC / DFG years with references; a MOT-style
  diagram of the cycling transition; whether the species is cooled as a neutral, as an ion, or in a metastable state
  (noble gases).
- **In the SI:** the element's rows from `si_history.toml`, as a timeline.
- **Timeline of the second:** one shared figure (1967 Cs definition → 2018 SI revision wording → CGPM 2022
  roadmap resolution → CGPM 2026 → planned redefinition decision at CGPM 2030), rendered from `clocks.toml`
  metadata; highlight this element's role if any. The pipeline fetches the BIPM list; the app never hardcodes it.
- Fields: `hyperfine[]`, `moments[]` (from isotopes), `clocks[]`, `laserCooling{...}`, `siHistory[]`.

### 10.7 Nucleus & isotopes (`nucleus`)

- **Isotope strip:** all known isotopes on an N axis; bar height = log half-life (stable = full height, marked);
  colour = dominant decay mode; natural abundance as dots; click an isotope for its record.
- **Survival curve** for the selected radioactive isotope: N(t)/N₀ with λ = ln 2 / t½ and a "probability a given
  nucleus survives X years" readout.
- **Decay modes** with branching ratios; **binding energy per nucleon** vs A for the element's isotopes with the
  Fe-56/Ni-62 reference line; **magic numbers** marked when Z or N is magic; spin-parity list.
- **Cosmic origin:** stacked bar of nucleosynthesis fractions (flagged approximate, Kobayashi 2020), with the six
  processes explained in one line each.
- **Th-229:** the 8.4 eV isomer and the 2024–2026 nuclear-clock results, with citations.
- Data: `isotopes/{Z}.json` (IAEA): `A, N, halfLife{s, unc} | stable, decays[{mode, branching}], jp, abundance,
  mass{u, unc}, massExcess, bindingPerNucleon, mu, Q, discoveryYear`.

### 10.8 Spectrum & energy levels (`spectrum`)

- **Spectrum strip:** the visible emission spectrum (380–780 nm) of the neutral atom rendered from NIST lines with
  relative intensities, colours from CIE 1931 → sRGB (§11.6), on black — the discharge-tube look; toggle to include
  the singly charged ion; hover a line for λ, A_ki, upper/lower levels. Cap: strongest 400 lines per species.
- **Strongest lines table** (top 12) and flame-test colour where documented.
- **Grotrian diagram:** energy levels of the neutral atom (lowest 60 levels, grouped by term/l) with the strongest
  transitions drawn; the cooling and clock transitions highlighted; the ionization limit marked.
- Data: `spectra/{Z}.json` `lines[{nm, intensity, Aki, lower, upper, species}]`; `levels/{Z}.json`
  `levels[{eV, configuration, term, J, gJ}]`, `ionizationLimit`.

### 10.9 Chemistry & bonding (`chemistry`)

- Oxidation states (common bold, as on the tile) with example compounds for the common ones; covalent, ionic (for
  common ions), metallic and van der Waals radii as a size ladder; electronegativity recap; typical bonding
  (metallic / covalent network / molecular / ionic); common compounds and allotropes with formulas (own prose);
  reactivity notes (reaction with air, water, acids — qualitative, sourced); valence and coordination tendencies.
- Fields: `oxidationExamples[{state, formula, name}]`, `radii{...}` (shared with 10.1), `bonding`, `compounds[]`,
  `reactivity{air, water, acids}`.

### 10.10 Biology & ecology (`biology`)

- Essential for humans / plants / other organisms with the role in one sentence each (own words), typical body
  mass fraction, dietary or soil relevance where meaningful (e.g. N, P, K as macronutrients; Fe, Mn, Zn, Cu, B, Mo,
  Cl, Ni as plant micronutrients), toxicity and hazard summary (GHS from PubChem plus curated notes), environmental
  notes (bioaccumulation, radioecology for the radioactive ones), isotope uses in biology and medicine (C-14 dating,
  F-18 PET, I-131, Tc-99m, Gd contrast).
- Fields from `biology.toml`; **FIN** reviews at M4.

### 10.11 History & naming (`history`)

- Discovery year, discoverer(s), place (a small world map dot), isolation year if different, name origin and symbol
  history in our own words, the element's "first photograph" if a free historical image exists, and a timeline
  strip placing this element among all discoveries (Antiquity → 2016).
- Fields from `history.toml` and `images.credits` for historical images.

---

## 11. Physics engine (`src/physics/`) — pure functions, unit-tested

### 11.1 Hydrogenic orbitals with Z_eff (Tier A)

- Radial function: R_nl(r) = N_nl · (2Zr/na₀)^l · e^(−Zr/na₀) · L^{2l+1}_{n−l−1}(2Zr/na₀), with Z = Z_eff(n,l) and the
  generalized Laguerre polynomial; normalization checked numerically (∫₀^∞ r²R² dr = 1 ± 10⁻⁴).
- Real spherical harmonics for m_l combinations; complex option kept for the m_l labelled view.
- Density ρ = |R|²|Y|²; isosurface threshold found by sorting voxel densities and accumulating to 0.90 of the total;
  marching cubes on a 96³ grid (desktop) / 64³ (mobile) in a Web Worker; the grid half-width scales with
  ⟨r⟩ + 3σ. **IMPLEMENTER'S CHOICE:** marching cubes mesh vs fragment-shader raymarching; both acceptable if the
  90 % criterion is honoured.
- Analytic checks exposed in the UI: ⟨r⟩ = (a₀/2Z)[3n² − l(l+1)], most probable radius for nodeless orbitals
  r* = n²a₀/Z, node counts n−l−1 and l.
- Z_eff: Clementi–Raimondi from `zeff.toml` for Z ≤ 86, Slater's rules otherwise (function provided and tested
  against the textbook examples: valence electron of N → 3.90; 4s of Zn → 4.35; 3d of Zn → 8.85).

### 11.2 Madelung generator

`aufbauConfiguration(Z)` fills subshells in order of (n+l, n) with capacities 2(2l+1), emits noble-gas-core
notation, and `anomaly(Z) = measured !== aufbau`. Test: exactly these 20 elements are flagged against NIST ground
configurations — Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, La, Ce, Gd, Pt, Au, Ac, Th, Pa, U, Np, Cm, Lr. If NIST data
changes the set, the test tells us (that is the point).

### 11.3 Laser cooling and thermal statistics

- Doppler limit T_D = ħΓ/(2k_B); recoil temperature T_r = ħ²k²/(m k_B) with k = 2π/λ; recoil velocity v_r = ħk/m;
  saturation intensity I_sat = πhcΓ/(3λ³) (two-level, cycling-transition convention — state it).
- Maxwell–Boltzmann speed distribution f(v) for mass m at temperature T; λ_dB = h/√(2πmk_BT); degeneracy density
  n = 2.612/λ_dB³.
- Golden test (Steck, Rb-87 D2): λ = 780.241 nm, Γ/2π = 6.0666 MHz → T_D ≈ 145.6 μK, T_r ≈ 362 nK, v_r ≈ 5.88 mm/s
  (tolerance 0.5 %).

### 11.4 Hyperfine

- Hyperfine energy E_F = (A/2)K + B·[(3/2)K(K+1) − 2I(I+1)J(J+1)] / [4I(2I−1)J(2J−1)] with K = F(F+1) − I(I+1) − J(J+1);
  for J = ½ the ground splitting is A(I+½). The app recomputes the splitting from A and checks it against the stored
  value (a consistency test on the curated file).
- Golden values: H-1 ground splitting 1 420 405 751.768(2) Hz (test tolerance 1 Hz); Cs-133 exactly
  9 192 631 770 Hz; Rb-87 6 834 682 610.904 312 6 Hz (CCTF 2017 recommended value — the test compares against
  whatever the fetched current BIPM list says, to 1 mHz).

### 11.5 Relativity and decay

- β = Zα, γ = 1/√(1−β²), contraction ≈ 1/γ for the 1s radius (hydrogenic estimate; label it).
- Decay: λ = ln2/t½; N(t) = N₀e^(−λt); survival probability of one nucleus e^(−λt).

### 11.6 Colour from wavelength

CIE 1931 2° colour-matching functions (tabulated 380–780 nm at 5 nm) → XYZ → linear sRGB → gamma; lines summed
with intensity weights for the strip; a single-line colour for hover. Out-of-gamut handled by desaturation toward
white, not clipping to black.

### 11.7 Constants

`constants.ts` generated from the NIST CODATA ASCII table by the pipeline; exact SI defining constants (h, e, k_B,
N_A, c, Δν_Cs, K_cd) marked exact. Conversions: 1 eV = 96.485 332 … kJ/mol; 1 Hartree = 27.211 386 … eV (both
generated, not typed).

---

## 12. Images pipeline (`tools/fetch_images.py`)

1. **Source order:** (a) images-of-elements.com element page (CC BY 3.0; attribution by link to the element page);
   (b) Wikimedia Commons category for the element, filtered by the licence allow-list (§15.3); (c) placeholder.
2. **Selection heuristics:** prefer Commons files with Featured/Quality/Valued assessments (`extmetadata`), width ≥
   1000 px, file names or descriptions containing sample/crystal/ampoule/cube/bar/ingot/discharge tube; exclude
   SVGs, diagrams, periodic-table images, molecule renders, people, logos. Choose 2–3 that differ in kind (bulk
   sample, crystal/ampoule, discharge tube for gases). `images.toml` pins or excludes files per element and wins
   over heuristics.
3. **Multi-licensed files:** choose the most permissive licence offered and record it (e.g. Alchemist-hp files:
   prefer FAL over CC BY-NC-ND; the credit then says FAL).
4. **Processing:** download the original or the largest allowed thumbnail; produce 800 px and 320 px WebP (quality
   82); never crop or recolour (some licences forbid derivatives; resizing for display is all we do); record
   width/height; write `credits.json` and `CREDITS.md` with title, author, licence (name and URL), source URL, and the
   attribution line the licence requires.
5. **Placeholders (honest):** elements with no free photograph of the bulk element (expect most Z ≥ 95, plus At, Fr,
   Rn and some others) get a generated card: symbol, name, and the sentence "No photograph exists: <name> has never
   been produced in a visible quantity. Longest-lived isotope: <A> (t½ = <value>)." — values from IAEA; the card is
   rendered by the app, not stored as an image, and is marked `kind: "placeholder"`.
6. **Politeness:** descriptive User-Agent with the repo URL, ≤ 1 request/s per host, full caching in `tools/raw/`,
   and a `--dry-run` that only lists candidates.

Expect manual curation. The pipeline writes `tools/raw/images-report.md` listing, per element, the candidates
considered and why each was accepted or rejected; Fin reviews it once at M2.

---

## 13. Testing

### 13.1 Pipeline (`tools/tests/`, pytest)

- Schema validation of every emitted file; every `source` resolves; no numeric `null`; every `Quantity` has a unit
  from the units table; every curated row has a source.
- Golden values: §11.3, §11.4; H 1s ⟨r⟩ = 1.5 a₀; Fe ground configuration `[Ar] 3d6 4s2` and term `5D4`; Cs IE₁ =
  375.7 kJ/mol within 0.1 %; U longest-lived isotope 238; Madelung anomaly set.
- Coverage thresholds (fail below): ground configuration and term for all 118; IE₁ for ≥ 110; standard atomic weight
  or most-stable mass number for all 118; ≥ 1 image or placeholder for all 118; isotopes for all 118; visible lines
  for ≥ 90.
- Licence audit: every image licence in the allow-list; every source licence recorded.
- Layout invariants: every Z exactly once per layout; `janet` row lengths; `adomah` rows by n; the group-3 toggle
  moves exactly four tiles in `standard18` (La, Lu, Ac, Lr) and swaps La↔Lu, Ac↔Lr in `long32` with every other
  tile keeping its relative order.

### 13.2 App unit tests (Vitest)

`src/physics/*` exhaustively (normalization, nodes, Z_eff examples, Madelung, Doppler/recoil, hyperfine formula,
CIE conversion sanity: 589 nm → yellow-orange, 486 nm → blue-cyan); layout engine; Quantity formatting (NIST
parenthesis notation); unit conversions round-trip.

### 13.3 End-to-end (Playwright; desktop Chromium/WebKit/Firefox + iPhone and Pixel emulation)

- Hover a tile → card with ≥ 1 image appears within 400 ms; keyboard focus shows it; Esc dismisses.
- Click → sheet opens, URL becomes `#/Fe/<panel>`; ←/→ and tab clicks change the panel and the URL; swipe on mobile
  emulation changes the panel; deep link `#/Cs/amo` opens Caesium on the AMO panel.
- Layout switch → every tile still present; `prefers-reduced-motion` → no transition.
- Group-3 toggle in `standard18` moves exactly four tiles; in `long32` La↔Lu and Ac↔Lr change places.
- Trend overlay renders arrows in `standard18` and is disabled in `janet`.
- Mobile: pinch/zoom works; tap opens the bottom sheet; long-press peeks.
- **Zero third-party requests:** assert that every request during a full session stays on the page origin.
- axe-core: no critical or serious violations on the table and on every panel for Fe, Cs, U and Og.
- Property test: open every element and every panel (118 × 11) without console errors; `Missing` renders where data
  is absent.

### 13.4 Visual and performance

Playwright screenshot baselines for the table in all four layouts (desktop) and the sheet (mobile); Lighthouse CI
budgets: performance ≥ 90 on mobile, initial JS ≤ 300 kB gzip excluding the lazily loaded three.js chunk,
`index.json` ≤ 150 kB gzip, first table paint < 1.5 s on a throttled mid-range phone profile.

---

## 14. Performance, accessibility, privacy

- Code-split by panel; three.js, KaTeX and D3 heavy modules load on first use; images lazy with `loading="lazy"`,
  `decoding="async"`, explicit dimensions; WebP only.
- Data: `index.json` at start; per-element files on open; per-panel files (`spectra`, `levels`, `isotopes`) on panel
  approach; all cached by the browser (immutable filenames with content hashes via the Vite manifest).
- Accessibility as in §2.9; grid keyboard navigation; focus trap in the sheet; `aria-live` announcements for panel
  changes; charts have table alternatives; colour never alone.
- Privacy: no cookies, no analytics, no fonts or scripts from third parties; localStorage only for settings.
  A one-line privacy statement in the About page says exactly this.

---

## 15. Licence and attribution

### 15.1 Project licence — LOCKED

**CC BY-NC-SA 4.0** for the code, the layouts, the curated data compilations, the prose and the design. `LICENSE`
holds the full legal code; `README` carries the badge and this sentence: "PTE-21C is free for non-commercial use
and redistribution, including modified versions, under the same licence. It is copyleft but not OSI-approved
open source; commercial licences are available on request." Attribution name: **Samuel Serafin Bietenhader** (confirmed
by Fin on 22 October 2026; default was "Bietenhader (Fin)"). Source files carry a one-line header: `SPDX-License-Identifier: CC-BY-NC-SA-4.0`.

Record the reasoning in `docs/approach.md`: a non-commercial copyleft was chosen deliberately for an educational
work, knowing it excludes commercial reuse and OSI status; Creative Commons discourages CC licences for software,
and the project accepts that trade-off because no non-commercial code licence offers copyleft.

### 15.2 Third-party software

All dependencies must be MIT, ISC, BSD, Apache-2.0, OFL (fonts) or similarly permissive. Their notices go in
`NOTICE.md`; they keep their own licences. No GPL/AGPL/LGPL dependencies (to keep the licence picture simple), no
dependency whose licence forbids our non-commercial terms.

### 15.3 Data and image allow-list — enforced by `tools/report.py`

| Allowed for ingestion | Examples |
|---|---|
| Public domain, US-government works | PubChem, NIST ASD/AWIC/SRD 141/CODATA, USGS |
| CC0 | Wikidata, Crystallography Open Database |
| CC BY (2.0, 3.0, 4.0) | images-of-elements.com, Materials Project, many Commons photos |
| Published scientific numerical tables, cited | Bunge RHF, Clementi–Raimondi, Steck, BIPM, Kobayashi 2020 |
| For *display unmodified* only, each file under its own licence with full credit | CC BY-SA photos, FAL photos, GFDL photos |

| Not allowed | Why |
|---|---|
| Wikipedia prose, Bowserinator Periodic-Table-JSON, other CC BY-SA compilations | share-alike cannot be relicensed non-commercially |
| periodictable.com / Theodore Gray photos, RSC pages, textbook graphics, the two trend graphics Fin attached | all rights reserved |
| CC BY-NC-ND photos as our *processed* copies | ND forbids derivatives; use the FAL alternative where offered, else display the Commons-served file unmodified or skip |

Numerical facts are not copyrightable; compilations and prose can be. Transcribe facts from primary sources with a
citation; never copy a source's table wholesale or its sentences at all.

### 15.4 Attribution requirements the app must satisfy

Per image: title, author, licence name linked to the licence text, link to the source page (and, for
images-of-elements.com, specifically a link to that element's page). Per data source: name, URL, licence,
retrieval date and citation, in `PROVENANCE.md` and the About page. NIST and PubChem ask for citation, not
licence; provide it anyway.

---

## 16. Design direction

Default **dark theme** ("a lab bench at night"): near-black background, element photographs as the colour in the
room, category colours as muted fills with saturated accents on hover, large symbol typography, generous
whitespace, data-dense but calm panels. Light theme is the inverse with the same tokens. Motion is restrained; the
layout morph is the single hero animation. Fonts: self-hosted OFL faces — an expressive humanist sans for titles,
a tabular-figures sans for numbers, a mono for configurations and formulas. **IMPLEMENTER'S CHOICE** of faces
within OFL. No stock gradients, no glassmorphism, no UI kit look. **FIN** reviews the design at the end of M3 and
may redirect; keep tokens central so a redirect is cheap.

---

## 17. Running, CI, deployment

### 17.1 Local

- `PTE-21C.command` (bash, macOS): `cd` to the repo, check `node ≥ 22` (print the Homebrew command if missing),
  `npm install` if `node_modules` is absent, `npm run dev -- --open`. Gatekeeper: README notes right-click → Open on
  first run.
- `tools/pipeline.command`: creates `tools/.venv` if missing, installs `tools/` requirements, runs
  `python tools/pipeline.py --all`, then `python tools/report.py`.
- `npm run dev | build | preview | test | test:e2e | lint | typecheck`.

### 17.2 CI (`ci.yml`, on push and PR)

Node 22: lint, typecheck, Vitest, build; Python 3.11: ruff, pytest (schema validation of committed data, golden
values, licence audit); Playwright e2e against `vite preview` (Chromium always; full matrix nightly). No network
fetches in CI.

### 17.3 Deployment (`deploy.yml`)

On push to `main`: build with `base: "/PTE-21C-Experience-the-Elements/"` and deploy with `actions/deploy-pages`.
**FIN:** in the repo's Settings → Pages, set Source to "GitHub Actions" once.

### 17.4 Claude Code cloud environment

The implementer runs in a sandbox whose outbound network may be allow-listed. The pipeline needs: `pubchem.ncbi.nlm.nih.gov`,
`physics.nist.gov`, `pml.nist.gov`, `www.nist.gov`, `nds.iaea.org`, `www.bipm.org`, `ccl.net`,
`images-of-elements.com`, `commons.wikimedia.org`, `upload.wikimedia.org`, `steck.us`, `personal.denison.edu`,
plus `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`, `github.com`. If a host is unreachable, do not
work around it: record `source_unavailable_at_build`, note it in `STATUS.md`, and Fin runs `tools/pipeline.command`
locally and commits the result.

### 17.5 Working agreement

- Work milestone by milestone (§18); do not start the next before the current one's acceptance criteria pass.
- Update `STATUS.md` at the end of every session: what changed, what is blocked, what Fin should look at.
- Commit small, descriptive commits; open a PR per milestone with screenshots; Fin merges.
- Ask before deviating from anything **LOCKED**; decide and document anything marked **IMPLEMENTER'S CHOICE**.

---

## 18. Milestones and acceptance criteria

### M0 — Skeleton
Repo files from §4.2; Vite/React/TS app with the table rendering 118 tiles in `standard18` from a first
`index.json` built by `fetch_pubchem.py` + `fetch_nist_gsie.py` + `fetch_nist_awic.py` + `build_layouts.py`;
schema + sources registry; CI green; Pages deploys; `PTE-21C.command` works.
**Accept when:** every tile shows the reference table's fields (weight or mass number, Z, IE₁, EN, oxidation states,
symbol, name, configuration with anomaly marker) and the hyperfine slot renders `Missing` correctly; schema and
coverage tests pass; the site is live on Pages.

### M1 — Table interaction
Layout morphing across all four layouts; group-3 toggle; trends (all arrows, ≥ 10 heatmaps, ≥ 6 maps); search;
hover card (with placeholders); pan/zoom; mobile sheet shell; routing; settings; keyboard navigation.
**Accept when:** §13.3 tests for hover, layout, group 3, trends, mobile and routing pass; axe clean; Lighthouse
budgets met; a 30-second screen recording of the morph is in the PR.

### M2 — Data complete for v0.1
All fetchers; all curated TOMLs populated to the coverage targets; images fetched, curated and credited;
`PROVENANCE.md` and `CREDITS.md` generated; coverage report in the About page.
**Accept when:** §13.1 passes including the licence audit; golden values pass; Fin has reviewed
`tools/raw/images-report.md` and `biology.toml` once.

### M3 — Sheet and panels, batch 1
Sheet + panel strip + tabs + deep links; panels `orbitals` (Tier A), `em`, `spectrum`, `nucleus`.
**Accept when:** §13.3 sheet tests pass; the 118×4 property test passes; the orbital gallery renders every occupied
subshell for Fe, Cs, Gd and Og within 2 s on an M1 Mac and 6 s on the mobile profile; the ionization ladder shows
all stages for every element; the spectrum strip renders for ≥ 90 elements; **design review with Fin**.

### M4 — Panels, batch 2
`probability`, `physical`, `math`, `amo`, `chemistry`, `biology`, `history`.
**Accept when:** the 118×11 property test passes; every `Missing` carries a reason; the AMO panel shows the
hyperfine, clock and laser-cooling data for Cs, Rb, Sr, Yb, Al, Hg, Th and `not_applicable` reasons for e.g. He;
Fin has reviewed `biology.toml`.

### M5 — Release v0.1.0
README with screenshots and the honest limitations; About page with coverage and privacy statement; CHANGELOG;
GitHub Release; tag `v0.1.0`.

### v0.2 (not scheduled)
Tier B orbitals; Pyykkö's Z = 119–172 layer in `janet`/`adomah`; prerendered per-element pages with Open Graph
tags; compare-two-elements mode; PWA offline; more categorical maps; CSV export per element; monthly scheduled
data-refresh PR; German UI.

---

## 19. Open items

**FIN (defaults apply until answered):**
- F1 Attribution name for the licence and credits (default "Bietenhader (Fin)"). **Answered 2026-10-22:
  "Serafin Bietenhader"; full name "Samuel Serafin Bietenhader" on 2026-10-23.**
- F2 Enable GitHub Pages → Source "GitHub Actions" in the repo settings.
- F3 Review `biology.toml` and `tools/raw/images-report.md` when M2 and M4 land.
- F4 Design review at the end of M3.
- F5 Confirm the subtitle (default: "A fresh perspective on the Periodic Table of the Elements").

**IMPLEMENTER'S CHOICE (decide, document in `docs/approach.md`):**
- I1 Pan/zoom library vs hand-rolled pointer handler.
- I2 Marching cubes vs raymarching for isosurfaces.
- I3 Exact typefaces (OFL).
- I4 Caps for lanthanide/actinide line and level lists (defaults: 400 lines, 60 levels).
- I5 How to map NIST's bracket/parenthesis flags on ionization energies to `flag`.
- I6 Whether to compute Tier B radial functions with PySCF or to parse the Bunge/McLean STO tables (v0.2).

---

## 20. Appendix — reference values and formulas

Golden values used by the tests (all with their sources in `sources.toml`):

| Quantity | Value | Source |
|---|---|---|
| Δν_Cs (SI defining) | 9 192 631 770 Hz, exact | SI Brochure |
| H-1 ground hyperfine splitting | 1 420 405 751.768(2) Hz | CODATA-cited measurement |
| Rb-87 ground hyperfine splitting | 6 834 682 610.904 312 6 Hz, u_r 6 × 10⁻¹⁶ (2017 value; fetch current) | BIPM SRS list (CCTF Recommendation 1, 2017) |
| Sr-87 ¹S₀–³P₀ | 429 228 004 229 873.0 Hz, u_r 4 × 10⁻¹⁶ (2017 value; fetch current) | BIPM SRS list |
| Yb-171 ¹S₀–³P₀ | 518 295 836 590 863.6 Hz, u_r 5 × 10⁻¹⁶ (2017 value; fetch current) | BIPM SRS list |
| Rb-87 D2 | λ = 780.241 nm, Γ/2π = 6.0666 MHz, T_D ≈ 145.6 μK, T_r ≈ 362 nK | Steck |
| Fe I ground | [Ar] 3d6 4s2, ⁵D₄ | NIST ASD |
| Madelung anomalies | Cr Cu Nb Mo Ru Rh Pd Ag La Ce Gd Pt Au Ac Th Pa U Np Cm Lr | NIST ASD vs generator |

Formulas: §11. Constants: generated from NIST CODATA 2022. Reference table for the tile: Robert Campion's
"Periodic Table of the Elements" (2016, updated 2018) as supplied by Fin; only its *fields* are reproduced, not
its artwork.

---

## 21. How to start (for the implementer)

1. Read this document fully. Create `CLAUDE.md` from the template in the repo (invariants, commands, conventions,
   pointers to §2, §15.3, §17.5).
2. Create `STATUS.md` with "M0 in progress" and the date.
3. Build M0. Open a PR titled "M0 — skeleton" with screenshots of the table on desktop and phone.
4. Stop and wait for Fin's review before M1.
