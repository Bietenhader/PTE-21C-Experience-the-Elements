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

from common import SourceUnavailable, http_get, raw_path

SOURCE = "iaea_livechart"
URL = "https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all"
FILE = "ground_states.csv"


LEVELS_URL = "https://nds.iaea.org/relnsd/v1/data?fields=levels&nuclides={nuclide}"


def levels_file(z: int, a: int) -> str:
    return f"levels_{z:03d}_{a:03d}.csv"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)
    # The ground-state table attaches to a nuclide the first moment it finds for ANY of its levels
    # (O-16 shows the 6.13 MeV 3- state's moment; Fe-57 shows the 14.4 keV level's quadrupole
    # moment). The level table says which level each moment belongs to, so it is fetched for every
    # nuclide whose ground-state row carries a moment, and only level 0 is used.
    for z, recs in _ground_rows().items():
        for r in recs:
            if r["mu_raw"] or r["q_raw"]:
                try:
                    http_get(
                        SOURCE,
                        LEVELS_URL.format(nuclide=f"{r['A']}{r['symbol'].lower()}"),
                        levels_file(z, r["A"]),
                        refresh=refresh,
                    )
                except SourceUnavailable:
                    pass  # parse_full marks this nuclide's moments unavailable


def _ground_rows() -> dict[int, list[dict]]:
    out: dict[int, list[dict]] = {}
    with raw_path(SOURCE, FILE).open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            z = int(row["z"])
            if z:
                out.setdefault(z, []).append(
                    {
                        "A": z + int(row["n"]),
                        "symbol": row["symbol"],
                        "mu_raw": row["magnetic_dipole"].strip(),
                        "q_raw": row["electric_quadrupole"].strip(),
                    }
                )
    return out


def ground_level_moments(z: int, a: int) -> dict | None:
    """{mu, muUnc, Q, QUnc} of the level at 0 keV from the cached level table, or None if not cached."""
    path = raw_path(SOURCE, levels_file(z, a))
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row.get("idx") == "0" or (row.get("energy", "").strip() == "0" and not row.get("energy_shift")):
                return {
                    "mu": _float(row.get("magnetic_dipole", "")),
                    "muUnc": _float(row.get("unc_mn", "")),
                    "Q": _float(row.get("electric_quadrupole", "")),
                    "QUnc": _float(row.get("unc_eq", "")),
                }
    return {"mu": None, "muUnc": None, "Q": None, "QUnc": None}


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
                    **_moments(z, z + n, row),
                    "radius": _num(row, "radius"),
                    "radiusUnc": _num(row, "unc_r"),
                    "discovery": int(row["discovery"]) if row["discovery"].strip().isdigit() else None,
                    "ensdfCutoff": row["ENSDFpublicationcut-off"].strip(),
                }
            )
    for isotopes in out.values():
        isotopes.sort(key=lambda x: x["N"])
    return out


def _moments(z: int, a: int, row: dict) -> dict:
    """Ground-level moments: from the level table (level 0) when the ground-state row has any."""
    if not (row["magnetic_dipole"].strip() or row["electric_quadrupole"].strip()):
        return {"mu": None, "muUnc": None, "Q": None, "QUnc": None, "momentsUnavailable": False}
    level0 = ground_level_moments(z, a)
    if level0 is None:
        return {"mu": None, "muUnc": None, "Q": None, "QUnc": None, "momentsUnavailable": True}
    return {**level0, "momentsUnavailable": False}
