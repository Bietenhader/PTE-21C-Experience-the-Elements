# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""IAEA LiveChart of Nuclides, ground states of all nuclides (source id `iaea_livechart`).

M0 needs three things per element: which isotopes occur naturally (and how abundantly),
their nuclear spins I, and the longest-lived isotope. The full per-isotope records
(decay modes, moments, binding energies) are used from M2 on.
"""

from __future__ import annotations

import csv
import re

from common import http_get, raw_path

SOURCE = "iaea_livechart"
URL = "https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all"
FILE = "ground_states.csv"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)


def parse_spin(jp: str) -> float | None:
    """'7/2+' → 3.5, '(6)+' → 6.0, '0+' → 0.0; '' → None. Tentative (bracketed) spins count."""
    m = re.search(r"(\d+)(?:/(\d+))?", jp)
    if not m:
        return None
    return int(m.group(1)) / int(m.group(2) or 1)


def _float(s: str) -> float | None:
    try:
        return float(s)
    except ValueError:
        return None


def parse() -> dict[int, list[dict]]:
    """{Z: [{A, N, abundance (%), jp, I, stable, halfLifeS}]}; Z = 0 (the neutron) skipped."""
    out: dict[int, list[dict]] = {}
    with raw_path(SOURCE, FILE).open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            z = int(row["z"])
            if z == 0:
                continue
            n = int(row["n"])
            out.setdefault(z, []).append(
                {
                    "A": z + n,
                    "N": n,
                    "abundance": _float(row["abundance"]),
                    "jp": row["jp"],
                    "I": parse_spin(row["jp"]),
                    "stable": row["half_life"].strip().upper() == "STABLE",
                    "halfLifeS": _float(row["half_life_sec"]),
                    "halfLifeText": " ".join(x for x in (row["operator_hl"], row["half_life"], row["unit_hl"]) if x),
                }
            )
    return out
