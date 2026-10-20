# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Build public/data/trends.json (SPEC §8) from tools/curated/trends.toml and index.json.

Arrow trends and heatmaps are copied from the curated file. Categorical maps are computed here, one
class per element, from fields that already carry sources; the app only draws them.
"""

from __future__ import annotations

import tomllib

from build import validate
from common import CURATED_DIR, DATA_DIR, NUM_ELEMENTS, dump_json, is_missing, load_json

# Discovery eras: (class id, last year included). Labels live in tools/curated/trends.toml.
ERA_BOUNDS = [("to-1799", 1799), ("1800s", 1899), ("1900-1944", 1944), ("1945-1999", 1999), ("2000s", None)]


def map_block(e):
    return e["block"]


def map_state(e):
    return e["standardState"]


def map_madelung(e):
    c = e["configuration"]
    if c.get("flag") == "predicted":
        return "predicted"
    return "anomalous" if c["anomalous"] else "aufbau"


def map_radioactivity(e):
    if not e["radioactive"]:
        return "stable"
    return "primordial" if not is_missing(e["atomicWeight"]) else "synthetic"


def map_era(e):
    year = e["discovery"].get("year")
    if year is None:
        return "antiquity"
    for cid, upper in ERA_BOUNDS:
        if upper is None or year <= upper:
            return cid
    raise ValueError(year)


def map_hfs(e):
    h = e["hyperfineHeadline"]
    if not is_missing(h):
        return "value"
    note = h.get("note", "")
    if h["reason"] == "not_applicable":
        return "j0" if "J = 0" in note else "i0"
    if h["reason"] == "no_stable_isotope":
        return "no-natural"
    return "pending"


def map_ie_flag(e):
    q = e["ie1"]
    if is_missing(q):
        return "none"
    return {"measured": "measured", "interpolated": "semi", "calculated": "theory"}[q.get("flag", "measured")]


def map_weight(e):
    w = e["atomicWeight"]
    if is_missing(w):
        return "none"
    return "interval" if "low" in w else "value"


CLASSIFIERS = {
    "block": map_block,
    "state": map_state,
    "madelung": map_madelung,
    "radioactivity": map_radioactivity,
    "discovery": map_era,
    "hyperfine": map_hfs,
    "ie-provenance": map_ie_flag,
    "atomic-weight": map_weight,
}


def build_trends() -> int:
    curated = tomllib.loads((CURATED_DIR / "trends.toml").read_text(encoding="utf-8"))
    elements = load_json(DATA_DIR / "index.json")["elements"]
    maps = []
    for spec in curated["map"]:
        classify = CLASSIFIERS[spec["id"]]
        values = {str(e["Z"]): classify(e) for e in elements}
        stray = set(values.values()) - {c["id"] for c in spec["classes"]}
        if stray:
            raise ValueError(f"map {spec['id']}: classes {stray} are not declared in trends.toml")
        maps.append(spec | {"values": values})
    if set(CLASSIFIERS) != {m["id"] for m in maps}:
        raise ValueError("every map in trends.toml needs a classifier in build_trends.py, and vice versa")
    trends = {
        "schemaVersion": 1,
        "arrows": curated["arrow"],
        "heatmaps": curated["heatmap"],
        "maps": maps,
    }
    validate("TrendsFile", trends)
    assert all(len(m["values"]) == NUM_ELEMENTS for m in maps)
    dump_json(DATA_DIR / "trends.json", trends)
    counts = f"{len(trends['arrows'])} arrow trends, {len(trends['heatmaps'])} heatmaps, {len(maps)} maps"
    print(f"wrote trends.json: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(build_trends())
