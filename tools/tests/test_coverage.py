# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Coverage thresholds (SPEC §13.1), gated by milestone in tools/coverage.toml."""

from __future__ import annotations

import tomllib

import pytest

from common import DATA_DIR, TOOLS_DIR, is_missing, load_json

CONFIG = tomllib.loads((TOOLS_DIR / "coverage.toml").read_text(encoding="utf-8"))


def count(field: str, elements: list[dict]) -> int:
    if field == "configuration":
        return sum(bool(e["configuration"]["measured"]) for e in elements)
    if field == "configuration_nist":
        return sum(e["configuration"]["source"] == "nist_gsie" for e in elements)
    if field == "atomicWeightOrMassNumber":
        return sum(not is_missing(e["atomicWeight"]) or "mostStableMassNumber" in e for e in elements)
    if field == "oxidationStates":
        return sum(bool(e["oxidationStates"]["common"] or e["oxidationStates"]["other"]) for e in elements)
    if field == "images":
        return sum(bool(e["images"]) for e in elements)
    if field == "isotopes":
        return len(list((DATA_DIR / "isotopes").glob("*.json")))
    if field == "visibleLines":
        files = (DATA_DIR / "spectra").glob("*.json")
        return sum(1 for f in files if load_json(f).get("lines"))
    return sum(not is_missing(e[field]) for e in elements)


@pytest.mark.parametrize(
    "threshold",
    [t for t in CONFIG["threshold"] if t["milestone"] <= CONFIG["current_milestone"]],
    ids=lambda t: f"{t['field']}>={t['min']}",
)
def test_coverage(threshold, elements):
    n = count(threshold["field"], elements)
    assert n >= threshold["min"], f"{threshold['field']}: {n} < {threshold['min']} ({threshold.get('note', '')})"


def test_every_threshold_field_is_countable(elements):
    for t in CONFIG["threshold"]:
        count(t["field"], elements)
