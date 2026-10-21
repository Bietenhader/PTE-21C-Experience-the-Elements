<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M2 — Data complete for v0.1 · **ready for review** (pull request open)
**Last updated:** 2026-10-21
**Next:** M3 (the panels' physics), after Fin's review of M2.

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at (M2 review)

M2 is mostly invisible on the table itself: it fills the data behind every element, which the panels draw in
M3 and M4. What you can see now:

1. **Photographs.** Hover or click any element: 90 elements have a photograph, each credited where it is shown
   (title, author, licence, link to its page). The others show a card that says honestly why there is no
   photo.
2. **The About page.** The new *About* button (top right) shows the privacy statement, how complete each kind
   of data is, and every source with its licence and the date it was downloaded.
3. **A short text for every element**, in our own words, at the top of each element's sheet.
4. **Six new colour maps** in the *Trend* menu: laser-cooled, clocks, the elements in the SI, essential for
   plants, essential for humans, and cosmic origin.

**Two files for you to read once** (this is part of M2's acceptance):

- **`tools/curated/biology.toml`** — which elements plants and humans need, with sources. You are the plant
  scientist: please check the plant side especially (essential vs beneficial, and the one-line roles).
  Comments on the pull request, or "looks fine", are both welcome.
- **`tools/images-report.md`** — which photograph was chosen for each element and why. (The spec calls it
  `tools/raw/images-report.md`; that folder is not uploaded to GitHub, so the committed copy lives one folder
  up. Both are the same file.)

## M2 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| All fetchers | Done — new: NIST energy levels, NIST spectral lines, NIST SRD 141 orbital energies, BIPM standard frequencies, images-of-elements.com and Wikimedia Commons; IAEA now also reads each nuclide's level table (for nuclear moments) |
| All curated tables populated to the coverage targets | Done — 18 curated tables plus 118 short texts; every SPEC §13.1 threshold passes (configuration, term and IE₁ 118; atomic weight or mass number 118; image or placeholder 118; isotopes 118; visible lines 98 of the required 90) |
| Images fetched, curated and credited | Done for 90 elements (144 photos); 4 chosen Commons photos are waiting for a download (see "Blocked") |
| PROVENANCE.md and CREDITS.md generated | Done (`python tools/report.py`; CI checks they are current) |
| Coverage report in the About page | Done (`#/about`) |
| §13.1 passes, including the licence audit | Done — 111 pipeline tests pass; licence audit clean |
| Golden values pass | Done — Fe configuration and term, Cs IE₁, U-238, Madelung set, H-1 and Cs-133 hyperfine, Rb-87 hyperfine = BIPM to 1 mHz, Rb-87 D2 Doppler/recoil limits within 0.5 % |
| Fin has reviewed the image report and biology.toml once | **Waiting for you** |

Also: 158 unit tests and 87 end-to-end tests (Chromium, desktop and phone) pass; the Lighthouse budgets hold
(mobile score 95, first table paint 1.18 s); lint, type checks and the
licence check of the code dependencies are clean.

## What changed this session

- **Per-element data files** (`public/data/elements/`, `isotopes/`, `spectra/`, `levels/`, `metrology.json`),
  loaded only when an element is opened: isotopes with half-lives, decays, masses and nuclear moments; visible
  spectral lines and energy levels; ionization energies of every stage; effective nuclear charges and orbital
  energies; hyperfine constants; clocks and standard frequencies; laser cooling; the elements' roles in the SI;
  abundances (crust, sea water, Sun, human body); crystal structures; world production and prices; EU critical
  raw materials; biology; discovery history; our own short texts.
- **The app:** photographs with credits, the About page, the short texts, six maps, search for "laser-cooled",
  "clock" and "essential".
- **Docs:** every M2 decision is in `docs/approach.md` (section "M2: data").

## Questions for Fin — defaults in place, nothing waits on them

1. **Elements 109–118.** NIST lists nothing above element 108, but the spec wants a ground term for all 118
   and IE₁ for at least 110. I added published calculations (each with its paper), marked † and called
   "predicted" everywhere — never shown as measured. **Default: keep them.** If you prefer "only
   theoretical predictions exist", one file is deleted and they disappear.
2. **Solar abundances.** The spec names Lodders 2009 or Asplund 2021; I used the newer, openly licensed
   successor, Lodders, Bergemann & Palme 2025. **Default: keep it.**
3. **Phosphorus's crystal structure** is black phosphorus (the stable form), because the database has no
   room-temperature entry for white phosphorus, the usual reference form. **Default: keep it**, with a note.

## Blocked (needs your computer once)

- **Four photographs from Wikimedia Commons** — technetium, promethium, thorium (two) and protactinium —
  were chosen and checked, but Wikimedia's servers answered this cloud environment with "too many requests"
  for hours (and two historical pictures for radium and curium likewise). As CLAUDE.md asks, I did not work
  around it: these elements show a card "photograph not yet downloaded". **To fix:** double-click
  `tools/pipeline.command` on your Mac (it downloads what is missing and rebuilds), then commit the changes
  with GitHub Desktop. Nothing else depends on it.

## Not yet compiled (honest gaps, not errors)

- **Hyperfine splittings:** 18 elements have the headline value on the tile; 42 more have hyperfine structure
  that is not yet in our table (the tile says *hfs n/m*, as agreed). More rows come with the AMO panel in M3.
- **Polarizability** is left out of v0.1 for now: the reference table (Schwerdtfeger & Nagle 2019, Mol. Phys.)
  could not be read from here. If you can download it through your university, I can transcribe it.
- **Electron affinity** exists for 57 elements and **Pauling electronegativity** for 95; the rest are shown as
  not measured, as the sources say.

## Notes (things that differ from what you might expect)

- **Cosmic origin is an approximation**, read off a figure of a model (Kobayashi et al. 2020) in 5 % steps;
  the map and the data say so. Helium, lithium, technetium, promethium and lead are left out because the figure
  cannot be read for them.
- **Argon's crystal cell** in the open database looks about 1 % too small; it is flagged "doubtful" with the
  reason rather than silently corrected.
- **Rubidium's D2 line (780.03 nm in air)** sits just outside the 380–780 nm "visible" window of the spectrum
  files; it is in the laser-cooling data, where it belongs.
- **Helium's melting point** now carries a note: it needs pressure (helium does not freeze at normal pressure).

## FIN items — defaults in use (SPEC §19)

| Item | Default in use | What you need to do |
|---|---|---|
| F1 Attribution name | "Bietenhader (Fin)" (README, footer, package) | Confirm or change before M5 |
| F2 GitHub Pages | Source "GitHub Actions" | Done (2026-10-20) |
| F3 Review `biology.toml` and the image report | — | **Now (M2)**; biology again at M4 |
| F4 Design review | — | End of M3. Comments on the screenshots are welcome any time |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Confirm or change |

## Earlier decisions (still in force)

- Atomic weights stay with NIST AWIC; the values IUPAC has revised since are listed in `tools/build-report.md`.
- *hfs n/m* also covers "not yet in our curated table".
- The long form keeps the spec's La/Ac arrangement (open question from M1, default kept).

## Known issues and housekeeping

- Firefox, Safari/WebKit and iPhone run in the nightly job only (this environment can run Chromium only).
- ESLint 9 (a developer tool) is past end of life; the accessibility lint plugin still needs it.
