# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Biology & ecology (SPEC §10.10): the groups of life beyond plants and humans, biology.toml [[life]],
checked in the builder on inline rows and in the committed element files — no network, no raw files."""

from __future__ import annotations

import pytest

import build_lifeandhistory as L
import curated
from common import DATA_DIR, load_json

ROW = {
    "Z": 42,
    "group": "bacteria",
    "status": "some",
    "role": "Used in nitrogenase.",
    "source": "primary_literature",
    "doi": "10.1016/j.jmb.2008.03.051",
}


def test_rows_of_one_element_and_group_become_one_record():
    second = {**ROW, "role": "A second sentence.", "source": "wackett2004", "doi": "", "note": "A caveat."}
    groups = L.life_groups([ROW, second, {**ROW, "Z": 28, "group": "archaea"}])
    assert set(groups) == {28, 42}
    rec = groups[42]["bacteria"]
    assert rec["status"] == "some"
    assert [r["text"] for r in rec["roles"]] == ["Used in nitrogenase.", "A second sentence."]
    assert "doi" not in rec["roles"][1]
    assert rec["note"] == "A caveat."


def test_groups_come_out_in_the_panel_order():
    rows = [{**ROW, "group": g} for g in ("archaea", "animals", "bacteria", "fungi")]
    assert list(L.life_groups(rows)[42]) == ["animals", "fungi", "bacteria", "archaea"]


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"group": "plants"}, "unknown group"),
        ({"group": "humans"}, "unknown group"),
        ({"status": "yes"}, "unknown status"),
        ({"status": "not essential"}, "unknown status"),
        ({"source": "wikipedia"}, "not registered"),
        ({"doi": ""}, "without a DOI"),
        ({"Z": 0}, "atomic number"),
        ({"Z": 119}, "atomic number"),
        ({"role": "  "}, "no role sentence"),
        ({"essential": "yes"}, "unknown column"),
    ],
)
def test_a_bad_row_stops_the_build_and_names_itself(change, message):
    with pytest.raises(ValueError, match=message) as err:
        L.life_groups([{**ROW, **change}])
    assert "biology.toml [[life]]" in str(err.value)


def test_rows_that_disagree_on_the_status_stop_the_build():
    with pytest.raises(ValueError, match="another row says"):
        L.life_groups([ROW, {**ROW, "status": "essential", "role": "Other."}])


def test_one_note_per_element_and_group():
    with pytest.raises(ValueError, match="more than one note"):
        L.life_groups([{**ROW, "note": "One."}, {**ROW, "role": "Other.", "note": "Two."}])


def test_curated_loader_rejects_an_unregistered_source(tmp_path, monkeypatch):
    (tmp_path / "biology.toml").write_text(
        '[[life]]\nZ = 6\ngroup = "fungi"\nstatus = "essential"\nrole = "Backbone."\nsource = "nowhere"\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(curated, "CURATED_DIR", tmp_path)
    with pytest.raises(ValueError, match="unknown source 'nowhere'"):
        curated.load("biology.toml", "life")


def test_the_committed_life_table_builds():
    groups = L.life_groups(curated.load("biology.toml", "life"))
    assert {g for z in groups.values() for g in z} == set(L.LIFE_GROUPS)
    for z, by_group in groups.items():
        for g, rec in by_group.items():
            assert rec["roles"], (z, g)
            for r in rec["roles"]:
                assert r["text"].endswith("."), (z, g, r["text"])


def _groups(by_symbol, symbol: str) -> dict:
    return load_json(DATA_DIR / "elements" / f"{by_symbol[symbol]['Z']}.json")["biology"].get("groups", {})


def test_striking_cases_reach_the_element_files(by_symbol):
    mo = _groups(by_symbol, "Mo")
    assert mo["bacteria"]["status"] == "some"
    assert "nitrogenase" in mo["bacteria"]["roles"][0]["text"]
    assert mo["animals"]["status"] == "essential"
    ni = _groups(by_symbol, "Ni")["archaea"]
    assert ni["status"] == "some" and "F430" in ni["roles"][0]["text"]
    ce = _groups(by_symbol, "Ce")["bacteria"]
    assert ce["roles"][0]["doi"] == "10.1111/1462-2920.12249"
    br = _groups(by_symbol, "Br")["animals"]
    assert br["status"] == "some" and "fruit flies" in br["note"]
    assert _groups(by_symbol, "Se")["fungi"]["status"] == "none"
    assert _groups(by_symbol, "W")["archaea"]["status"] == "some"
    assert len(_groups(by_symbol, "Fe")["bacteria"]["roles"]) == 2


def test_an_element_without_rows_has_no_groups(by_symbol):
    for symbol in ("Ar", "Au", "Og"):
        assert _groups(by_symbol, symbol) == {}, symbol


def test_every_group_sentence_cites_a_registered_source(sources):
    for path in sorted((DATA_DIR / "elements").glob("*.json")):
        for g, rec in load_json(path)["biology"].get("groups", {}).items():
            assert g in L.LIFE_GROUPS and rec["status"] in L.LIFE_STATUS, path.name
            for r in rec["roles"]:
                assert r["source"] in sources["sources"], (path.name, g)
                assert sources["sources"][r["source"]]["status"] == "ok", (path.name, r["source"])
                if r["source"] == "primary_literature":
                    assert r.get("doi"), (path.name, g, r["text"])
