# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""CODATA 2022 fundamental constants, NIST ASCII table (source id `nist_codata`)."""

from __future__ import annotations

from decimal import Decimal

from common import http_get, raw_path

SOURCE = "nist_codata"
URL = "https://physics.nist.gov/cuu/Constants/Table/allascii.txt"
FILE = "allascii.txt"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)


def parse() -> dict[str, dict]:
    """{name: {value: Decimal, unc: Decimal | None (None = exact), unit, text}}."""
    lines = raw_path(SOURCE, FILE).read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("-----")) + 1
    out: dict[str, dict] = {}
    for line in lines[start:]:
        if not line.strip():
            continue
        name = line[:60].strip()
        value_txt = line[60:85].strip()
        unc_txt = line[85:110].strip()
        unit = line[110:].strip()
        value = Decimal(value_txt.replace(" ", "").replace("...", ""))
        unc = None if unc_txt == "(exact)" else Decimal(unc_txt.replace(" ", ""))
        out[name] = {"value": value, "unc": unc, "unit": unit, "text": value_txt}
    return out


def ev_to_kj_per_mol(constants: dict[str, dict]) -> Decimal:
    """1 eV in kJ/mol = e · N_A / 1000, exact since the 2019 SI (both constants are defining)."""
    e = constants["elementary charge"]
    na = constants["Avogadro constant"]
    if e["unc"] is not None or na["unc"] is not None:
        raise ValueError("e and N_A are expected to be exact (SI 2019)")
    return e["value"] * na["value"] / 1000
