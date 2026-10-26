<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M5 — Release v0.1.0 · **released on 2026-10-23** (tag `v0.1.0`, GitHub Release)
**Last updated:** 2026-10-24
**Now:** "Plants in detail" in the Biology & ecology panel (pull request open, for Fin's review). Fin's open
questions below still have their defaults.

This file is updated at the end of every working session (SPEC §17.5).

---

## Sector maps (2026-10-26) — please review `tools/curated/sectors.toml`

- Three maps below "Essential for humans": energy, logistics & infrastructure, IT / computing / telecom.
- **Your decisions, done:** the counting rule stays ("essential" = used in every technology the JRC studied for
  that sector, or a main use named by the USGS; "important" = some); cement and concrete added; every row is
  now a full sentence naming what the element goes into.
- **Cement and concrete:** calcium is now *essential* for infrastructure (USGS: about a sixth of US crushed stone,
  mostly limestone, goes into cement; cement plants also use gypsum). Clay and sand go into cement and concrete
  too, but the USGS names them as rocks, not as elements, so silicon and aluminium keep their other rows.
- **Fossil fuels:** carbon and hydrogen now count for energy, from the US EIA "Energy Explained" pages (coal,
  oil and gas are carbon and hydrocarbon fuels; hydrogen is an energy carrier). Both are *important* under the
  counting rule. **Your call:** should C and H be shown as *essential* for energy?
- **IEA report:** now used, from the pages you sent (copper in every power technology and grids, aluminium in
  grids, silicon and silver in solar cells, lithium in batteries, zirconium in electrolysers). The full PDF did
  not arrive, only page images; the report is "all rights reserved", so facts only.
- **Graedel et al. (PNAS 2015), both papers:** now available (your copies). The per-element use tables are in
  their online supplements, which you did not send; from the main texts: tungsten (half goes into cemented-
  carbide tools for mining and construction) and niobium (a steel-alloying metal), both *important* for
  infrastructure.
- Grouped rows of the JRC tables (platinum-group metals, "light/heavy rare earths, rest") are still left out:
  the tables do not say which members are used; the magnet rare earths count as Nd, Pr, Dy, Tb (report p. 45).

## Plants, part 2, and three maps (2026-10-25) — please review

- New notes at the end of the element blocks in `tools/curated/plants.toml`: V, La, Ce, Nd, Cr, As, Cd, Hg, Pb.
- **Vanadium:** Barker & Pilbeam call it apparently beneficial, Marschner (4th ed.) calls such reports "rare
  and vague". Both views are given; its status stays "not essential". Your call.
- Mercury is thin (the books say little); thallium was left out (not asked for).
- Maps: Essential for bacteria / fungi / archaea, from the `[[life]]` rows you already approved.
- Next (PR B): Energy, Logistics / Infrastructure, IT / Computing / Telecom — waiting for your choice of
  literature and of the "essential" rule.

## Plants in detail (2026-10-24) — please review `tools/curated/plants.toml`

You chose design B: the Plants card now has a **"More about plants"** button; the details open below the
six cards. They show how roots take the element up, how it moves in the phloem, how much a well-fed shoot
holds, its job, since when it is known to be needed (or to help), a chart of leaf levels from too little to
too much (with "Show as table"), and notes on shortage, excess, soils, partners in the soil, wild plants,
forests, and crops and food. First batch: the 14 essential mineral nutrients, Na, Si, Co, Se, Al and I,
and briefly H, C and O — 22 elements, 173 notes, 57 leaf levels, from the five books you sent plus Mengel
& Kirkby. Each element in the file starts with a line like `# --- Zinc (Z = 30) ---`.

1. **The six plant groups exist as one table only for zinc and iron** (Barker & Pilbeam). For the other
   elements each chart shows the plants its books give levels for: maize and apple from Mengel & Kirkby
   (Tables 2.20 and 2.21), Norway spruce and *Eucalyptus grandis* from Binkley & Fisher (critical levels,
   N, P, K, Ca, Mg; Table 13.2 gives ranges such as 12–15 mg/g, drawn as a band), conifers for the
   micronutrients from Binkley & Fisher's chapter 13 (after Carter 1992, "not well established"), and
   Barker & Pilbeam's crop tables (soybean, alfalfa, tomato, potato, rice …). No leaf levels for Cl and Ni
   (single measurements only) or for the beneficial elements.
2. **Please check these numbers against your printed books** (the text files lose some characters):
   - Maize, potassium: "too much" above **55** mg/g, although "high" ends at 35 (Mengel & Kirkby Table 2.20).
   - Maize, manganese: "too much" above **350** μg/g (printed without ">").
   - Maize, zinc: the "deficient" limit reads "<5" although "low" is 15–20 — left out.
   - Maize, iron: the row is garbled — left out; cereals use Barker's grasses row instead.
   - Apple, iron: adequate read as **50–150** (printed "5 -150"); apple, manganese: adequate 35–105, "high"
     printed as >150.
   - *Eucalyptus grandis*: calcium **5.6** and magnesium **3.5** mg/g, far above the other trees in Binkley
     & Fisher's Table 13.2.
   - Molybdenum in conifers: Barker gives Douglas fir 0.02–0.25 mg/kg as sufficient, Binkley & Fisher
     call < 0.1 a possible deficiency — I used Binkley & Fisher.
3. **The plant sentences of `biology.toml` now cite Marschner's 4th edition** (2023). Checked against the
   new text; 12 were reworded to match it: H, C, O (taken up as water and CO₂; building blocks), N ("after
   carbon, the element needed in the largest amount" instead of "most often limits growth"), Ca (hardly
   moves in the phloem), S (glucosinolates instead of iron–sulfur clusters), Fe (pale yellow young leaves),
   Zn (auxin "probably"), Si ("among crops"), Co (no essential role known, delays leaf ageing), Se (not
   *shown* to be needed), Al (helps acid-soil plants such as tea and hydrangea that store it). The boron
   soil note was moved too.
4. **Iodine is now "beneficial" for plants**, because the 4th edition lists it among the beneficial
   elements (chapter 1; experiments with thale cress and others, Kiferle et al. 2019/2021).
5. **One line on the open debate** about what counts as a plant nutrient (Brown, Zhao & Dobermann 2022)
   is in the legend under the six cards.
6. **Your call:** silicon has single values for several crops grown side by side (rice 39.1, wheat 15.4,
   maize 21.0, cucumber 22.9, chickpea 3.0 mg/g, Barker Table 20.1). They are not ranges, so they are not
   shown; a "single value" row could show them. Default: leave them out.
7. **Still to come (second pull request, as agreed):** what too much of other elements (Cd, Pb, Hg, As …)
   does to plants, the lanthanides and vanadium.

## Your review on the iPhone (video, 2026-10-22)

1. **The sheet on iPhone (Safari and Brave): fixed and merged** (pull request #7). The photographs and summary were
   taller than an iPhone screen, so the tabs sat under the browser's toolbar and the panels never appeared.
   They now take at most a third of the screen and scroll on their own; the tabs and the panel are always
   visible, and scrolling into a panel folds the top away as before. Tested at iPhone SE and iPhone 15 sizes.
   *Please try it on your iPhone after merging.*
2. **Biology & ecology for six groups of life: merged** (pull request #8) after your review ("biology OK",
   2026-10-23). Humans, animals, plants, fungi, bacteria and archaea, each with its status in words and one
   sourced sentence per role; the farm-animal rows were checked against Suttle's 5th edition.
3. **The release (tag `v0.1.0`)** was made on 2026-10-23, after both were merged.

### The new biology rows (`[[life]]`, end of `tools/curated/biology.toml`) — reviewed: "biology OK" (2026-10-23)

95 rows: animals 32, fungi 17, bacteria 27, archaea 19. Every DOI was checked against Crossref; all text is
our own words. Status words: **essential** (needed by essentially all members of the group), **used by
some, not all** (the sentence names which), **beneficial** (helpful in some trials, not shown to be
needed), **no known role** (with a source saying the group does without
it, e.g. fungi and selenium), and, with no row, "no role is known from PTE-21C's sources — that does not
mean there is none". Things I would like your eye on:

1. **Farm animals, checked against your copy of Suttle's *Mineral Nutrition of Livestock* (5th ed., 2022).**
   All 14 rows now cite the 5th edition, one chapter DOI per element (checked against Crossref). Every
   sentence was compared with the book's text; one was reworded: sodium no longer says "carries nerve
   signals" (the book does not say so) but "the main positive ion of the body fluids outside the cells,
   holding water there and keeping the acid–base balance". New from the book: molybdenum (essential:
   xanthine oxidoreductase, aldehyde oxidase, sulfite oxidase), and the elements its chapter 17 counts as
   "occasionally beneficial", shown as **beneficial**: boron, chromium, lithium (marked disputed), nickel,
   silicon, vanadium; fluorine as "no known role" (chapter 18: no essential function known, fluorosis in
   excess). Left out: rubidium (the goat findings were not repeatable elsewhere) and arsenic (claims of
   essentiality "disputed"). Only facts, in our own words; the book's text is not in the repository.
2. **Generalisations:** animals' and fungi's building blocks (H, C, N, O, P, S) rest on Maret's overview
   figure; fungi's K, Mg, Ca, Mn, Fe, Zn, Cu on baker's yeast (the sentences say so); archaea's K and Mg on a
   review of prokaryotes in general.
3. **Kept at "used by some" to stay careful:** bromine for animals (shown in fruit flies; the authors say
   all animals), iodine (the source covers farm animals), selenium and cobalt (insects lost them),
   molybdenum in archaea (about 5 % lack it).
4. **Left out because they could not be checked:** cobalt for fungi, manganese peroxidase of white-rot
   fungi, sodium pumps in methanogens.
5. **One style for all six cards?** Humans and plants still say "Not essential — No known role." where the
   new cards say "No known role … that does not mean there is none". Default: leave humans and plants as
   you approved them.

## For Fin: what to look at (M5)

1. **Your name and the credits.** The footer, the About page, the README and the package say "Samuel Serafin
   Bietenhader". The README section "How it was made" and the About page credit the collaboration with Claude
   (Anthropic); the models and effort levels used go on one README line, which you fill in yourself.
2. **The note above the table** used to say "Preview (milestone M2) …". It now says "Version 0.1.0. Open any
   element for its sheet: eleven panels, and every number with its source." The About page says the version too.
3. **About → "How complete the data is"** now also counts everything added in M4 (polarizability, ionic
   radii, compounds, reactions, heat capacity, allotropes, uses, GHS labels, IARC, isotope uses, places of
   discovery), each with a short reason why the other elements have none.
4. **README → "Honest limitations"**: the approximations, what is predicted rather than measured, what is not
   compiled yet, which tables were transcribed, why the hazard labels are not lab advice, and which browsers
   are tested.
5. **CHANGELOG → [0.1.0]**: everything from M0 to M5; these become the notes of the GitHub Release.

### How the release happens

Merging the pull request publishes the site as usual. The release is one more step: a small workflow on
GitHub (Actions → **Release** → **Run workflow**, version `0.1.0`) checks that the version, the changelog
and the tag fit, then creates the tag `v0.1.0` and the release page with the changelog as its text. Tell me
"release" after merging and I will start it and check the result; or click it yourself.

## M5 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| README with screenshots and the honest limitations | Done — screenshots from M1, M3 and M4; new section "Honest limitations" |
| About page with coverage and privacy statement | Done — coverage now includes the M4 fields; privacy statement unchanged |
| CHANGELOG | Done — section [0.1.0], dated 2026-10-22 |
| GitHub Release; tag `v0.1.0` | Done — made by the Release workflow on 2026-10-23 |

Also: 294 unit tests and 162 pipeline tests pass; the About, table, probability and AMO browser tests pass on
desktop and phone (the full browser suite runs in CI on the pull request); lint, type checks, the licence audit
of the data and the licence check of the code dependencies are clean.

## What changed this session

- **M4 merged** (pull request #5) after your review; `biology.toml` approved ("biology OK").
- **M5:** your name as the licence and credit name; version 0.1.0 on the page and in the About dialog; the
  coverage table extended; README "Honest limitations"; CHANGELOG 0.1.0; the release workflow; the decisions
  in `docs/approach.md` ("M5: release v0.1.0").

## Questions for Fin — defaults in place, nothing waits on them

1. **GHS labels without an EU classification.** For 55 elements the EU has no official classification, so the
   panel shows the summary of what companies reported to the EU chemicals agency (ECHA), with the share of
   reports behind each hazard. For iron, 74 % of reports say "not hazardous" and the rest mostly concern
   iron *powder*. **Default:** show it, with that share in a box above the pictograms. The alternative is to
   show only official EU classifications (29 elements) and "not classified" for the rest.
2. **Values copied via the mendeleev package** (heat capacities from the CRC Handbook, ionic radii from
   Shannon 1976) were spot-checked but not compared line by line with the printed tables. If your library has
   the CRC Handbook (95th edition) or Shannon's paper, a spot check of a few rows would be welcome.
   **Default:** keep them; PROVENANCE.md says how they were transcribed.
3. **Still open from M3:** the time the oganesson orbital gallery takes on your Mac (`#/Og/orbitals`, the
   number under the gallery). And, with defaults kept: the CIE colour table; thorium's and uranium's "returned,
   not made" share; the M2 defaults (elements 109–118 predictions, Lodders 2025, black phosphorus).

## Blocked

- Nothing. Two websites refused this cloud machine, and other sources were used instead: Wikidata (too many
  requests) → coordinates from Natural Earth and GeoNames; ECHA (403) → GHS classifications via PubChem.

## Not yet compiled (honest gaps, not errors)

- **Hyperfine splittings:** 27 elements have curated rows; the AMO panel says "Not yet in PTE-21C's curated
  hyperfine table" for the others that have hyperfine structure.
- **Electromagnetic:** magnetic ordering, resistivity, superconductivity, work function, band gap.
- **Physical:** thermal conductivity and expansion, elastic moduli, speed of sound, hardness (the only primary
  table found for conductivity is a scanned PDF). Metallic radii on the chemistry panel.
- **Flame-test colours** (no sourced table yet).
- **History:** eight discoveries have no single place in our table (Ti, Ga, As, Te, Sm, Dy, Ho, Pt); the map
  says so. Historical photographs exist only for Pm, Ra, Cm and Fm.
- **Orbital energies beyond uranium:** NIST's table (SRD 141) stops at Z = 92; the orbitals panel says so.

## Notes (things that differ from what you might expect)

- **The GHS diamonds are drawn by PTE-21C** (red border, code and name), not the official pictogram artwork.
  GHS has no hazard class for radioactivity; radioactive elements say so.
- **The chemistry panel's reaction notes describe chemistry, not safe handling**, and the panel says so.
- **No toxicity note does not mean safe**; the biology panel says that in words.
- **The orbital pictures and the probability curves are approximations** (hydrogen-like shapes with an
  effective nuclear charge); both panels say so in their grey note.
- **Laser-cooling limits are computed** from the line's wavelength and width (marked "computed").

## FIN items — defaults in use (SPEC §19)

| Item | Default in use | What you need to do |
|---|---|---|
| F1 Attribution name | "Samuel Serafin Bietenhader" (README, footer, About, package) | Answered 2026-10-22; full name 2026-10-23 |
| F2 GitHub Pages | Source "GitHub Actions" | Done (2026-10-20) |
| F3 Review `biology.toml` and the image report | Reviewed in M2 ("LGTM") | M4 rows reviewed: "biology OK" (2026-10-22) |
| F4 Design review | M3: "the screenshots look good" | Comments on the M4 screenshots welcome |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Kept (no change asked, 2026-10-22) |

## Earlier decisions (still in force)

- Atomic weights stay with NIST AWIC; the values IUPAC has revised since are listed in `tools/build-report.md`.
- *hfs n/m* also covers "not yet in our curated table".
- The long form keeps the spec's La/Ac arrangement (open question from M1, default kept).
- Elements 109–118: published predictions kept, marked † (M2 question 1, your default).

## Known issues and housekeeping

- Firefox, Safari/WebKit and iPhone run in the "Nightly browsers" workflow only (this environment can run Chromium
  only). Its nightly schedule is **paused** since 2026-10-23 while peer feedback is collected; it runs when started by
  hand (Actions → Nightly browsers → Run workflow). No workflow runs on a timer now.
- ESLint 9 (a developer tool) is past end of life; the accessibility lint plugin still needs it.
- The built site carries KaTeX's fonts in three formats (woff2, woff, ttf); browsers download only the one
  they need, and only when a formula is shown.
