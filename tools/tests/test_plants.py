# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Plants in detail (tools/curated/plants.toml, after v0.1.0): the builder on inline rows, then the committed
data and element files — no network, no raw files."""

from __future__ import annotations

import pytest

import build_lifeandhistory as L
import curated
from common import DATA_DIR, load_json

M = "10.1016/b978-0-12-819773-8.00017-4"
FACT = {
    "Z": 30,
    "uptake": "Zn²⁺",
    "uptake_source": "marschner2023",
    "uptake_doi": M,
    "phloem": "intermediate",
    "phloem_source": "marschner2023",
    "typical_mg_kg": 20,
    "typical_source": "marschner2023",
    "job": 4,
    "job_source": "mengel_kirkby2001",
    "known_year": 1926,
    "known_by": "A. L. Sommer and C. B. Lipman",
    "known_source": "marschner2023",
}
NOTE = {"Z": 30, "topic": "deficiency", "text": "Leaves stay small.", "source": "marschner2023", "doi": M}
LEVEL = {
    "Z": 30,
    "plant": "Maize",
    "group": "cereals",
    "part": "ear leaf",
    "kind": "bands",
    "deficient_below": 5,
    "adequate_low": 20,
    "adequate_high": 70,
    "excess_above": 150,
    "unit": "μg/g",
    "source": "mengel_kirkby2001",
    "doi": "10.1007/978-94-010-1009-2_2",
}


def test_the_three_tables_make_one_record():
    rec = L.plant_details([FACT], [NOTE], [LEVEL])[30]
    assert rec["uptake"] == {"text": "Zn²⁺", "source": "marschner2023", "doi": M}
    assert rec["phloem"] == {"mobility": "intermediate", "source": "marschner2023"}
    assert rec["typical"] == {"value": 20, "unit": "mg/kg", "source": "marschner2023", "note": "in shoot dry matter"}
    assert rec["job"] == {"group": 4, "source": "mengel_kirkby2001"}
    assert rec["known"] == {"year": 1926, "by": "A. L. Sommer and C. B. Lipman", "source": "marschner2023"}
    assert rec["notes"] == {"deficiency": [{"text": "Leaves stay small.", "source": "marschner2023", "doi": M}]}
    (level,) = rec["levels"]
    assert level["deficientBelow"] == 5 and level["excessAbove"] == 150
    assert level["unit"] == "mg/kg" and level["printedUnit"] == "μg/g"


@pytest.mark.parametrize(
    ("value", "unit", "mg_per_kg"),
    [(0.07, "mg/g", 70.0), (1.5, "g/kg", 1500.0), (2.5, "%", 25000.0), (15, "mg/kg", 15.0), (0.1, "μg/g", 0.1)],
)
def test_printed_units_become_mg_per_kg_without_float_noise(value, unit, mg_per_kg):
    level = {**LEVEL, "kind": "critical", "unit": unit, "deficient_below": value}
    for k in ("adequate_low", "adequate_high", "excess_above"):
        level.pop(k)
    (out,) = L.plant_details([], [], [level])[30]["levels"]
    assert out["deficientBelow"] == mg_per_kg


def test_notes_and_levels_come_out_in_the_panel_order():
    notes = [{**NOTE, "topic": t} for t in ("food", "soil", "deficiency")]
    levels = [{**LEVEL, "group": g} for g in ("conifers", "fruit", "cereals")]
    rec = L.plant_details([], notes, levels)[30]
    assert list(rec["notes"]) == ["deficiency", "soil", "food"]
    assert [x["group"] for x in rec["levels"]] == ["cereals", "fruit", "conifers"]


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"phloem": "fast"}, "phloem must be one of"),
        ({"job": 5}, "job must be 1, 2, 3 or 4"),
        ({"typical_mg_kg": 0}, "must be positive"),
        ({"typical_source": None}, "without typical_source"),
        ({"known_year": None, "known_text": None}, "needs known_year or known_text"),
        ({"colour": "green"}, "unknown column"),
        ({"Z": 119}, "atomic number"),
    ],
)
def test_a_bad_fact_row_stops_the_build(change, message):
    row = {k: v for k, v in {**FACT, **change}.items() if v is not None}
    with pytest.raises(ValueError, match=message) as err:
        L.plant_details([row], [], [])
    assert "plants.toml [[plant]]" in str(err.value)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"group": "trees"}, "unknown group"),
        ({"kind": "sufficient"}, "unknown kind"),
        ({"unit": "ppm"}, "unit must be one of"),
        ({"adequate_low": 80}, "must rise"),
        ({"adequate_high": 20}, "must rise"),
        ({"excess_above": -1}, "positive"),
        ({"kind": "critical"}, "has no"),
        ({"kind": "normal"}, "has no deficient_below, excess_above"),
        ({"plant": " "}, "no plant name"),
        ({"sample": "leaf"}, "unknown column"),
    ],
)
def test_a_bad_leaf_level_stops_the_build(change, message):
    with pytest.raises(ValueError, match=message) as err:
        L.plant_details([], [], [{**LEVEL, **change}])
    assert "plants.toml [[leaf_level]]" in str(err.value)


def test_a_kind_without_its_numbers_stops_the_build():
    row = {k: v for k, v in LEVEL.items() if k not in ("adequate_low", "adequate_high")}
    with pytest.raises(ValueError, match="needs adequate_high, adequate_low"):
        L.plant_details([], [], [row])


def test_a_deficient_class_may_end_where_enough_begins():
    (out,) = L.plant_details([], [], [{**LEVEL, "deficient_below": 20}])[30]["levels"]
    assert out["deficientBelow"] == out["adequateLow"] == 20


def test_two_rows_for_one_element_or_group_stop_the_build():
    with pytest.raises(ValueError, match="more than one row"):
        L.plant_details([FACT, FACT], [], [])
    with pytest.raises(ValueError, match="two rows for the group 'cereals'"):
        L.plant_details([], [], [LEVEL, {**LEVEL, "plant": "Wheat"}])


def test_a_bad_note_stops_the_build():
    with pytest.raises(ValueError, match="unknown topic"):
        L.plant_details([], [{**NOTE, "topic": "history"}], [])
    with pytest.raises(ValueError, match="no text"):
        L.plant_details([], [{**NOTE, "text": ""}], [])


# --- the committed data ---------------------------------------------------------------------------


def test_the_committed_table_builds_and_covers_the_nutrients():
    plants = L.load_plants()
    essential = {7, 15, 19, 20, 12, 16, 26, 25, 30, 29, 42, 5, 17, 28}
    assert essential <= set(plants)
    for z in essential:
        assert "uptake" in plants[z], z
        assert plants[z].get("notes", {}).get("deficiency"), z


def test_marschner_table_1_3_and_3_8_reach_the_files():
    zn = load_json(DATA_DIR / "elements" / "30.json")["biology"]["plants"]
    assert zn["typical"]["value"] == 20 and zn["typical"]["unit"] == "mg/kg"
    assert zn["phloem"]["mobility"] == "intermediate"
    assert zn["known"]["year"] == 1926
    k = load_json(DATA_DIR / "elements" / "19.json")["biology"]["plants"]
    assert k["phloem"]["mobility"] == "high" and k["typical"]["value"] == 10000
    ca = load_json(DATA_DIR / "elements" / "20.json")["biology"]["plants"]
    assert ca["phloem"]["mobility"] == "low"


def test_iodine_is_beneficial_for_plants_in_the_4th_edition():
    b = load_json(DATA_DIR / "elements" / "53.json")["biology"]
    assert b["essentialPlant"] == "beneficial"
    assert b["plantRole"]["source"] == "marschner2023"


def test_no_plant_sentence_cites_the_3rd_edition_any_more():
    for row in curated.load("biology.toml"):
        assert row.get("plant_source") != "marschner2012", row["Z"]


def test_elements_plants_do_without_have_no_plant_details():
    for z in (79, 92, 118):
        assert "plants" not in load_json(DATA_DIR / "elements" / f"{z}.json")["biology"]
