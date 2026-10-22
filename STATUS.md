<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M3 — Sheet and panels, batch 1 · **ready for Fin's review and design review**
**Last updated:** 2026-10-22
**Next:** M4 (panels batch 2: probability, physical, mathematical, AMO, materials, biology, history), after
Fin's review of M3.

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at (M3)

Open any element and use the tabs at the top of its sheet. Four panels are now filled in:

1. **Orbitals** — a small 3D picture of every electron shell the atom has (iron has 7, oganesson 19), the
   outer ones outlined in yellow. Click a picture to see it large below: drag it to turn it, choose the other
   orientations (p_x, p_y, p_z …), switch to the "complex" view, show where the wave is zero (nodal
   surfaces) or a cross-section. Further down: the **shell stack** (every shell's size on one axis — this is
   where you see that in gadolinium the 4f shell sits deep inside the 6s shell) and a table of the numbers.
   A grey note at the top says honestly which approximation this is.
   *Try:* `#/Gd/orbitals`, `#/Og/orbitals`.
2. **Electromagnetic & ionization** — the energy to pull off each electron in turn (the big jumps are
   closed shells), electron affinity, three electronegativity scales, and where the element sits on the
   sawtooth of all elements. *Try:* `#/Na/em`.
3. **Spectrum & energy levels** — the coloured lines the atom gives off, its strongest lines, and a diagram of
   its energy levels with the laser-cooling and clock transitions marked. *Try:* `#/Sr/spectrum`, `#/Hg/spectrum`.
4. **Nucleus & isotopes** — every known isotope with its half-life, how the radioactive ones decay (with a
   little calculator: "what is the chance one nucleus survives 1000 years?"), how tightly the nucleus is
   bound, and where in the universe the element was made. *Try:* `#/U/nucleus`, `#/Th/nucleus`.

Every chart has a "Show as table" button, and every grey source label opens a small card saying where the
number comes from.

**The design review (F4) is part of M3's acceptance.** Please look at the screenshots in the pull request (or
the live preview after merging) and tell me what you would change: colours, sizes, order, wording, anything.

**One thing to try on your Mac:** open `#/Og/orbitals`. Under the gallery it says how long the 19 pictures took
*on your computer*. The goal is under 2 seconds on an M1 Mac. I measured 2.2 s in my cloud machine, which has no
graphics card (it draws 3D in software), so yours should be faster — please tell me the number you see.

## M3 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| §13.3 sheet tests pass | Done — all sheet tests pass on desktop and phone (Chromium) |
| 118 × 4 property test | Done — every element on each of the four panels: no console errors, every missing value names its reason, nothing like "NaN" on screen (`tests/e2e/panels.spec.ts`, 3.6 min) |
| Orbital gallery for Fe, Cs, Gd, Og within 2 s (M1 Mac) / 6 s (mobile profile) | Mobile profile met: 0.7 / 0.9 / 1.0 / 1.4 s. Desktop measured on the cloud VM without a GPU: 1.1 / 1.6 / 1.5 / 2.2 s — **please confirm on your Mac** (see above) |
| Ionization ladder shows all stages for every element | Done — every stage NIST lists is drawn (all Z stages for Z ≤ 103; 68–73 stages for Z = 104–110); Z ≥ 111 says NIST lists none, with only a predicted IE₁ |
| Spectrum strip renders for ≥ 90 elements | Done — 98 elements |
| Design review with Fin | **Waiting for you** |

Also: 228 unit tests, 121 pipeline tests and 149 end-to-end tests (Chromium, desktop and phone; 17 more are
for the other profile only) pass; the Lighthouse budgets hold (mobile score 94, initial JavaScript 108.5 kB of
300 kB — the 3D library loads only with the orbitals panel — first table paint 1.33 s); lint, type checks and
the licence check of the code dependencies are clean.

## What changed this session

- **The four panels** above, plus the pieces they share: chart frames with captions and tables, source cards,
  formulas (KaTeX), and 3D drawing (three.js).
- **Phones:** the element sheet's top part (photographs and summary) folds away while you read a long panel,
  so the panel gets the whole screen; scrolling back to the top (or the button "Show photographs and
  summary") brings it back. The tab row now always shows the current tab.
- **Your data refresh** (the seven Commons photographs) is merged; all photo credits checked.
- **Data fixes found while building the panels** (all from the pipeline, nothing typed by hand):
  - **Thorium and uranium "made in dying low-mass stars (AGB), 10 %"** was wrong as worded: those stars
    cannot make anything heavier than lead and bismuth. The share in the paper's figure is material they
    *returned* to space. It now says "returned, not made", and a test stops this from happening again.
  - The energy-level files had the wrong ionization limit for 32 elements (sodium said 71.4 eV instead of
    5.14 eV); fixed and tested.
  - Half-lives in years now use the same year as the IAEA's data (before, thorium-232 read 1.39997 × 10¹⁰
    years instead of 1.40 × 10¹⁰).
  - Tidier numbers for isotope masses, and clearer wording where only a limit is known.
- **Speed:** each orbital picture is now computed about five times faster than in the first version.
- **Docs:** every M3 decision is in `docs/approach.md` (section "M3: panels, batch 1"); NOTICE.md lists the new
  libraries and the KaTeX fonts' licence.

## Questions for Fin — defaults in place, nothing waits on them

1. **Colour table for the spectra.** The colours of spectral lines are computed from the international
   standard for human colour vision (CIE 1931). Its numbers are a cited standard table, but the file the CIE
   publishes is under CC BY-SA 4.0. **Default: keep it**, credited as a standard table. The alternative is a
   published formula that imitates the table (Wyman et al. 2013); on screen you could not tell them apart.
2. **Cosmic origin of thorium and uranium** (see above): **default:** keep the paper's 10 % but label it
   "returned, not made". The alternative is to leave that share out and show 100 % from exploding stars.
3. From M2, still with their defaults: elements 109–118 predictions kept; Lodders 2025 solar abundances;
   black phosphorus as phosphorus's crystal.

## Blocked

- Nothing. (The four Commons photographs from M2 came with your data refresh.)

## Not yet compiled (honest gaps, not errors)

- **Hyperfine splittings:** 18 elements have the headline value on the tile; 42 more have hyperfine structure
  that is not yet in our table (the tile says *hfs n/m*, as agreed). More rows come with the AMO panel in M4.
- **Polarizability, magnetic ordering, resistivity, superconductivity, work function, band gap** are listed
  on the electromagnetic panel as "not measured — not yet compiled", rather than hidden. If you can download
  the polarizability table (Schwerdtfeger & Nagle 2019) through your university, I can transcribe it.
- **Flame-test colours** are shown as not yet compiled (no sourced table yet).
- **Orbital energies beyond uranium:** NIST's table (SRD 141) stops at Z = 92; the orbitals panel says so.
- **Uranium's energy levels:** NIST lists just one level for the neutral atom, so its diagram is nearly empty.

## Notes (things that differ from what you might expect)

- **The orbital pictures are an approximation** (hydrogen-like shapes with an effective nuclear charge). The
  shapes are exact for one electron; the sizes are approximate for heavy atoms (the outer shells in the
  shell stack can come out noticeably larger than they really are). The panel says so in its grey note; the more accurate
  version (Tier B) is planned for v0.2.
- **Each gallery picture is scaled to fit its tile**; true sizes are in the shell stack.
- **Cosmic origin is an approximation**, read off a figure of a model (Kobayashi et al. 2020) in 5 % steps.
- **Rubidium's D2 line (780.03 nm in air)** sits just outside the 380–780 nm "visible" window of the spectrum
  strip; it is in the laser-cooling data, where it belongs.

## FIN items — defaults in use (SPEC §19)

| Item | Default in use | What you need to do |
|---|---|---|
| F1 Attribution name | "Bietenhader (Fin)" (README, footer, package) | Confirm or change before M5 |
| F2 GitHub Pages | Source "GitHub Actions" | Done (2026-10-20) |
| F3 Review `biology.toml` and the image report | Reviewed in M2 ("LGTM") | Biology again at M4 |
| F4 Design review | — | **Now (M3)**: comments on the screenshots or the live site |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Confirm or change |

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
