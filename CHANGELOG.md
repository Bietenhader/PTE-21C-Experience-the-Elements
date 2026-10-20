<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Changelog

All notable changes. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — milestone M0 (skeleton)

- Data pipeline (`tools/`): fetchers for PubChem, NIST ASD ionization energies, NIST AWIC, IAEA LiveChart,
  CODATA 2022 and IUPAC CIAAW; `build.py` producing `public/data/index.json` and `sources.json`;
  `build_layouts.py` producing the four layouts; `report.py` producing PROVENANCE.md and CREDITS.md.
- JSON Schema for every data file, with TypeScript types generated from it.
- The standard 18-column table with all 118 elements; tiles carrying the reference table's fields and the
  ground-state hyperfine slot; legend, block map, tile key.
- Tests: pipeline (schema, provenance, coverage, golden values, layouts), unit (formatting, Madelung, units,
  palette contrast, tile text) and end-to-end (fields, zero third-party requests, axe, keyboard order).
- CI, GitHub Pages deployment, the `PTE-21C.command` launcher and `tools/pipeline.command`.
