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
    flag = q.get("flag", "measured")
    if flag == "predicted":  # Z ≥ 109: a published calculation, not in NIST (tools/curated/superheavy.toml)
        return "none"
    return {"measured": "measured", "interpolated": "semi", "calculated": "theory"}[flag]


def map_weight(e):
    w = e["atomicWeight"]
    if is_missing(w):
        return "none"
    return "interval" if "low" in w else "value"


# Maps whose classes come from curated tables and metrology.json rather than from index.json.
ORIGIN_CLASSES = {
    "bigbang": "bigbang",
    "cosmic_rays": "cosmic-rays",
    "agb": "agb",
    "massive_stars": "massive-stars",
    "neutron_star_mergers": "neutron-star-mergers",
    "white_dwarfs": "white-dwarfs",
}


def curated_rows(name, table="row"):
    import curated

    return curated.load(name, table)


def context() -> dict:
    metrology = load_json(DATA_DIR / "metrology.json")
    cooled: dict[int, set] = {}
    for r in curated_rows("lasercooling.toml"):
        cooled.setdefault(r["Z"], set()).add(r.get("charge", 0))
    biology = {r["Z"]: r for r in curated_rows("biology.toml")}
    return {
        "cooled": cooled,
        "clocks": metrology["clocks"],
        "si": metrology["siHistory"],
        "biology": biology,
        "origin": {r["Z"]: r for r in curated_rows("nucleosynthesis.toml")},
    }


def map_cooled(e, ctx):
    charges = ctx["cooled"].get(e["Z"], set())
    if not charges:
        return "none"
    if 0 in charges and charges - {0}:
        return "both"
    return "neutral" if 0 in charges else "ion"


def map_clocks(e, ctx):
    rows = [c for c in ctx["clocks"] if c["Z"] == e["Z"] and c["kind"] != "molecular"]
    if any(c.get("definesSecond") for c in rows):
        return "defines"
    if any(c["srs"] for c in rows):
        return "srs"
    return "standard" if rows else "none"


def map_si(e, ctx):
    rows = [r for r in ctx["si"] if r["Z"] == e["Z"]]
    if not rows:
        return "none"
    return "current" if any("to" not in r for r in rows) else "historical"


def map_plants(e, ctx):
    return ctx["biology"].get(e["Z"], {}).get("essential_plant", "no")


def map_humans(e, ctx):
    return ctx["biology"].get(e["Z"], {}).get("essential_human", "no")


def map_origin(e, ctx):
    row = ctx["origin"].get(e["Z"])
    if not row:
        return "none"
    shares = sorted(((row.get(k, 0), k) for k in ORIGIN_CLASSES), reverse=True)
    if shares[0][0] == shares[1][0]:
        return "even"
    return ORIGIN_CLASSES[shares[0][1]]


CONTEXT_CLASSIFIERS = {
    "laser-cooled": map_cooled,
    "clocks": map_clocks,
    "si-history": map_si,
    "essential-plants": map_plants,
    "essential-humans": map_humans,
    "origin": map_origin,
}

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
    ctx = context()
    maps = []
    for spec in curated["map"]:
        if spec["id"] in CONTEXT_CLASSIFIERS:
            values = {str(e["Z"]): CONTEXT_CLASSIFIERS[spec["id"]](e, ctx) for e in elements}
        else:
            values = {str(e["Z"]): CLASSIFIERS[spec["id"]](e) for e in elements}
        stray = set(values.values()) - {c["id"] for c in spec["classes"]}
        if stray:
            raise ValueError(f"map {spec['id']}: classes {stray} are not declared in trends.toml")
        maps.append(spec | {"values": values})
    if set(CLASSIFIERS) | set(CONTEXT_CLASSIFIERS) != {m["id"] for m in maps}:
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
