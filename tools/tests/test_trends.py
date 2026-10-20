# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""trends.json (SPEC §8): structure, coverage of M1's minimums, and the arrow claims our data can test."""

from __future__ import annotations

import pytest

from build import validate
from common import DATA_DIR, NUM_ELEMENTS, is_missing, load_json


@pytest.fixture(scope="module")
def trends():
    return load_json(DATA_DIR / "trends.json")


def value(e, field):
    q = e[field]
    return None if is_missing(q) else q["value"]


def test_trends_match_schema(trends):
    validate("TrendsFile", trends)


def test_m1_minimums(trends):
    """SPEC §8: all eleven arrow trends, at least ten heatmaps and six maps."""
    assert len(trends["arrows"]) == 11
    assert len(trends["heatmaps"]) >= 10
    assert len(trends["maps"]) >= 6


def test_every_map_classifies_every_element(trends):
    for m in trends["maps"]:
        assert sorted(int(z) for z in m["values"]) == list(range(1, NUM_ELEMENTS + 1)), m["id"]
        assert set(m["values"].values()) <= {c["id"] for c in m["classes"]}, m["id"]


def test_heatmap_fields_exist(trends, elements):
    for h in trends["heatmaps"]:
        if h["field"].startswith("computed:"):
            continue
        assert h["field"] in elements[0], h["id"]


def test_sources_and_exception_symbols_resolve(trends, sources, by_symbol):
    for item in trends["heatmaps"] + trends["maps"]:
        assert set(item["sources"]) <= set(sources["sources"]), item["id"]
    for a in trends["arrows"]:
        for ex in a["exceptions"]:
            assert set(ex["symbols"]) <= set(by_symbol), (a["id"], ex["symbols"])


def test_ie1_exceptions_are_real_dips(by_symbol):
    ie = lambda s: value(by_symbol[s], "ie1")  # noqa: E731
    assert ie("B") < ie("Be")
    assert ie("O") < ie("N")
    assert ie("Al") < ie("Mg")
    assert ie("S") < ie("P")


def test_ie1_trend_holds_at_the_ends(elements, by_symbol):
    for period in range(2, 7):
        row = [e for e in elements if e["period"] == period and e["group"] is not None]
        first, last = row[0], row[-1]
        assert value(first, "ie1") < value(last, "ie1"), period
    group1 = ["Li", "Na", "K", "Rb", "Cs"]
    ies = [value(by_symbol[s], "ie1") for s in group1]
    assert ies == sorted(ies, reverse=True)


def test_electronegativity_increases_across_periods_2_and_3(by_symbol):
    for row in (["Li", "Be", "B", "C", "N", "O", "F"], ["Na", "Mg", "Al", "Si", "P", "S", "Cl"]):
        en = [value(by_symbol[s], "electronegativityPauling") for s in row]
        assert en == sorted(en), row


def test_radius_trend_and_its_marked_exceptions(by_symbol):
    r = lambda s: value(by_symbol[s], "radiusCovalent")  # noqa: E731
    period2 = [r(s) for s in ["Li", "Be", "B", "C", "N", "O", "F"]]
    assert period2 == sorted(period2, reverse=True)
    group1 = [r(s) for s in ["Li", "Na", "K", "Rb", "Cs"]]
    assert group1 == sorted(group1)
    assert abs(r("Ga") - r("Al")) <= 5  # d-block contraction: Ga barely larger than Al
    assert abs(r("Hf") - r("Zr")) <= 5  # lanthanide contraction: Hf about the size of Zr
