<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Data sources

The registry of every source — title, URL, licence, citation and retrieval date — is
[`tools/sources.toml`](../tools/sources.toml), published as `public/data/sources.json` and summarised in
[`PROVENANCE.md`](../PROVENANCE.md). Disagreements between sources are listed in
[`tools/build-report.md`](../tools/build-report.md).

## How data gets into the app

1. **Fetch** (`tools/fetch_*.py`, developer machines only). Each fetcher sends a descriptive User-Agent with
   the repository URL, waits between requests to the same host (PubChem and IAEA ½ s, everyone else 1 s),
   retries transient failures, and caches the raw response in `tools/raw/<source>/` (never committed).
2. **Curate** (`tools/curated/*.toml`). Values that no machine-readable source provides are transcribed by
   hand, one row per value, each row naming its source. Rows without a source are rejected by the build.
3. **Build** (`tools/build.py`, `tools/build_layouts.py`). Reads only the cache and the curated files,
   applies the rules in [`approach.md`](approach.md), validates everything against `schema/`, and writes
   `public/data/`.
4. **Report** (`tools/report.py`). Writes `PROVENANCE.md` and `CREDITS.md` and audits licences.

Run all four with `tools/pipeline.command` (or `python tools/pipeline.py --all` then
`python tools/report.py`). CI never fetches: it validates the committed files and runs the tests.

## What M0 uses

| Field | Source |
|---|---|
| Ground configuration, ground term, IE₁ | `nist_gsie` (NIST ASD 5.12) |
| Standard atomic weight | `nist_awic`; single display value for intervals from `ciaaw` |
| Most-stable mass number, natural abundance, nuclear spin, stability | `iaea_livechart` |
| Pauling electronegativity, oxidation states, category, standard state, names | `pubchem` |
| Configurations for Z ≥ 109 (predicted) | `pubchem` (Los Alamos National Laboratory) |
| eV ↔ kJ/mol, physical constants | `nist_codata` (CODATA 2022) |
| Cs-133 ground-state hyperfine splitting | `si_brochure` (exact by definition) |
| IUPAC spellings | `iupac_redbook_2005` |

## When a source is unreachable

The pipeline does not stop. Fields from that source become `Missing{source_unavailable_at_build}`, the run
prints a loud line and lists it in `tools/build-report.md`, and the source's status in `sources.json`
becomes `unavailable`. Run the pipeline again later from a machine that can reach it.
