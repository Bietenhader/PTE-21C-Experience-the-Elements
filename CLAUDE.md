# CLAUDE.md — PTE-21C · Experience the Elements

You are building a quantum-aware, photographic, swipeable periodic table as a static web app.
**`SPEC.md` is the authoritative source of truth. Read it fully before doing anything.** This file is the short
version you re-read every session.

## Non-negotiables (SPEC §2, §15)

1. No number without a source. Every value is a `Quantity {value, unc?, unit, source}`; `source` must be a key in
   `public/data/sources.json`.
2. Missing data is rendered as `Missing {reason, note}` — never `0`, never a bare dash, never a guess.
3. Approximations are named on screen (hydrogenic orbitals, interpolated IEs, approximate nucleosynthesis).
4. Isotope-resolved wherever nature is isotope-resolved.
5. Measured over conventional: ground configurations and terms from NIST; the Aufbau prediction shown alongside;
   disagreement flagged.
6. Nothing typed into app code: all data comes from `tools/` (fetchers + curated TOML with a source per row).
7. Zero runtime network. Data, images, fonts are vendored. A Playwright test enforces it.
8. Licence: CC BY-NC-SA 4.0 for the project. Ingest only PD / CC0 / CC BY / cited scientific tables; display
   CC BY-SA / FAL / GFDL images unmodified with full credit. **Never** copy Wikipedia prose, Bowserinator's JSON,
   or any all-rights-reserved photo. No GPL/AGPL/LGPL dependencies.
9. Accessible: keyboard-complete, screen-reader labelled, WCAG 2.2 AA, no meaning by colour alone,
   `prefers-reduced-motion` respected.

## Decisions that are LOCKED (do not re-litigate; ask Fin before deviating)

React 19 + TypeScript strict + Vite · @react-three/fiber · D3 · KaTeX · Floating UI · Zustand · CSS Modules · npm ·
Python 3.11 pipeline in `tools/` · GitHub Pages via Actions · hash routing · four layouts (standard18, long32,
janet, adomah) with FLIP morph · group 3 default Lu/Lr · eleven panels in the order of SPEC §10 · Tier A orbitals
in v0.1 · vendored curated images with honest placeholders · `PTE-21C.command` launcher.

## Conventions

- Panels are plugins: `src/panels/<slug>/` exports `{ slug, title, summary, Component, needs }`; one registration line.
- `src/physics/` is pure functions only, each unit-tested; no React imports there.
- Layouts are data (`public/data/layouts/*.json` from `tools/build_layouts.py`); components never compute positions.
- Units stored per field (SPEC §5.2); conversions only in `src/physics/units.ts`.
- Every chart: caption saying what is plotted and from where, plus a "show as table" toggle.
- Fetchers: descriptive `User-Agent` with the repo URL, rate limits respected, raw responses cached in
  `tools/raw/` (gitignored), one failed source never fails the build.
- Source files start with `// SPDX-License-Identifier: CC-BY-NC-SA-4.0` (or `#` for Python).

## Commands

```
npm run dev | build | preview | test | test:e2e | lint | typecheck
python tools/pipeline.py --all      # rebuild public/data and public/img from sources (dev-time only)
python tools/report.py              # PROVENANCE.md, CREDITS.md, licence audit
```

CI never fetches from the internet; it validates the committed data and runs the tests.

## Workflow (SPEC §17.5, §18)

- Milestones M0 → M5. Finish the acceptance criteria of one before starting the next.
- Update `STATUS.md` at the end of every session: what changed, what is blocked, what Fin should look at.
- One PR per milestone with screenshots (desktop + phone). Fin merges.
- `IMPLEMENTER'S CHOICE` items: decide, record the decision in `docs/approach.md`.
- `FIN` items: use the stated default, list the open question in `STATUS.md`.
- If a host in SPEC §17.4 is unreachable from this environment, do not work around it: record
  `source_unavailable_at_build`, note it in `STATUS.md`; Fin runs `tools/pipeline.command` locally.

## Fin

Fin is not a programmer. Explain in plain words what each PR does and what to click; never assume he can read
a stack trace. He is a plant scientist — he reviews `tools/curated/biology.toml` himself.
