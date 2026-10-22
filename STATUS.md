<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M5 — Release v0.1.0 · **ready for Fin's review**
**Last updated:** 2026-10-22
**Next:** after Fin merges the M5 pull request, the release itself (tag `v0.1.0` and the GitHub Release). After
that, v0.2 is not scheduled (SPEC §18).

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at (M5)

1. **Your name.** The footer, the About page, the README and the package now say "Serafin Bietenhader".
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
| GitHub Release; tag `v0.1.0` | After the merge: the Release workflow creates both |

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
| F1 Attribution name | "Serafin Bietenhader" (README, footer, About, package) | Answered 2026-10-22 |
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

- Firefox, Safari/WebKit and iPhone run in the nightly job only (this environment can run Chromium only).
- ESLint 9 (a developer tool) is past end of life; the accessibility lint plugin still needs it.
- The built site carries KaTeX's fonts in three formats (woff2, woff, ttf); browsers download only the one
  they need, and only when a formula is shown.
