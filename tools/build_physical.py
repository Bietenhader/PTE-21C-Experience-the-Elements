# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""The physical & engineering panel's own fields (SPEC §10.4), merged into elements/{Z}.json["physical"].

- thermal.molarHeatCapacity — CRC Handbook, 25 °C (tools/curated/thermal.toml);
- uses — two to five bullets in our own words (tools/curated/uses.toml);
- allotropes — the well-known solid forms (tools/curated/allotropes.toml);
- hazards — the GHS classification of the elemental substance, via PubChem (fetch_pubchem_ghs);
- abundanceByMass — the four abundances of doc["physical"]["abundance"] on one scale (mg/kg), for the
  panel's log-scale bars.

Called once per element from build_details.build_elements: doc["physical"] |= record(entry, doc["physical"]).
"""

from __future__ import annotations

from functools import cache

import curated
import fetch_pubchem_ghs
from common import missing, quantity

# Beyond fermium no element has been made in more than a few atoms at a time.
ATOMS_ONLY = 100
SUBSCRIPT = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
# The ICRP Publication 23 reference adult whose element masses tools/curated/abundance.toml lists (its header,
# and every body row's note, say 70 kg; tools/tests/test_physical.py checks that they still do).
REFERENCE_ADULT_KG = 70


@cache
def _tables() -> dict:
    by_z = lambda rows: {z: [r for r in rows if r["Z"] == z] for z in {r["Z"] for r in rows}}  # noqa: E731
    try:
        ghs = fetch_pubchem_ghs.parse()
    except (OSError, ValueError):
        ghs = {}
    return {
        "thermal": {r["Z"]: r for r in curated.load("thermal.toml")},
        "uses": by_z(curated.load("uses.toml")),
        "allotropes": by_z(curated.load("allotropes.toml")),
        "ghs": ghs,
    }


def thermal_record(z: int, row: dict | None) -> dict:
    if row is None:
        note = (
            "Never made in a weighable amount."
            if z >= ATOMS_ONLY
            else "The CRC table of heat capacities at 25 °C used here lists no value for this element."
        )
        return {"molarHeatCapacity": missing("not_measured", note)}
    atoms = row.get("formula_atoms", 1)
    per = f"per mole of {row['formula'].translate(SUBSCRIPT)} molecules" if atoms > 1 else "per mole of atoms"
    out = {
        "molarHeatCapacity": quantity(
            row["molar_heat_capacity"],
            "J/(mol·K)",
            row["source"],
            note=f"At 25 °C and 1 bar, {per}, for the form stable at 25 °C (CRC Handbook, 95th ed.).",
        )
    }
    if atoms > 1:
        out["formulaAtoms"] = atoms
    return out


def uses_record(z: int, rows: list[dict]) -> list[dict]:
    if not rows:
        raise ValueError(f"uses.toml: no uses for Z={z}")
    return [{"text": r["text"], "source": r["source"]} | ({"doi": r["doi"]} if r.get("doi") else {}) for r in rows]


def allotropes_record(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        a = {"name": r["name"], "note": r["note"], "source": r["source"]}
        if r.get("standard"):
            a["standard"] = True
        if r.get("doi"):
            a["doi"] = r["doi"]
        out.append(a)
    return out


def _percent(x: float) -> str:
    return f"{x:g} %"


def hazards_record(entry: dict, found: dict | None) -> dict:
    z, name = entry["Z"], entry["name"]
    if found is None:
        return missing("source_unavailable_at_build", "PubChem's GHS data were not downloaded when the data was built.")
    block = found.get("block")
    if found["status"] == "absent" or block is None:
        if z >= ATOMS_ONLY:
            return missing("not_applicable", "Only a few atoms have ever been made: there is no substance to classify.")
        note = f"PubChem lists no GHS classification for elemental {name.lower()} (CID {found['cid']})."
        if entry.get("radioactive"):
            note += " GHS has no hazard class for radioactivity, which is regulated separately."
        return missing("not_measured", note)
    out: dict = {
        "pictograms": [{"code": c, "name": fetch_pubchem_ghs.PICTOGRAMS[c]} for c in block["pictograms"]],
        "hazardStatements": block["statements"],
        "basis": block["basis"],
        "cid": found["cid"],
        "source": "pubchem_ghs",
    }
    if block["signal"]:
        out["signalWord"] = block["signal"]
    if block["basis"] == "eu_harmonised":
        note = "EU harmonised classification (CLP Regulation (EC) No 1272/2008, Annex VI), via PubChem."
    elif block["basis"] == "echa_notifications":
        reports = block.get("reports")
        if reports:
            out["reports"] = reports
        note = (
            f"Aggregated by PubChem from {reports or 'the'} reports by companies to the ECHA C&L Inventory; "
            "the percentage after a statement is the share of reports that give it."
        )
        not_met = block.get("notMet")
        if not_met:
            out["notMeetingCriteria"] = not_met
            note += (
                f" {_percent(not_met['share'])} of the reports ({not_met['reports']} of {not_met['of']}) say "
                f"{name.lower()} does not meet the GHS hazard criteria."
            )
        elif block["notClassified"] and not block["statements"]:
            note += f" The reports say {name.lower()} does not meet the GHS hazard criteria."
    else:
        note = f"Classification by {block['contributor']}, via PubChem."
    if block["notClassified"] and not block["statements"]:
        out["notClassified"] = True
    if entry.get("radioactive"):
        note += " GHS has no hazard class for radioactivity, which is regulated separately."
    out["note"] = note
    return out


def _ppm(x: float) -> float:
    return float(f"{x:.6g}")


def abundance_by_mass(abundance: dict) -> dict:
    """crust, ocean, solar and body as mg/kg (parts per million by mass); missing values stay missing."""
    out = {}
    for key, factor, how in (
        ("crust", 1.0, "Earth's crust, as given (mg/kg is parts per million by mass)."),
        (
            "ocean",
            1.0,
            "Sea water, mg/L read as mg/kg: a litre of sea water is taken as one kilogram (it is slightly "
            "heavier; the difference cannot be seen on a logarithmic scale).",
        ),
        ("solar", 1e6, "Proto-solar mass fraction × 10⁶."),
        (
            "body",
            1000 / REFERENCE_ADULT_KG,
            f"Grams in the {REFERENCE_ADULT_KG} kg reference adult of ICRP Publication 23, divided by its mass.",
        ),
    ):
        q = abundance[key]
        if q.get("missing"):
            out[key] = q
            continue
        extra = {"doi": q["doi"]} if q.get("doi") else {}
        unc = _ppm(q["unc"] * factor) if q.get("unc") else None
        flag = "estimated" if key == "ocean" else q.get("flag")
        out[key] = quantity(_ppm(q["value"] * factor), "mg/kg", q["source"], unc=unc, flag=flag, note=how) | extra
    return out


def record(entry: dict, physical: dict) -> dict:
    """The additions to doc["physical"] for one element (its index.json entry and the physical block so far)."""
    t = _tables()
    z = entry["Z"]
    return {
        "thermal": thermal_record(z, t["thermal"].get(z)),
        "uses": uses_record(z, t["uses"].get(z, [])),
        "allotropes": allotropes_record(t["allotropes"].get(z, [])),
        "hazards": hazards_record(entry, t["ghs"].get(z)),
        "abundanceByMass": abundance_by_mass(physical["abundance"]),
    }
