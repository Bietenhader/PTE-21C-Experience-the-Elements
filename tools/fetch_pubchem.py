# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""PubChem periodic table and element pages (source id `pubchem`).

The periodic-table JSON gives names, Pauling electronegativity, standard state, group block
and (cross-check only) configurations. The per-element pages add two oxidation-state lists:
Jefferson Lab's short list of main states and Los Alamos National Laboratory's full list.
"""

from __future__ import annotations

import json
import re

from common import NUM_ELEMENTS, http_get, raw_path

SOURCE = "pubchem"
TABLE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON"
PAGE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/{z}/JSON"

JEFFERSON = "Jefferson Lab, U.S. Department of Energy"
LANL = "Los Alamos National Laboratory, U.S. Department of Energy"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, TABLE_URL, "periodictable.json", refresh=refresh)
    for z in range(1, NUM_ELEMENTS + 1):
        http_get(SOURCE, PAGE_URL.format(z=z), f"element_{z:03d}.json", refresh=refresh)


def _find(section: dict, heading: str) -> dict | None:
    if section.get("TOCHeading") == heading:
        return section
    for sub in section.get("Section", []):
        if found := _find(sub, heading):
            return found
    return None


def _strings(record: dict, heading: str) -> dict[str, str]:
    """{contributor name: text} for one heading of an element page."""
    refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in record.get("Reference", [])}
    out: dict[str, str] = {}
    for sec in record.get("Section", []):
        found = _find(sec, heading)
        if not found:
            continue
        for info in found.get("Information", []):
            texts = [s.get("String", "") for s in info.get("Value", {}).get("StringWithMarkup", [])]
            if texts:
                out[refs.get(info.get("ReferenceNumber"), "?")] = " ".join(texts)
    return out


_STATE = re.compile(r"[+\-−]?\d+")


def oxidation_list(text: str) -> tuple[list[int], bool]:
    """'-4, -2, +1,+2 (an amphoteric oxide)' → ([-4, -2, 1, 2], predicted=False)."""
    predicted = "predicted" in text.lower()
    # Only the leading list of numbers; anything after the first word is commentary.
    lead = re.match(r"[\s\d,+\-−​]*", text).group(0)
    states = sorted({int(s.replace("−", "-")) for s in _STATE.findall(lead)}, reverse=True)
    return states, predicted


def parse() -> dict[int, dict]:
    table = json.loads(raw_path(SOURCE, "periodictable.json").read_text(encoding="utf-8"))["Table"]
    cols = table["Columns"]["Column"]
    out: dict[int, dict] = {}
    for row in table["Row"]:
        cell = dict(zip(cols, row["Cell"], strict=True))
        z = int(cell["AtomicNumber"])
        out[z] = {
            "symbol": cell["Symbol"],
            "name": cell["Name"],
            "electronegativity": cell["Electronegativity"],
            "standardState": cell["StandardState"],
            "groupBlock": cell["GroupBlock"],
            "configuration": cell["ElectronConfiguration"],
            "yearDiscovered": cell["YearDiscovered"],
        }
    for z in range(1, NUM_ELEMENTS + 1):
        page = raw_path(SOURCE, f"element_{z:03d}.json")
        record = json.loads(page.read_text(encoding="utf-8"))["Record"]
        ox = _strings(record, "Oxidation States")
        out[z]["oxidationJefferson"] = ox.get(JEFFERSON)
        out[z]["oxidationLANL"] = ox.get(LANL)
    return out
