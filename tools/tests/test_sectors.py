# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Sector maps (tools/curated/sectors.toml, after v0.1.0): the checks on inline rows, then the committed data and
trends.json — no network."""

from __future__ import annotations

import pytest

import build_trends as T
import curated
from common import DATA_DIR, load_json

ROW = {"Z": 14, "sector": "ict", "status": "essential", "role": "In chips.", "source": "jrc_foresight2023", "page": "x"}


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"sector": "transport"}, "unknown sector"),
        ({"status": "vital"}, "unknown status"),
        ({"Z": 0}, "atomic number"),
        ({"colour": "red"}, "unknown column"),
        ({"role": " "}, "no role sentence"),
    ],
)
def test_a_bad_row_stops_the_build(change, message):
    with pytest.raises(ValueError, match=message):
        T.sector_rows([{**ROW, **change}])


def test_two_rows_for_one_element_and_sector_stop_the_build():
    with pytest.raises(ValueError, match="more than one row"):
        T.sector_rows([ROW, ROW])


def maps():
    return {m["id"]: m for m in load_json(DATA_DIR / "trends.json")["maps"]}


def test_the_three_maps_follow_essential_for_humans():
    ids = list(maps())
    i = ids.index("essential-humans")
    assert ids[i + 1 : i + 4] == ["essential-energy", "essential-infrastructure", "essential-ict"]


@pytest.mark.parametrize(
    ("map_id", "z", "status"),
    [("essential-ict", 14, "essential"), ("essential-infrastructure", 29, "essential"),
     ("essential-energy", 92, "essential"), ("essential-ict", 49, "essential"), ("essential-energy", 79, "important"),
     ("essential-ict", 18, "none")],
)  # fmt: skip
def test_golden_facts(map_id, z, status):
    m = maps()[map_id]
    values = m.get("values") or m.get("classOf") or m.get("byZ")
    assert values is not None, sorted(m)
    got = values[z - 1] if isinstance(values, list) else values[str(z)]
    assert got == status


def test_every_committed_row_builds_and_cites_a_registered_source():
    rows = curated.load("sectors.toml", "sector")
    assert len(T.sector_rows(rows)) == len(rows) > 100
    allowed = {
        "jrc_foresight2023", "usgs_mcs", "graedel2015basis", "graedel2015criticality", "iea_critical_minerals2021",
        "eia_energy_explained",
    }  # fmt: skip
    assert {r["source"] for r in rows} <= allowed
    # The Graedel papers name uses but not the JRC's technology coverage: never "essential" on their own.
    assert all(r["status"] == "important" for r in rows if r["source"].startswith("graedel"))


def test_cement_makes_calcium_essential_for_infrastructure():
    rows = T.sector_rows(curated.load("sectors.toml", "sector"))
    ca = rows[(20, "infrastructure")]
    assert ca["status"] == "essential" and ca["source"] == "usgs_mcs" and "cement" in ca["role"]


def test_every_role_is_a_full_sentence_not_a_count():
    for r in curated.load("sectors.toml", "sector"):
        assert "technologies the JRC studied" not in r["role"], r["Z"]
        assert r["role"][0].isupper() and r["role"].endswith("."), (r["Z"], r["sector"])


def test_fossil_fuels_carbon_and_hydrogen_count_for_energy():
    rows = T.sector_rows(curated.load("sectors.toml", "sector"))
    assert rows[(6, "energy")]["source"] == rows[(1, "energy")]["source"] == "eia_energy_explained"


def test_element_files_carry_their_sector_rows():
    from common import DATA_DIR, load_json

    cu = {r["sector"]: r for r in load_json(DATA_DIR / "elements" / "29.json")["physical"]["sectors"]}
    assert cu["energy"]["status"] == "essential" and cu["energy"]["text"]
    ni = load_json(DATA_DIR / "elements" / "28.json")["physical"]["sectors"]
    assert [r["sector"] for r in ni] == ["energy", "infrastructure", "ict"][: len(ni)]
    c = {r["sector"]: r for r in load_json(DATA_DIR / "elements" / "6.json")["physical"]["sectors"]}
    assert c["energy"]["asOf"] == 2026
    assert load_json(DATA_DIR / "elements" / "118.json")["physical"]["sectors"] == []


def test_sector_maps_carry_the_sentences_for_the_hover_card():
    from common import DATA_DIR, load_json

    maps = {m["id"]: m for m in load_json(DATA_DIR / "trends.json")["maps"]}
    assert maps["essential-energy"]["notes"]["29"]["source"]
    assert "notes" not in maps["essential-plants"]
