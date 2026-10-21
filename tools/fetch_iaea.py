# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""IAEA LiveChart of Nuclides, ground states of all nuclides (source id `iaea_livechart`).

`parse` gives what index.json needs per element: which isotopes occur naturally (and how
abundantly), their nuclear spins I and the longest-lived isotope. `parse_full` gives the whole
record of every ground state for public/data/isotopes/{Z}.json (SPEC §10.7): half-life with its
uncertainty, decay modes with branching, spin-parity, abundance, atomic mass, mass excess,
binding energy per nucleon, magnetic dipole and electric quadrupole moments, charge radius and
discovery year. Empty CSV cells stay absent (the build turns them into Missing).
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


def _num(row: dict, key: str) -> float | None:
    return _float(row.get(key, "").strip())


def parse_full() -> dict[int, list[dict]]:
    """{Z: [full ground-state record, by increasing N]}; the neutron (Z = 0) skipped."""
    out: dict[int, list[dict]] = {}
    with raw_path(SOURCE, FILE).open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            z = int(row["z"])
            if z == 0:
                continue
            n = int(row["n"])
            decays = []
            for i in (1, 2, 3):
                mode = row[f"decay_{i}"].strip()
                if mode:
                    decays.append({"mode": mode, "percent": _num(row, f"decay_{i}_%"), "unc": _num(row, f"unc_{i}")})
            stable = row["half_life"].strip().upper() == "STABLE"
            out.setdefault(z, []).append(
                {
                    "A": z + n,
                    "N": n,
                    "symbol": row["symbol"],
                    "jp": row["jp"].strip(),
                    "I": parse_spin(row["jp"]),
                    "stable": stable,
                    "halfLife": None
                    if stable
                    else {
                        "s": _num(row, "half_life_sec"),
                        "unc": _num(row, "unc_hls"),
                        "operator": row["operator_hl"].strip(),
                        "text": row["half_life"].strip(),
                        "unit": row["unit_hl"].strip(),
                        "uncText": row["unc_hl"].strip(),
                    },
                    "decays": decays,
                    "abundance": _num(row, "abundance"),
                    "abundanceUnc": _num(row, "unc_a"),
                    "massMicroU": row["atomic_mass"].strip(),
                    "massUncMicroU": _num(row, "unc_am"),
                    "massExcessKeV": _num(row, "massexcess"),
                    "massExcessUnc": _num(row, "unc_me"),
                    "massSystematics": row["me_systematics"].strip() == "Y",
                    "bindingKeV": _num(row, "binding"),
                    "bindingUnc": _num(row, "unc_ba"),
                    "mu": _num(row, "magnetic_dipole"),
                    "muUnc": _num(row, "unc_md"),
                    "Q": _num(row, "electric_quadrupole"),
                    "QUnc": _num(row, "unc_eq"),
                    "radius": _num(row, "radius"),
                    "radiusUnc": _num(row, "unc_r"),
                    "discovery": int(row["discovery"]) if row["discovery"].strip().isdigit() else None,
                    "ensdfCutoff": row["ENSDFpublicationcut-off"].strip(),
                }
            )
    for isotopes in out.values():
        isotopes.sort(key=lambda x: x["N"])
    return out
