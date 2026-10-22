# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""PTE-21C data pipeline orchestrator (developer tool; never run in CI).

    python tools/pipeline.py --all        fetch what is not cached, then build data and layouts
    python tools/pipeline.py --all --refresh   re-download every source first
    python tools/pipeline.py --offline    build from the cache in tools/raw/ only

A source that cannot be reached is reported loudly and its fields become
Missing{source_unavailable_at_build}; the run continues (SPEC §6.1, §17.4).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build
import build_details
import build_layouts
import build_trends
import fetch_bipm
import fetch_ciaaw
import fetch_cie
import fetch_codata
import fetch_iaea
import fetch_images
import fetch_nist_awic
import fetch_nist_gsie
import fetch_nist_levels
import fetch_nist_lines
import fetch_nist_srd141
import fetch_pubchem
import fetch_pubchem_hsdb
from common import SourceUnavailable

FETCHERS = [
    fetch_pubchem,
    fetch_pubchem_hsdb,
    fetch_nist_gsie,
    fetch_nist_awic,
    fetch_iaea,
    fetch_codata,
    fetch_ciaaw,
    fetch_nist_levels,
    fetch_nist_lines,
    fetch_nist_srd141,
    fetch_bipm,
    fetch_cie,
    fetch_images,
]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all", action="store_true", help="fetch (if not cached) and build everything")
    ap.add_argument("--refresh", action="store_true", help="re-download sources even if cached")
    ap.add_argument("--offline", action="store_true", help="do not fetch; build from tools/raw/ only")
    args = ap.parse_args(argv)
    if not (args.all or args.offline):
        ap.print_help()
        return 2

    failed = []
    if not args.offline:
        for mod in FETCHERS:
            print(f"fetch {mod.SOURCE} …", flush=True)
            try:
                mod.fetch(refresh=args.refresh)
            except SourceUnavailable as exc:
                failed.append(mod.SOURCE)
                print(f"!!! {exc}", flush=True)
    build.build()
    build_details.build_details()
    build_layouts.build_layouts()
    build_trends.build_trends()
    build.refresh_source_status()
    if failed:
        print(f"\n!!! Unavailable sources: {', '.join(failed)} — see tools/build-report.md and STATUS.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
