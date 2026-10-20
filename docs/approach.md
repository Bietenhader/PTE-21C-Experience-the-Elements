<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Approach and decisions

This file records every **IMPLEMENTER'S CHOICE** from SPEC §19 and every place where the implementation
had to interpret or extend the spec. SPEC.md stays authoritative; when something here conflicts with it,
the spec wins and the conflict is listed in STATUS.md for Fin.

## Implementer's choices (SPEC §19)

| # | Question | Decision | Status |
|---|---|---|---|
| I1 | Pan/zoom library or hand-rolled | **Hand-rolled pointer handler** (~150 lines in `src/table/`): no dependency, full control over keyboard zoom, `prefers-reduced-motion` and the FLIP morph sharing one transform. | Decided; built in M1 |
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

- **Tile size in M0.** Pan and zoom arrive in M1. Until then a two-way switch, *Compact* / *Full-size
  tiles*, lets every field be seen. Compact tiles share the screen width but never shrink below 1.5 rem
  (24 px, the WCAG 2.2 minimum target), so on narrow phones the table scrolls sideways a little.
- **Progressive disclosure** is pure CSS container queries on each tile (≥ 110 px every field, 60–110 px
  Z/symbol/name/configuration, < 60 px Z and symbol) with type sized in container units.
- **Accessible name and description.** Each tile button's name is "Caesium (Cs), atomic number 55, alkali
  metal." — the spec's wording plus the symbol, so speech-input users can say what they see (WCAG 2.5.3).
  The full field list, with sources, is the button's description. "Press Enter for details." joins the name
  when the sheet exists (M3). axe's experimental `label-content-name-mismatch` heuristic is turned off in
  the end-to-end test because it demands every visible character of a data tile in the name; a dedicated
  test checks the name contains the visible symbol and name instead.
- **Fonts** were copied once from the Fontsource npm packages (v5.3.0) into `public/fonts/` with their OFL
  licence texts; the app has no font dependency at run time.
- **Base path.** Every build (and `vite preview`) uses `/PTE-21C-Experience-the-Elements/`, so the
  end-to-end tests run exactly what GitHub Pages serves.

## Tooling

- Versions are pinned exactly. TypeScript 6.0 is used because typescript-eslint does not yet support
  TypeScript 7; ESLint 9 because eslint-plugin-jsx-a11y does not yet support ESLint 10 (ESLint 9 is now
  past end of life — revisit in M1). Playwright is pinned to 1.56.1 to match the browsers in the cloud
  environment, with a single `playwright-core` enforced through npm `overrides`.
- Two development-only tools are MPL-2.0 (weak copyleft): axe-core (accessibility tests) and lightningcss
  (inside Vite). Neither is shipped to visitors; `npm run check:licences` enforces that only permissive
  packages are.
- Coverage thresholds live in `tools/coverage.toml`, each tagged with the milestone from which it applies,
  so the SPEC §13.1 targets that need M2 data switch on with M2 instead of being weakened.
- `tools/build-report.md` is committed so reviewers see every disagreement between sources and every rule
  applied, and its diff shows what changed after a data refresh.
