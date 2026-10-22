<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M4 — Panels, batch 2 · **ready for Fin's review (and his review of `biology.toml`)**
**Last updated:** 2026-10-22
**Next:** M5 — release v0.1.0 (README with screenshots, About page, CHANGELOG, GitHub Release), after Fin's
review of M4.

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at (M4)

All eleven tabs of an element's sheet are now filled in. The seven new ones, with a good element to try:

1. **Probability & statistics** — where the electron probably is (a curve and a slider: "within this radius
   the 5s electron is inside with probability 40 %"), whether each isotope is a boson or a fermion, how fast
   the atoms of a gas move at any temperature (slide down to the laser-cooling limits), the isotope mix, and
   what the "(2)" after a number means. *Try:* `#/Rb/probability`.
2. **Physical & engineering** — density, melting and boiling points, heat capacity, the crystal's unit cell in
   3D (drag it to turn it), allotropes, how common the element is in rock, sea water, the Solar System and
   your body, world production and price, uses, and the GHS hazard label. *Try:* `#/Fe/physical`,
   `#/C/physical`.
3. **Mathematical & theoretical** — each outer electron's four quantum numbers, Hund's rules worked step by
   step next to the term NIST measured (they agree for every element except cerium, and the panel says so),
   Slater's screening arithmetic, why some configurations break the filling rule, and how fast gold's inner
   electron moves (58 % of light speed — why gold is yellow). *Try:* `#/Fe/math`, `#/Au/math`.
4. **AMO & metrology** — the hyperfine levels (caesium's define the second), nuclear moments, atomic clocks,
   laser cooling with its temperature limits, and the history of the second. *Try:* `#/Cs/amo`, `#/Th/amo`,
   `#/He/amo` (helium has no hyperfine structure, and it says why).
5. **Chemistry & bonding** — oxidation states with an example compound for each, a size ladder of the ion and
   atom, electronegativity, bonding, well-known compounds and how the element reacts with air, water and
   acids. *Try:* `#/Fe/chemistry`, `#/Og/chemistry`.
6. **Biology & ecology** — whether plants and people need the element, how much is in a body, toxicity,
   cancer classifications (IARC), soils and food webs, and isotopes used in biology and medicine.
   *Try:* `#/P/biology`, `#/Cs/biology`.
7. **History & naming** — the discovery, its place on a world map, a timeline of all 118 discoveries and where
   the name comes from. *Try:* `#/Ra/history`.

### Your review of `tools/curated/biology.toml` (F3)

Your rows from M2 are unchanged. Everything new is at the end of the file, after the line
`# M4 additions` (line 344). On GitHub: open the pull request → "Files changed" → `tools/curated/biology.toml`.
Every row has its source; papers have a DOI that was checked; all text is in our own words.

- **21 isotope uses** (`[[isotope_use]]`): tritium (chromosome copying, 1957), deuterium + oxygen-18 (doubly
  labelled water), carbon-14 (dating; Calvin's photosynthesis tracer), carbon-13 (C3/C4 plants), nitrogen-15
  (Meselson–Stahl; food webs), oxygen-18 (oxygen from water in photosynthesis; past ocean temperatures),
  fluorine-18 (FDG scans), phosphorus-32 (Hevesy), phosphorus-32 and sulfur-35 (Hershey–Chase),
  strontium-87 (archaeology), technetium-99m, iodine-131 (thyroid treatment; after Chernobyl), caesium-137
  (uptake by plants), gadolinium (MRI contrast), lutetium-177, radium-223.
- **11 soil and environment notes** (`[[environment]]`): boron, nitrogen, phosphorus, sodium (salinity),
  aluminium (acid soils), arsenic, selenium (Kesterson), strontium, cadmium, mercury, radon.
- **6 toxicity notes** (`[[toxicity]]`): arsenic, cadmium (itai-itai), mercury (Minamata), lead, polonium,
  radon.
- **30 IARC entries** (`[[iarc]]`): only the agent's name is typed; the group (1, 2A, 2B, 3) is read from
  IARC's own list when the data is built.

Please say "biology OK", or tell me which rows to change or remove.

## M4 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| 118 × 11 property test | Test run in progress (`tests/e2e/panels.spec.ts`) |
| Every Missing carries a reason | Done — checked by the property test on every panel of every element, and by the pipeline |
| AMO panel: hyperfine, clock and laser-cooling data for Cs, Rb, Sr, Yb, Al, Hg, Th; `not_applicable` reasons for e.g. He | Test run in progress (`tests/e2e/amo.spec.ts`) |
| Fin has reviewed `biology.toml` | **Waiting for you** (see above) |

Full test totals follow when the run finishes.

## What changed this session

- **The seven panels** above, built in parallel and merged one by one; each has its own browser tests on
  desktop and phone, including an accessibility check (axe).
- **The electromagnetic panel** now shows the polarizability of all 118 atoms (how easily the electron cloud
  is pushed by an electric field). Properties not compiled yet are named under "Not yet compiled in
  PTE-21C" instead of being marked "not measured", which was untrue.
- **New data, all from `tools/`, each value with its source:**
  - chemistry for every element (`chemistry.toml`): every compound formula was checked against PubChem;
    where PubChem's record was wrong (for example Li₃N, PuO₂) the row cites Greenwood & Earnshaw instead;
  - ionic radii (Shannon 1976), heat capacities (CRC Handbook), allotropes, uses for every element, GHS
    hazards from PubChem;
  - the places of discovery on a world map (Natural Earth and GeoNames), IARC groups from IARC's list;
  - notes where relativity changes chemistry (gold, mercury, the car battery, francium), one paper each.
- **Fixes:**
  - oganesson's chemistry notes now cite the 2020 paper that actually predicts it is a solid;
  - a few laser-cooling notes showed a raw data key on screen; they now read in plain words;
  - "μ_N" (nuclear magneton) is written with a real subscript, and a 16-digit frequency with powers of ten;
  - two entries for the same textbook were merged into one source.
- **Docs:** every M4 decision is in `docs/approach.md` (section "M4: panels, batch 2"); README and CHANGELOG
  updated.

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
| F1 Attribution name | "Bietenhader (Fin)" (README, footer, package) | Confirm or change before M5 |
| F2 GitHub Pages | Source "GitHub Actions" | Done (2026-10-20) |
| F3 Review `biology.toml` and the image report | Reviewed in M2 ("LGTM") | **Now (M4):** the new rows (see above) |
| F4 Design review | M3: "the screenshots look good" | Comments on the M4 screenshots welcome |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Confirm or change before M5 |

## Earlier decisions (still in force)

- Atomic weights stay with NIST AWIC; the values IUPAC has revised since are listed in `tools/build-report.md`.
- *hfs n/m* also covers "not yet in our curated table".
- The long form keeps the spec's La/Ac arrangement (open question from M1, default kept).
- Elements 109–118: published predictions kept, marked † (M2 question 1, your default).

## Known issues and housekeeping

- Firefox, Safari/WebKit and iPhone run in the nightly job only (this environment can run Chromium only).
- ESLint 9 (a developer tool) is past end of life; the accessibility lint plugin still needs it.
- The built site carries KaTeX's fonts in three formats (woff2, woff, ttf); browsers download only the one
  they need, and only when a formula is shown.
