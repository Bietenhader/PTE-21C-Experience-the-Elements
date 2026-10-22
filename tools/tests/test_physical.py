# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""The physical panel's data (SPEC §10.4): the PubChem GHS parser, the curated tables and the element files."""

from __future__ import annotations

from collections import Counter

import build_physical
import curated
import fetch_pubchem_ghs as ghs
from common import DATA_DIR, NUM_ELEMENTS, is_missing, load_json


def _info(ref: int, name: str, strings: list[str], urls: list[str] | None = None) -> dict:
    markup = [{"URL": u} for u in urls or []]
    return {
        "ReferenceNumber": ref,
        "Name": name,
        "Value": {"StringWithMarkup": [{"String": s, "Markup": markup} for s in strings]},
    }


# Shaped like PubChem's pug_view record: one block per contributor, linked by ReferenceNumber.
NOT_MET = "This chemical does not meet GHS hazard criteria for 74.1% (4458 of 6013) of all reports."
H228 = "H228 (15.5%): Flammable solid [Danger Flammable solids]"
H251 = "H251 (21.2%): Self-heating; may catch fire [Danger Self-heating substances and mixtures]"
SUMMARY = (
    "Aggregated GHS information provided per 6013 reports by companies from 24 notifications to the ECHA C&L Inventory."
)
ICON = "https://pubchem.ncbi.nlm.nih.gov/images/ghs/GHS02.svg"
INFORMATION = [
    _info(1, "Note", [NOT_MET]),
    _info(1, "Pictogram(s)", [" "], [ICON]),
    _info(1, "Signal", ["Danger"]),
    _info(1, "GHS Hazard Statements", [H228, H251]),
    _info(1, "ECHA C&L Notifications Summary", [SUMMARY]),
    _info(2, "GHS Hazard Statements", ["Not Classified"]),
    _info(2, "ECHA C&L Notifications Summary", ["Aggregated GHS information provided per 2 reports by companies."]),
    _info(3, "Signal", ["Warning"]),
]
GHS_SECTION = {"TOCHeading": "GHS Classification", "Information": INFORMATION}
RECORD = {
    "Reference": [
        {"ReferenceNumber": 1, "SourceName": "European Chemicals Agency (ECHA)"},
        {"ReferenceNumber": 2, "SourceName": "European Chemicals Agency (ECHA)"},
        {"ReferenceNumber": 3, "SourceName": "Some other contributor"},
    ],
    "Section": [
        {
            "TOCHeading": "Safety and Hazards",
            "Section": [{"TOCHeading": "Hazards Identification", "Section": [GHS_SECTION]}],
        }
    ],
}


def test_parse_statement():
    assert ghs.parse_statement("H228 (15.5%): Flammable solid [Danger Flammable solids]") == {
        "code": "H228",
        "text": "Flammable solid",
        "share": 15.5,
    }
    assert ghs.parse_statement("H260: In contact with water releases flammable gases [Danger Substances ...]") == {
        "code": "H260",
        "text": "In contact with water releases flammable gases",
    }
    combined = ghs.parse_statement("H300+H330 (2.1%): Fatal if swallowed or if inhaled [Danger Acute toxicity]")
    assert combined is not None and combined["code"] == "H300+H330"
    assert (
        ghs.parse_statement("H360Df: May damage the unborn child; suspected of damaging fertility")["code"] == "H360Df"
    )
    assert ghs.parse_statement("Not Classified") is None


def test_blocks_and_choose():
    found = ghs.blocks(RECORD)
    assert [b["contributor"] for b in found] == ["European Chemicals Agency (ECHA)"] * 2 + ["Some other contributor"]
    first = found[0]
    assert first["pictograms"] == ["GHS02"]
    assert first["signal"] == "Danger"
    assert [s["code"] for s in first["statements"]] == ["H228", "H251"]
    assert first["reports"] == 6013
    assert first["notMet"] == {"share": 74.1, "reports": 4458, "of": 6013}
    assert found[1]["notClassified"] and found[1]["statements"] == []
    chosen = ghs.choose(found)
    assert chosen["basis"] == "echa_notifications" and chosen["reports"] == 6013
    harmonised = [{"contributor": "EU Regulation (EC) No 1272/2008", "statements": []}, *found]
    assert ghs.choose(harmonised)["basis"] == "eu_harmonised"
    assert ghs.choose([found[2]])["basis"] == "other"
    assert ghs.choose([]) is None


def test_hazards_record_reasons():
    hydrogen = {"Z": 1, "name": "Hydrogen", "radioactive": False}
    assert build_physical.hazards_record(hydrogen, None)["reason"] == "source_unavailable_at_build"
    radon = {"Z": 86, "name": "Radon", "radioactive": True}
    m = build_physical.hazards_record(radon, {"cid": 24857, "status": "absent"})
    assert m["reason"] == "not_measured" and "radioactivity" in m["note"]
    og = {"Z": 118, "name": "Oganesson", "radioactive": True}
    assert build_physical.hazards_record(og, {"cid": 1, "status": "absent"})["reason"] == "not_applicable"
    chosen = ghs.choose(ghs.blocks(RECORD))
    iron = build_physical.hazards_record({"Z": 26, "name": "Iron"}, {"cid": 23925, "status": "ok", "block": chosen})
    assert iron["notMeetingCriteria"]["share"] == 74.1
    assert iron["reports"] == 6013 and "6013 reports" in iron["note"]


def test_uses_cover_every_element_with_two_to_five_bullets():
    rows = curated.load("uses.toml")
    count = Counter(r["Z"] for r in rows)
    assert sorted(count) == list(range(1, NUM_ELEMENTS + 1))
    assert all(2 <= n <= 5 for n in count.values()), {z: n for z, n in count.items() if not 2 <= n <= 5}
    for r in rows:
        assert r["text"].strip() and r["text"][0].isupper() and r["text"].endswith("."), r


def test_allotropes_have_at_most_one_standard_form():
    rows = curated.load("allotropes.toml")
    standard = Counter(r["Z"] for r in rows if r.get("standard"))
    assert all(n == 1 for n in standard.values())
    assert set(standard) == {r["Z"] for r in rows}, "each element with allotropes names its standard form"


def test_thermal_rows_are_plausible():
    rows = curated.load("thermal.toml")
    assert len({r["Z"] for r in rows}) == len(rows)
    for r in rows:
        per_atom = r["molar_heat_capacity"] / r.get("formula_atoms", 1)
        # Dulong–Petit is about 3R ≈ 24.9 J/(mol·K); gases and light solids sit well below or near it.
        assert 8 < per_atom < 40, r


def test_element_files_carry_the_physical_additions():
    for z in range(1, NUM_ELEMENTS + 1):
        phys = load_json(DATA_DIR / "elements" / f"{z}.json")["physical"]
        assert phys["uses"], z
        cp = phys["thermal"]["molarHeatCapacity"]
        assert is_missing(cp) or cp["unit"] == "J/(mol·K)"
        hz = phys["hazards"]
        assert is_missing(hz) or hz["source"] == "pubchem_ghs"


def test_body_rows_are_for_the_70_kg_reference_adult():
    text = (curated.CURATED_DIR / "abundance.toml").read_text(encoding="utf-8")
    assert f"{build_physical.REFERENCE_ADULT_KG} kg" in text.split("[[row]]")[0]
    for r in curated.load("abundance.toml"):
        if r["quantity"] == "body":
            assert f"{build_physical.REFERENCE_ADULT_KG} kg" in r["note"], r


def test_abundance_by_mass():
    iron = load_json(DATA_DIR / "elements" / "26.json")["physical"]
    a, ppm = iron["abundance"], iron["abundanceByMass"]
    assert ppm["crust"]["value"] == a["crust"]["value"]
    assert abs(ppm["solar"]["value"] - a["solar"]["value"] * 1e6) < 1e-6 * ppm["solar"]["value"]
    assert abs(ppm["body"]["value"] - a["body"]["value"] * 1000 / 70) < 1e-5 * ppm["body"]["value"]
    assert all(q["unit"] == "mg/kg" for q in ppm.values())
