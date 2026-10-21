<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M1 — Table interaction · **built; pull request open, waiting for Fin's review**
**Last updated:** 2026-10-21
**Next:** M2 (data complete for v0.1), after Fin merges M1.

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at

1. **The 30-second recording** of the layouts morphing, at the top of the pull request (also
   `docs/media/m1-morph.mp4`), and the screenshots below it.
2. **Merge when you are happy** (green "Merge pull request" button on the pull request page). The live site,
   https://bietenhader.github.io/PTE-21C-Experience-the-Elements/, updates by itself about two minutes later,
   and you can try everything there — on your computer and on your phone. Anything you do not like after
   merging, tell me and I fix it; merging does not lock anything in.
3. **Things worth trying on the live site:** switch the four layouts; choose a trend (try *First ionization
   energy* as arrows, then as a heatmap); type `ionization > 1000` in the search box; hover a tile, then click
   it; on the phone, pinch the table, press and hold a tile, tap a tile and swipe between the panels.
4. **One question for you** (below, "Open question"). The default is in place, so nothing waits on it.

## M1 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| Layout morphing across all four layouts | Done — FLIP morph, 600 ms, 8 ms stagger by Z, labels cross-fade; instant with reduced motion |
| Group-3 toggle | Done — moves exactly La, Lu, Ac, Lr in the standard form; in the long form La↔Lu and Ac↔Lr change places between group 3 and the block (see the open question) |
| Trends: all arrows, ≥ 10 heatmaps, ≥ 6 maps | Done — 11 arrow trends, 12 heatmaps (each also as a chart and a table), 8 maps |
| Search | Done — names, symbols, Z, groups of elements and comparisons such as `ionization > 1000` |
| Hover card (with placeholders) | Done — on hover, keyboard focus and long-press; an honest photo placeholder until M2 |
| Pan/zoom | Done — pinch, trackpad, Ctrl/⌘ + scroll, double-tap, zoom buttons |
| Mobile sheet shell | Done — bottom sheet on phones, modal on desktops; eleven swipeable panels (placeholders until M3/M4) |
| Routing, settings, keyboard navigation | Done |
| §13.3 tests for hover, layout, group 3, trends, mobile, routing pass | Done on Chromium, desktop and Android phone: 71 end-to-end tests pass. Firefox, Safari/WebKit and iPhone run in the new nightly job (not installable in this environment; first results after the merge) |
| axe clean | Done — no critical or serious findings on the table (plain, every overlay kind, during a search), the settings dialog, and the sheet for Fe, Cs, U and Og |
| Lighthouse budgets met | Done — mobile score 95–96 (budget ≥ 90), initial JavaScript 103 kB (≤ 300 kB), `index.json` 20 kB (≤ 150 kB), first table paint 1.23 s with phone throttling applied (< 1.5 s). Checked by a new CI job |
| 30-second screen recording of the morph in the PR | Done (`docs/media/m1-morph.mp4`, animated preview `m1-morph.webp`) |

Also: 151 unit tests and 84 pipeline tests pass; lint, type checks and the licence audit are clean.

## Fin's feedback on the PR (2026-10-21)

- "Infos appear when zooming in — makes it explorative; maybe a small hint." Added: a one-line tip next to the
  zoom buttons ("Tip: zoom in to see more of every element…", worded for a phone or a computer). It goes away
  by itself once you have zoomed, or with its ×, and stays away on later visits.

## What changed this session

- **Data for the trends:** `index.json` gained electron affinity, covalent and van der Waals radii, melting
  and boiling points, density, year of discovery (PubChem), number of stable isotopes and longest half-life
  (IAEA) — each with its source or a reasoned *Missing*. `trends.json` holds the arrow trends (causes and
  exceptions in our own words), the heatmaps and the maps; the pipeline checks the arrow claims the data
  can test (e.g. the ionization-energy dips at B, O, Al, S).
- **The interactive table:** layouts and morph, group 3, zoom, trends, search, hover card, the sheet frame
  with eleven placeholder panels, settings, links for every view, keyboard navigation and shortcuts.
- **Speed:** the table is now drawn into the page at build time, so phones see it before any script has run;
  the app then takes it over without redrawing it.
- **Checks:** new unit and end-to-end tests, the Lighthouse budget job, and a nightly run on all browsers.
- **Docs:** `docs/approach.md` (every M1 decision), `design.md`, `layouts.md`, README, CHANGELOG.

## Open question for Fin

**Long form with La and Ac in group 3.** The spec says the long form keeps its inline block 14 cells wide
with the group-3 column to its right, and that the toggle swaps La↔Lu (and Ac↔Lr) "between the group-3
column and the block" while Ce–Yb shift one column. That is what is built — but it means that with La/Ac in
group 3, lanthanum stands to the *right* of lutetium, out of atomic-number order. Many printed 32-column
tables instead move the whole group-3 column (Sc, Y, La, Ac) to the *left* of the block, which keeps the order
but means the toggle moves Sc and Y rather than La and Lu. **Default:** keep the spec's version (the caption
now describes it truthfully). Say the word if you prefer the other; it is a small change to
`tools/build_layouts.py` and its tests.

## FIN items — defaults in use (SPEC §19)

| Item | Default in use | What you need to do |
|---|---|---|
| F1 Attribution name | "Bietenhader (Fin)" (README, footer, package) | Confirm or change before M5 |
| F2 GitHub Pages | Source "GitHub Actions" | Done (2026-10-20) |
| F3 Review `biology.toml` and the image report | — | Later: M2 (images) and M4 (biology) |
| F4 Design review | — | End of M3. Comments on the screenshots are welcome any time |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Confirm or change |

## Decisions made — Fin, 2026-10-20: "use the defaults"

1. **Atomic weights stay with NIST AWIC**, as the spec says; the 22 values IUPAC has revised since keep being
   listed in `tools/build-report.md`.
2. **Elements 109–118 keep today's honest handling** (predicted configuration marked †, `Missing` for IE₁ and
   the ground term). At M2 I bring a concrete proposal for the SPEC §13.1 targets that NIST alone cannot meet.
3. **The spec's wording stays:** *hfs n/m* also covers "not yet in our curated table" until M2.

## Notes (things that differ from what you might expect)

4. **A slip from M0, fixed:** M0 used IAEA data (mass numbers, nuclear spins) but the sources list still marked
   IAEA "not yet used". Now that numbers on screen cite it, it is marked as used.
5. **Arrows point the way a property grows.** For ionization energy the down-a-group arrow therefore points
   *up*, labelled "decreases down a group" as in the spec's table; the legend says so.
6. **"laser-cooled" and "clock" in the search** answer "no data yet" — that data arrives with the AMO tables
   in M2. The search says so rather than finding nothing silently.
7. **Shortcuts can be switched off.** `/`, `L` and `T` work as the spec says; accessibility rules (WCAG 2.1.4)
   require that single-key shortcuts can be turned off, so Settings has a switch.
8. **Helium's melting point shows 0.95 K** — PubChem's value, which needs pressure (helium does not freeze at
   normal pressure). PubChem gives no note; the curated physical data in M2 will add one.
9. **Elements without a value are hatched** on every heatmap and say why (e.g. *n/m*, *pred. only*), never 0 or
   a blank.
10. **On a phone the standard table is a little wider than the screen** at the smallest tile size (24 px, the
    accessibility minimum); swipe sideways or pinch.

## Known issues and housekeeping

- Firefox, Safari/WebKit and iPhone have not been tested yet — this environment can only run Chromium. The
  nightly job covers them from the first night after the merge; any failure there becomes my first task.
- Swipe, pinch and long-press are tested with real touch events on Chromium only (WebKit has no way to
  script them); on iPhone they rely on the same code paths, plus Safari's own gesture events for pinch.
- ESLint 9 (a developer tool) is past end of life, but the accessibility lint plugin still does not support
  ESLint 10. Harmless for the app; revisited each milestone.
- Lighthouse scores vary by a few points between machines; the CI job's numbers are in its log and report.
