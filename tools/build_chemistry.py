# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""The `chemistry` section of public/data/elements/{Z}.json (SPEC §10.9).

It comes from two curated tables: tools/curated/chemistry.toml (how the element bonds, its reactions
with air, water and acids in our own words, well-known compounds, one example per common oxidation
state) and tools/curated/ionic_radii.toml (Shannon 1976). The PubChem records cached by
fetch_pubchem_hsdb are used to check them:

- a compound or example that cites `pubchem_compounds` must have PubChem's formula (element counts;
  PubChem writes Hill order); one that does not is left out and reported;
- a reactivity note that cites `hsdb` or `cameo_chemicals` must have a record of that contributor
  behind it, or the build reports it.

Without the PubChem cache nothing is checked and the build says so once.
"""

from __future__ import annotations

import weakref
from functools import cache

import curated
import fetch_pubchem_hsdb
from common import Report, missing, quantity

SECTION = "Chemistry (SPEC §10.9)"
REACTIVITY = ("air", "water", "acids")
# which part of the cached PubChem record backs a note citing this source
CONTRIBUTOR = {"hsdb": "hsdb", "cameo_chemicals": "cameo"}
_ROMAN = {"I": 1, "V": 5, "X": 10}
# sources already reported as unavailable, per report
_told: weakref.WeakKeyDictionary[Report, set[str]] = weakref.WeakKeyDictionary()


def roman(text: str) -> int:
    """'VIII' → 8; Shannon's suffixes (IVSQ square planar, IIIPY pyramidal) are ignored."""
    letters = text.rstrip("SQPY")
    total = 0
    for i, ch in enumerate(letters):
        v = _ROMAN[ch]
        total += -v if i + 1 < len(letters) and _ROMAN[letters[i + 1]] > v else v
    return total


@cache
def tables() -> tuple[dict[int, dict], dict[int, list[dict]], dict]:
    rows = {r["Z"]: r for r in curated.load("chemistry.toml")}
    radii: dict[int, list[dict]] = {}
    for r in curated.load("ionic_radii.toml"):
        radii.setdefault(r["Z"], []).append(r)
    return rows, radii, fetch_pubchem_hsdb.parse()


def _once(report: Report, source: str, text: str) -> None:
    told = _told.setdefault(report, set())
    if source not in told:
        told.add(source)
        report.unavailable(source, text)


def _check_source(z: int, item: dict) -> None:
    reg = curated.registry()
    if item["source"] not in reg:
        raise ValueError(f"chemistry.toml Z = {z}: unknown source {item['source']!r} in {item}")
    if item["source"] == "primary_literature" and not item.get("doi"):
        raise ValueError(f"chemistry.toml Z = {z}: primary_literature without a DOI: {item}")


def compound(z: int, item: dict, pubchem: dict, report: Report) -> dict | None:
    """One compound or oxidation example; None when PubChem's formula contradicts ours."""
    _check_source(z, item)
    out = {k: item[k] for k in ("state", "formula", "name", "note", "source", "doi") if k in item}
    if item["source"] != fetch_pubchem_hsdb.COMPOUNDS:
        return out
    if not pubchem["compounds"]:
        _once(report, fetch_pubchem_hsdb.COMPOUNDS, "no cached PubChem compound records; formulas not checked")
        return out
    key = item.get("lookup", item["name"])
    rec = pubchem["compounds"].get(key)
    if rec is None:
        report.add(SECTION, f"Z = {z}: PubChem has no compound named {key!r}; {item['formula']} not checked")
        return out
    if not fetch_pubchem_hsdb.same_formula(item["formula"], rec["formula"]):
        report.add(
            SECTION,
            f"Z = {z}: left out {item['formula']} ({item['name']}): PubChem CID {rec['cid']} has {rec['formula']}",
        )
        return None
    return out | {"cid": rec["cid"]}


def reactivity(z: int, row: dict, element: dict | None, report: Report) -> dict:
    out: dict = {}
    for key in REACTIVITY:
        if row.get(key):
            src = row[f"{key}_source"]
            out[key] = {
                "text": row[key],
                "source": src,
                **({"doi": row[f"{key}_doi"]} if row.get(f"{key}_doi") else {}),
            }
            part = CONTRIBUTOR.get(src)
            if part and element is not None and not element[part]:
                report.add(SECTION, f"Z = {z}: the {key} note cites {src}, but the cached PubChem record has none")
        elif row.get(f"{key}_missing"):
            out[key] = missing(row[f"{key}_missing"], row.get(f"{key}_note"))
        elif row.get("reactivity_missing"):
            out[key] = missing(row["reactivity_missing"], row.get("reactivity_note"))
        else:
            raise ValueError(f"chemistry.toml Z = {z}: no {key} note and no Missing reason")
    return out


def ionic_radius(r: dict) -> dict:
    out: dict = {"charge": r["charge"], "coordination": r["coordination"]}
    if r.get("spin"):
        out["spin"] = r["spin"]
    out["radius"] = quantity(r["radius_pm"], "pm", r["source"])
    if r.get("most_reliable"):
        out["mostReliable"] = True
    return out


def record(z: int, report: Report) -> dict:
    rows, radii, pubchem = tables()
    row = rows.get(z)
    if row is None:
        raise ValueError(f"chemistry.toml has no row for Z = {z}")
    element = pubchem["elements"].get(z)
    if not pubchem["elements"]:
        _once(report, fetch_pubchem_hsdb.SOURCE, "no cached PubChem element records; reactivity sources not checked")
    out: dict = {}
    if row.get("bonding"):
        out["bonding"] = {"type": row["bonding"], **({"note": row["bonding_note"]} if row.get("bonding_note") else {})}
        out["bonding"]["source"] = row["bonding_source"]
    else:
        out["bonding"] = missing(row["bonding_missing"], row.get("bonding_note"))
    out["reactivity"] = reactivity(z, row, element, report)
    compounds = [c for c in (compound(z, i, pubchem, report) for i in row.get("compounds", [])) if c]
    if not compounds and not row.get("compounds_missing"):
        raise ValueError(f"chemistry.toml Z = {z}: no compounds and no compounds_missing reason")
    out["compounds"] = compounds or missing(row["compounds_missing"], row.get("compounds_note"))
    examples = [c for c in (compound(z, i, pubchem, report) for i in row.get("oxidation_examples", [])) if c]
    out["oxidationExamples"] = sorted(examples, key=lambda c: -c["state"])
    if row.get("oxidation_note"):
        out["oxidationNote"] = row["oxidation_note"]
    out["ionicRadii"] = [
        ionic_radius(r)
        for r in sorted(radii.get(z, []), key=lambda r: (r["charge"], roman(r["coordination"]), r.get("spin", "")))
    ]
    if element is not None:
        out["pubchemCid"] = element["cid"]
    if row.get("note_source"):
        out["sources"] = [row["note_source"]]
    return out
