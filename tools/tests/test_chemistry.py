# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Chemistry & bonding (SPEC §10.9): the PubChem parsers and the builder, on inline records and the
committed curated tables — no network, no raw files."""

from __future__ import annotations

import pytest

import build_chemistry as C
import curated
import fetch_pubchem_hsdb as F
from common import NUM_ELEMENTS, Report


@pytest.mark.parametrize(
    ("formula", "counts"),
    [
        ("Fe2(SO4)3", {"Fe": 2, "S": 3, "O": 12}),
        ("CuSO4·5H2O", {"Cu": 1, "S": 1, "O": 9, "H": 10}),
        ("Ca5(PO4)3(OH)", {"Ca": 5, "P": 3, "O": 13, "H": 1}),
        ("NpO2⁺", {"Np": 1, "O": 2}),
        ("AmO2²⁺", {"Am": 1, "O": 2}),
        ("Ac2O3-6", {"Ac": 2, "O": 3}),  # PubChem's charge suffix
        ("NaCl(s)", {"Na": 1, "Cl": 1}),
    ],
)
def test_formula_counts(formula, counts):
    assert F.formula_counts(formula) == counts


def test_formula_counts_rejects_what_it_cannot_read():
    with pytest.raises(ValueError):
        F.formula_counts("Fe2O3?")


def test_same_formula_ignores_hill_order_only():
    assert F.same_formula("FeCl3", "Cl3Fe")
    assert F.same_formula("Li3N", "Li3N")
    assert not F.same_formula("P4O10", "O5P2")  # same ratio, different molecule
    assert not F.same_formula("Li3N", "LiN")


def test_section_texts_keeps_one_contributor():
    record = {
        "Reference": [
            {"ReferenceNumber": 1, "SourceName": F.HSDB_NAME},
            {"ReferenceNumber": 2, "SourceName": F.CAMEO_NAME},
        ],
        "Section": [
            {
                "TOCHeading": "Chemical and Physical Properties",
                "Section": [
                    {
                        "TOCHeading": "Stability/Shelf Life",
                        "Information": [
                            {"ReferenceNumber": 1, "Value": {"StringWithMarkup": [{"String": "Stable in dry air."}]}},
                            {"ReferenceNumber": 1, "Value": {"StringWithMarkup": [{"String": "Stable in dry air."}]}},
                            {"ReferenceNumber": 2, "Value": {"StringWithMarkup": [{"String": "Not HSDB."}]}},
                        ],
                    },
                    {"TOCHeading": "Density", "Information": [{"ReferenceNumber": 1, "Value": {"Number": [7.9]}}]},
                ],
            }
        ],
    }
    assert F.section_texts(record, F.HSDB_HEADINGS, F.HSDB_NAME) == {"Stability/Shelf Life": ["Stable in dry air."]}
    assert F.section_texts(record, F.CAMEO_HEADINGS, F.CAMEO_NAME) == {}


@pytest.mark.parametrize(("text", "n"), [("IV", 4), ("VI", 6), ("VIII", 8), ("IX", 9), ("IVSQ", 4), ("IIIPY", 3)])
def test_roman_coordination(text, n):
    assert C.roman(text) == n


@pytest.fixture
def offline(monkeypatch):
    """The builder on the committed curated tables, with no PubChem cache."""
    rows = {r["Z"]: r for r in curated.load("chemistry.toml")}
    radii: dict[int, list] = {}
    for r in curated.load("ionic_radii.toml"):
        radii.setdefault(r["Z"], []).append(r)
    pubchem = {"elements": {}, "compounds": {}}
    monkeypatch.setattr(C, "tables", lambda: (rows, radii, pubchem))
    return pubchem


def test_every_element_has_a_chemistry_record(offline):
    report = Report()
    for z in range(1, NUM_ELEMENTS + 1):
        rec = C.record(z, report)
        assert set(rec) >= {"bonding", "reactivity", "compounds", "oxidationExamples", "ionicRadii"}
        assert set(rec["reactivity"]) == {"air", "water", "acids"}
    # no cache: said once per source, not once per compound
    lines = report.sections.get("Sources unavailable at build", [])
    assert len(lines) == 2


def test_a_compound_pubchem_contradicts_is_left_out(offline):
    offline["compounds"]["water"] = {"cid": 784, "formula": "H2O2"}
    offline["compounds"]["hydrogen chloride"] = {"cid": 313, "formula": "ClH"}
    report = Report()
    rec = C.record(1, report)
    formulas = [c["formula"] for c in rec["compounds"]]
    assert "H2O" not in formulas
    assert {"formula": "HCl", "name": "hydrogen chloride", "source": "pubchem_compounds", "cid": 313} in rec[
        "compounds"
    ]
    assert any("left out H2O" in line for line in report.sections[C.SECTION])


def test_missing_notes_carry_a_reason(offline):
    og = C.record(118, Report())
    assert og["bonding"]["missing"] and og["bonding"]["reason"] == "predicted_only"
    assert og["compounds"]["reason"] == "predicted_only"
    assert og["sources"] == ["smits2020"]
    he = C.record(2, Report())
    assert he["compounds"]["reason"] == "not_applicable"


def test_ionic_radii_are_sorted_and_in_pm(offline):
    fe = C.record(26, Report())["ionicRadii"]
    assert [(r["charge"], C.roman(r["coordination"])) for r in fe] == sorted(
        (r["charge"], C.roman(r["coordination"])) for r in fe
    )
    assert all(r["radius"]["unit"] == "pm" and r["radius"]["source"] == "shannon1976" for r in fe)
