# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""NIST Atomic Weights and Isotopic Compositions (source id `nist_awic`).

Linearized ASCII output for all elements and all isotopes. M0 uses the standard atomic
weights; the per-isotope masses and compositions are parsed for M2's isotope files.
"""

from __future__ import annotations

import html
import re

from common import http_get, raw_path

SOURCE = "nist_awic"
URL = "https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=&ascii=ascii2&isotype=all"
FILE = "awic_all.txt"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)


def parse() -> dict[int, dict]:
    """{Z: {standard: str | None, isotopes: [{A, symbol, mass, composition}]}}.

    `standard` is the raw text: '55.845(2)', '[1.00784,1.00811]' (interval), '[98]'
    (mass number of a key isotope, no standard weight) or None.
    """
    text = html.unescape(raw_path(SOURCE, FILE).read_text(encoding="latin-1"))
    text = re.sub(r"<[^>]+>", "", text).replace(" ", " ")
    out: dict[int, dict] = {}
    for block in text.split("Atomic Number = ")[1:]:
        fields = {"Atomic Number": block.split("\n", 1)[0].strip()}
        for line in block.splitlines()[1:]:
            key, sep, value = line.partition(" = ")
            if sep:
                fields[key.strip()] = value.strip()
        z = int(fields["Atomic Number"])
        entry = out.setdefault(z, {"standard": None, "isotopes": []})
        std = fields.get("Standard Atomic Weight", "").strip()
        if std:
            entry["standard"] = std
        entry["isotopes"].append(
            {
                "A": int(fields["Mass Number"]),
                "symbol": fields.get("Atomic Symbol", ""),
                "mass": fields.get("Relative Atomic Mass", ""),
                "composition": fields.get("Isotopic Composition", ""),
            }
        )
    return out
