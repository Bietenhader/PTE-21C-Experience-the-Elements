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
    assert {r["source"] for r in rows} <= {"jrc_foresight2023", "usgs_mcs"}
