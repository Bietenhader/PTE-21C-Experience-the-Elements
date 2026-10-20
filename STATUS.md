<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# STATUS

**Current milestone:** M0 — Skeleton · **built; pull request "M0 — skeleton" open for Fin's review**
**Last updated:** 2026-10-20
**Next:** M1 (table interaction) starts only after Fin has reviewed and merged M0.

This file is updated at the end of every working session (SPEC §17.5).

---

## For Fin: what to look at, in order

1. **The pull request "M0 — skeleton"** on GitHub. It has screenshots of the table on a desktop and a phone,
   and a plain-language summary. If you are happy, press **Merge pull request**.
2. **Switch on the website (one time only — item F2).** After merging: on the repository page click
   **Settings** → **Pages** (left column) → under *Build and deployment*, set **Source** to
   **GitHub Actions**. A few minutes later the table is live at
   **https://bietenhader.github.io/PTE-21C-Experience-the-Elements/**.
3. **Try the launcher on your Mac.** In the project folder, right-click **`PTE-21C.command`** → **Open** →
   **Open** (macOS asks only the first time). The table opens in your browser. It needs Node.js 22 once
   (`brew install node@22`); the launcher tells you if it is missing.
4. **Read the questions below** ("Decisions I need from you"). Each has a default, so nothing is blocked.

## M0 acceptance criteria (SPEC §18)

| Criterion | State |
|---|---|
| Repo files from §4.2 | Done for everything M0 uses. Folders whose content belongs to later milestones (hover card, sheet, panels, images, isotope/spectra files, trends) are created when that content exists. |
| Vite/React/TS app renders 118 tiles in `standard18` | Done |
| … from `index.json` built by the PubChem, NIST GSIE and NIST AWIC fetchers + `build_layouts.py` | Done, plus three more fetchers M0 needed (IAEA, CODATA, CIAAW — see note 7) |
| Schema + sources registry | Done (`schema/`, `tools/sources.toml` → `public/data/sources.json`) |
| Every tile shows weight or (mass number), Z, IE₁, EN, oxidation states, symbol, name, configuration with ◆ | Done — all fields on full-size tiles; smaller tiles show fewer, as SPEC §7.1 prescribes |
| Hyperfine slot renders `Missing` correctly | Done: 1 value (Cs-133), 24 *not applicable* (J = 0 or I = 0), 34 *no stable isotope*, 59 *not yet in the curated table* (note 3) |
| Schema and coverage tests pass | Done: 74 pipeline tests, 80 unit tests, 14 end-to-end tests pass locally |
| CI green | Runs on the pull request — see the checks there |
| Site live on Pages | Needs the merge and the one-time Pages switch (step 2 above) |
| `PTE-21C.command` works | Tested from a fresh copy (installs, starts, serves the table). Tested on Linux, not on a Mac — please try step 3 |

## What changed this session

- **Data pipeline** in `tools/`: six fetchers (PubChem, NIST ASD ionization energies, NIST AWIC, IAEA
  LiveChart, CODATA 2022, IUPAC CIAAW), the build, the four layouts, the reports. Every source was reachable
  from the cloud environment; nothing is marked `source_unavailable_at_build`. Raw data retrieved 2026-10-20.
- **Data** in `public/data/`: `index.json` (118 elements, 13.6 kB compressed), `sources.json`, four layouts.
  `tools/build-report.md` lists every disagreement between sources and every rule the build applied.
- **The app**: the standard 18-column table, tiles with the reference table's fields and the hyperfine slot,
  legend, block map, a "how to read a tile" key, dark theme, self-hosted fonts, a Compact / Full-size switch.
- **Checks**: tests for schema, provenance, coverage, golden values and layouts; unit tests; end-to-end tests
  including "no request leaves the site" and an accessibility scan (axe); a licence audit of dependencies.
- **CI and deployment** workflows, the two launchers, README, NOTICE, CONTRIBUTING, CHANGELOG and five docs.
  All decisions marked IMPLEMENTER'S CHOICE are recorded in `docs/approach.md`.

## FIN items — defaults in use (SPEC §19)

| Item | Default in use | What you need to do |
|---|---|---|
| F1 Attribution name | "Bietenhader (Fin)" (README, footer, package) | Confirm or change before M5 |
| F2 GitHub Pages | — | **Step 2 above, once** |
| F3 Review `biology.toml` and the image report | — | Later: M2 (images) and M4 (biology) |
| F4 Design review | — | End of M3. Comments on the screenshots are welcome any time |
| F5 Subtitle | "A fresh perspective on the Periodic Table of the Elements" | Confirm or change |

## Decisions I need from you (each has a default; nothing is blocked)

1. **Atomic weights: NIST or IUPAC directly?** The spec takes standard atomic weights from NIST AWIC. NIST's
   table is IUPAC's **2013** edition; IUPAC (CIAAW) has since revised 22 values — argon and lead are now ranges,
   and gadolinium, lutetium, zirconium and ytterbium shifted. *Default:* keep NIST as the spec says and list the
   differences in `tools/build-report.md`. *Proposal:* from M2, take atomic weights from IUPAC/CIAAW directly
   and keep NIST for isotope masses.
2. **Elements 109–118 have no NIST data.** NIST's database stops at hassium (108). The spec's M2 targets
   ("ground term for all 118", "IE₁ for ≥ 110") cannot be met from NIST alone. Today those elements show
   their *predicted* configuration (marked †) and "pred. only" for IE₁ and the ground term. *Proposal for M2:*
   a curated table of published theoretical values (with references), clearly flagged as predictions.
3. **"hfs n/m" says "not measured" too broadly.** The spec defines `not_measured` to include "measured, but
   not yet in our curated table". So in M0, 59 elements — hydrogen included, whose 21-cm line is famous —
   show *hfs n/m*; the hover text says "not yet in the curated table (compiled in M2)". The curated table is
   filled in M2. *Option:* add a separate reason "not yet compiled" so the tile never says *n/m* for a
   measured value. *Default:* follow the spec.

## Notes (things that differ from what you might expect)

4. **Technetium shows (97), not the familiar (98).** The spec takes the mass number of the longest-lived
   isotope from IAEA, and IAEA gives Tc-97 4.21 million years against Tc-98's 4.2 million. Both values are
   uncertain; the tile follows the rule and the hover text explains.
5. **Hydrogen's ionization energy is in parentheses, (1312).** NIST marks its hydrogen value as theoretical,
   and the tile keeps NIST's markers: ( ) theoretical, [ ] semi-empirical.
6. **On a phone, compact tiles scroll sideways a little.** Accessibility rules (WCAG 2.2) require touch
   targets of at least 24 × 24 px, which is wider than 1/18 of a phone screen. Pinch-zoom in M1 makes this
   smooth.
7. **More sources than the M0 list.** IAEA (mass numbers, spins), CODATA (exact eV ↔ kJ/mol), IUPAC CIAAW (one
   display value for elements whose weight is a range), the SI Brochure (caesium's exact value) and the IUPAC
   Red Book (spellings *aluminium*, *caesium*). Reasons in `docs/approach.md`.
8. **Tile names for screen readers** include the symbol: "Caesium (Cs), atomic number 55, alkali metal." —
   so voice-control users can say "click Cs". "Press Enter for details." is added when the sheet exists (M3).
9. **Only caesium has a hyperfine value in M0** — it is exact by the definition of the second. The rest of the
   curated hyperfine table (SPEC §6.2) is compiled and checked against primary papers in M2.

## Known issues and housekeeping

- ESLint 9 (a developer tool) is past end of life, but the accessibility lint plugin does not support
  ESLint 10 yet. Harmless for the app; revisit in M1.
- The full end-to-end browser matrix (Safari/WebKit, Firefox, iPhone) and the nightly job come with M1;
  M0 tests Chromium on a desktop and an Android phone profile.
- Citations of sources not used yet (M2 and later) are recorded as given in the spec; each is checked when
  its data is transcribed.
