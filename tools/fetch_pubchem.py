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
            # Units as published for the PubChem periodic table: eV, pm, K, K, g/cm³.
            "electronAffinity": cell["ElectronAffinity"],
            "radiusVdw": cell["AtomicRadius"],  # Los Alamos's van der Waals radius (see the element pages)
            "meltingPoint": cell["MeltingPoint"],
            "boilingPoint": cell["BoilingPoint"],
            "density": cell["Density"],
        }
    for z in range(1, NUM_ELEMENTS + 1):
        page = raw_path(SOURCE, f"element_{z:03d}.json")
        record = json.loads(page.read_text(encoding="utf-8"))["Record"]
        ox = _strings(record, "Oxidation States")
        out[z]["oxidationJefferson"] = ox.get(JEFFERSON)
        out[z]["oxidationLANL"] = ox.get(LANL)
        out[z]["radiusCovalent"] = next((t for t in _strings_all(record, "Atomic Radius") if "(Covalent)" in t), None)
    return out


def _strings_all(record: dict, heading: str) -> list[str]:
    """Every value under a heading, numbers included ('25 pm (Empirical)')."""
    out = []
    for sec in record.get("Section", []):
        found = _find(sec, heading)
        if not found:
            continue
        for info in found.get("Information", []):
            value = info.get("Value", {})
            texts = [s.get("String", "") for s in value.get("StringWithMarkup", [])]
            if texts:
                out.append(" ".join(texts))
            elif "Number" in value:
                out.append(f"{value['Number'][0]} {value.get('Unit', '')}".strip())
    return out


_COVALENT = re.compile(r"(\d+(?:\.\d+)?)(?:\((\d+)\))?(?:\[([^\]]+)\])?")


def covalent_radius(text: str) -> tuple[float, float | None, str | None, str]:
    """'132(3)[l.s.], 152(6)[h.s.] pm (Covalent)' → (132.0, 3.0, 'l.s.', '152(6)[h.s.]').

    The first value is used; any further values are returned verbatim for the note.
    """
    body = text.split("pm")[0]
    parts = [p.strip() for p in body.split(",") if p.strip()]
    m = _COVALENT.fullmatch(parts[0])
    if not m:
        raise ValueError(f"unrecognised covalent radius {text!r}")
    value = float(m.group(1))
    unc = float(m.group(2)) if m.group(2) else None
    return value, unc, m.group(3), ", ".join(parts[1:])


ABUNDANCE_HEADINGS = {"crust": "Estimated Crustal Abundance", "ocean": "Estimated Oceanic Abundance"}
_SUPERSCRIPT = str.maketrans("0123456789-−", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁻")
ABUNDANCE_UNITS = {"milligrams per kilogram": "mg/kg", "milligrams per liter": "mg/L"}


def _superscripted(swm: dict) -> str:
    """Re-insert the exponent markers PubChem keeps as markup: '5.63×104' + superscript → '5.63e4'."""
    text = swm.get("String", "")
    for mk in sorted(swm.get("Markup", []), key=lambda m: -m.get("Start", 0)):
        if mk.get("Type") == "Superscript":
            a, b = mk["Start"], mk["Start"] + mk["Length"]
            text = text[:a] + "^" + text[a:b] + "^" + text[b:]
    return text


def parse_abundance() -> dict[int, dict[str, dict]]:
    """{Z: {"crust": {value, unit, text}, "ocean": {...}}} from Jefferson Lab's estimates on the
    PubChem element pages (mg/kg in the crust, mg/L in sea water); 'Not Applicable' is skipped."""
    out: dict[int, dict[str, dict]] = {}
    for z in range(1, NUM_ELEMENTS + 1):
        record = json.loads(raw_path(SOURCE, f"element_{z:03d}.json").read_text(encoding="utf-8"))["Record"]
        refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in record.get("Reference", [])}
        for key, heading in ABUNDANCE_HEADINGS.items():
            for sec in record.get("Section", []):
                found = _find(sec, heading)
                if not found:
                    continue
                for info in found.get("Information", []):
                    if refs.get(info.get("ReferenceNumber")) != JEFFERSON:
                        continue
                    for swm in info.get("Value", {}).get("StringWithMarkup", []):
                        text = _superscripted(swm)
                        m = re.match(r"^\s*([\d.]+)(?:×10\^(−?-?\d+)\^)?\s+(milligrams per (?:kilogram|liter))", text)
                        if not m:
                            continue
                        exp = int(m.group(2).replace("−", "-")) if m.group(2) else 0
                        value = float(m.group(1)) * 10**exp
                        shown = re.sub(r"\^([^^]*)\^", lambda g: g.group(1).translate(_SUPERSCRIPT), text)
                        out.setdefault(z, {})[key] = {
                            "value": value,
                            "unit": ABUNDANCE_UNITS[m.group(3)],
                            "text": shown,
                        }
    return out
