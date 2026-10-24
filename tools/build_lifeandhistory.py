# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""The `biology` and `history` records of public/data/elements/{Z}.json (SPEC §10.10, §10.11) and the
world outline behind the discovery map, public/data/worldmap.json.

biology: tools/curated/biology.toml (FIN reviews it) — the essential-element rows from M2 plus, from
M4, isotope uses, environmental and toxicity notes and IARC classifications (the group read from the
fetched IARC list, never typed), and, after M5, the [[life]] rows for animals, fungi, bacteria and
archaea (written to biology.groups); after v0.1.0, the plant details of tools/curated/plants.toml
(FIN reviews it too), written to biology.plants.
history: tools/curated/history.toml, with each discovery place given coordinates from the cached
gazetteers named in tools/curated/places.toml (Natural Earth, or GeoNames for small towns).
"""

from __future__ import annotations

import math
from decimal import Decimal

import curated
import fetch_geonames
import fetch_iarc
import fetch_natural_earth
from common import DATA_DIR, NUM_ELEMENTS, Report, SourceUnavailable, missing

# --- biology ------------------------------------------------------------------------------------

BIOLOGY_TABLES = ("isotope_use", "environment", "toxicity", "iarc")

# Groups of life beyond plants and humans (biology.toml [[life]]), in the order the panel shows them,
# and what a row may say about one: essential (needed by essentially all members), some (used by some,
# not all), beneficial (helps, not required), none (a source says the group does without it).
LIFE_GROUPS = ("animals", "fungi", "bacteria", "archaea")
LIFE_STATUS = ("essential", "some", "beneficial", "none")
LIFE_COLUMNS = {"Z", "group", "status", "role", "source", "doi", "note"}


def _sourced(row: dict) -> dict:
    out = {"text": row["text"], "source": row["source"]}
    if row.get("doi"):
        out["doi"] = row["doi"]
    return out


def life_groups(rows: list[dict]) -> dict[int, dict[str, dict]]:
    """{Z: {group: {status, roles, note?}}} from the [[life]] rows of biology.toml.

    Each row adds one sourced sentence (a role) to its element and group. The build stops, naming the
    row, on an unknown group, status or column, a source not registered in tools/sources.toml, a
    primary_literature row without a DOI, rows of one element and group that disagree on the status,
    or more than one note for them.
    """
    registry = curated.registry()
    out: dict[int, dict[str, dict]] = {}
    for r in rows:
        where = f"biology.toml [[life]] Z={r.get('Z')!r} group={r.get('group')!r}"
        z = r.get("Z")
        if not isinstance(z, int) or not 1 <= z <= NUM_ELEMENTS:
            raise ValueError(f"{where}: Z must be an atomic number from 1 to {NUM_ELEMENTS}")
        if r.get("group") not in LIFE_GROUPS:
            raise ValueError(f"{where}: unknown group; use one of {', '.join(LIFE_GROUPS)}")
        if r.get("status") not in LIFE_STATUS:
            raise ValueError(f"{where}: unknown status {r.get('status')!r}; use one of {', '.join(LIFE_STATUS)}")
        if extra := sorted(set(r) - LIFE_COLUMNS):
            raise ValueError(f"{where}: unknown column(s) {', '.join(extra)}")
        if not isinstance(r.get("role"), str) or not r["role"].strip():
            raise ValueError(f"{where}: no role sentence")
        if r.get("source") not in registry:
            raise ValueError(f"{where}: source {r.get('source')!r} is not registered in tools/sources.toml")
        if r["source"] == "primary_literature" and not r.get("doi"):
            raise ValueError(f"{where}: primary_literature without a DOI")
        rec = out.setdefault(z, {}).setdefault(r["group"], {"status": r["status"], "roles": []})
        if rec["status"] != r["status"]:
            raise ValueError(f"{where}: status {r['status']!r}, but another row says {rec['status']!r}")
        if r.get("note"):
            if "note" in rec:
                raise ValueError(f"{where}: more than one note")
            rec["note"] = r["note"]
        rec["roles"].append({"text": r["role"], "source": r["source"], **({"doi": r["doi"]} if r.get("doi") else {})})
    return {z: {g: groups[g] for g in LIFE_GROUPS if g in groups} for z, groups in sorted(out.items())}


# Plants in detail (plants.toml, after v0.1.0): the topics of [[plant_note]] in the order the panel
# shows them, the groups of plants a [[leaf_level]] row may stand for, and how to read its numbers.
PLANT_TOPICS = ("deficiency", "toxicity", "soil", "partners", "wild", "forest", "food")
PLANT_GROUPS = ("cereals", "legumes", "vegetables", "fruit", "conifers", "broadleaf", "other")
PHLOEM_MOBILITY = ("high", "intermediate", "low", "variable")
LEVEL_KINDS = ("bands", "normal", "critical")
# The units the books print leaf levels in, as factors to mg per kg of dry matter (μg/g is the same).
TO_MG_PER_KG = {"mg/kg": 1, "μg/g": 1, "g/kg": 1000, "mg/g": 1000, "%": 10000}
# [[plant]] facts: column prefix → (output key, the columns it may have besides <prefix>_source/_doi).
PLANT_FACTS = {
    "uptake": ("uptake", {"uptake"}),
    "phloem": ("phloem", {"phloem"}),
    "typical": ("typical", {"typical_mg_kg"}),
    "job": ("job", {"job"}),
    "known": ("known", {"known_year", "known_by", "known_text"}),
}
NOTE_COLUMNS = {"Z", "topic", "text", "source", "doi"}
LEVEL_COLUMNS = {
    "Z", "plant", "group", "part", "kind", "deficient_below", "adequate_low", "adequate_high", "excess_above",
    "unit", "source", "doi", "note",
}  # fmt: skip
LEVEL_NUMBERS = ("deficient_below", "adequate_low", "adequate_high", "excess_above")


def _check_z(z: object, where: str) -> int:
    if not isinstance(z, int) or not 1 <= z <= NUM_ELEMENTS:
        raise ValueError(f"{where}: Z must be an atomic number from 1 to {NUM_ELEMENTS}")
    return z


def _cite(r: dict, prefix: str = "") -> dict:
    out = {"source": r[f"{prefix}source"]}
    if r.get(f"{prefix}doi"):
        out["doi"] = r[f"{prefix}doi"]
    return out


def _mg_per_kg(v: float, unit: str) -> float:
    """A printed leaf level in mg/kg, without binary noise (0.07 mg/g is 70, not 70.00000000000001)."""
    return float(Decimal(str(v)) * TO_MG_PER_KG[unit])


def _plant_facts(r: dict) -> dict:
    where = f"plants.toml [[plant]] Z={r.get('Z')!r}"
    allowed = {"Z"}
    for prefix, (_, cols) in PLANT_FACTS.items():
        allowed |= cols | {f"{prefix}_source", f"{prefix}_doi"}
    if extra := sorted(set(r) - allowed):
        raise ValueError(f"{where}: unknown column(s) {', '.join(extra)}")
    out: dict = {}
    for prefix, (key, cols) in PLANT_FACTS.items():
        given = cols & set(r)
        if not given:
            if f"{prefix}_source" in r:
                raise ValueError(f"{where}: {prefix}_source without a value")
            continue
        if f"{prefix}_source" not in r:
            raise ValueError(f"{where}: {', '.join(sorted(given))} without {prefix}_source")
        cite = _cite(r, f"{prefix}_")
        if prefix == "uptake":
            out[key] = {"text": r["uptake"], **cite}
        elif prefix == "phloem":
            if r["phloem"] not in PHLOEM_MOBILITY:
                raise ValueError(f"{where}: phloem must be one of {', '.join(PHLOEM_MOBILITY)}")
            out[key] = {"mobility": r["phloem"], **cite}
        elif prefix == "typical":
            if not r["typical_mg_kg"] > 0:
                raise ValueError(f"{where}: typical_mg_kg must be positive")
            out[key] = {"value": r["typical_mg_kg"], "unit": "mg/kg", **cite, "note": "in shoot dry matter"}
        elif prefix == "job":
            if r["job"] not in (1, 2, 3, 4):
                raise ValueError(f"{where}: job must be 1, 2, 3 or 4")
            out[key] = {"group": r["job"], **cite}
        else:
            if "known_year" not in r and "known_text" not in r:
                raise ValueError(f"{where}: known_by needs known_year or known_text")
            names = {"known_year": "year", "known_by": "by", "known_text": "text"}
            out[key] = {names[c]: r[c] for c in ("known_year", "known_by", "known_text") if c in r} | cite
    return out


def _leaf_level(r: dict) -> dict:
    where = f"plants.toml [[leaf_level]] Z={r.get('Z')!r} plant={r.get('plant')!r}"
    if extra := sorted(set(r) - LEVEL_COLUMNS):
        raise ValueError(f"{where}: unknown column(s) {', '.join(extra)}")
    if r.get("group") not in PLANT_GROUPS:
        raise ValueError(f"{where}: unknown group; use one of {', '.join(PLANT_GROUPS)}")
    if r.get("kind") not in LEVEL_KINDS:
        raise ValueError(f"{where}: unknown kind; use one of {', '.join(LEVEL_KINDS)}")
    if r.get("unit") not in TO_MG_PER_KG:
        raise ValueError(f"{where}: unit must be one of {', '.join(TO_MG_PER_KG)} (as printed)")
    if not isinstance(r.get("plant"), str) or not r["plant"].strip():
        raise ValueError(f"{where}: no plant name")
    given = [c for c in LEVEL_NUMBERS if c in r]
    need = {
        "bands": ({"adequate_low", "adequate_high"}, set()),
        "normal": ({"adequate_low", "adequate_high"}, {"deficient_below", "excess_above"}),
        "critical": ({"deficient_below"}, {"adequate_low", "adequate_high", "excess_above"}),
    }[r["kind"]]
    if missing_cols := sorted(need[0] - set(given)):
        raise ValueError(f"{where}: kind {r['kind']!r} needs {', '.join(missing_cols)}")
    if wrong := sorted(need[1] & set(given)):
        raise ValueError(f"{where}: kind {r['kind']!r} has no {', '.join(wrong)}")
    values = [r[c] for c in given]
    if any(not isinstance(v, int | float) or v <= 0 for v in values):
        raise ValueError(f"{where}: levels must be positive numbers")
    # A deficient class may end where the adequate one starts ("< 20", "20–40"); the adequate range itself
    # must have a width.
    if values != sorted(values) or r.get("adequate_low", 0) >= r.get("adequate_high", float("inf")):
        raise ValueError(f"{where}: levels must rise from deficient_below to excess_above")
    names = {"deficient_below": "deficientBelow", "adequate_low": "adequateLow", "adequate_high": "adequateHigh",
             "excess_above": "excessAbove"}  # fmt: skip
    out: dict = {"plant": r["plant"], "group": r["group"]}
    if r.get("part"):
        out["part"] = r["part"]
    out["kind"] = r["kind"]
    out |= {names[c]: _mg_per_kg(r[c], r["unit"]) for c in given}
    out |= {"unit": "mg/kg", "printedUnit": r["unit"]}
    if r.get("note"):
        out["note"] = r["note"]
    return out | _cite(r)


def plant_details(facts: list[dict], notes: list[dict], levels: list[dict]) -> dict[int, dict]:
    """{Z: biology.plants} from the three tables of plants.toml.

    The build stops, naming the row, on an unknown column, topic, group, kind, mobility or unit, a fact
    without its source, levels that do not rise, two [[plant]] rows for one element, or two leaf levels
    of one element for the same group of plants.
    """
    out: dict[int, dict] = {}
    for r in facts:
        z = _check_z(r.get("Z"), f"plants.toml [[plant]] Z={r.get('Z')!r}")
        if z in out:
            raise ValueError(f"plants.toml [[plant]] Z={z}: more than one row")
        out[z] = _plant_facts(r)
    for r in notes:
        where = f"plants.toml [[plant_note]] Z={r.get('Z')!r} topic={r.get('topic')!r}"
        z = _check_z(r.get("Z"), where)
        if extra := sorted(set(r) - NOTE_COLUMNS):
            raise ValueError(f"{where}: unknown column(s) {', '.join(extra)}")
        if r.get("topic") not in PLANT_TOPICS:
            raise ValueError(f"{where}: unknown topic; use one of {', '.join(PLANT_TOPICS)}")
        if not isinstance(r.get("text"), str) or not r["text"].strip():
            raise ValueError(f"{where}: no text")
        out.setdefault(z, {}).setdefault("notes", {}).setdefault(r["topic"], []).append(_sourced(r))
    for r in levels:
        z = _check_z(r.get("Z"), f"plants.toml [[leaf_level]] Z={r.get('Z')!r}")
        rec = out.setdefault(z, {}).setdefault("levels", [])
        level = _leaf_level(r)
        if r["group"] != "other" and any(x["group"] == r["group"] for x in rec):
            raise ValueError(f"plants.toml [[leaf_level]] Z={z}: two rows for the group {r['group']!r}")
        rec.append(level)
    for rec in out.values():
        if "notes" in rec:
            rec["notes"] = {t: rec["notes"][t] for t in PLANT_TOPICS if t in rec["notes"]}
        if "levels" in rec:
            rec["levels"].sort(key=lambda x: PLANT_GROUPS.index(x["group"]))
    return dict(sorted(out.items()))


def load_plants() -> dict[int, dict]:
    """plant_details() of the committed tools/curated/plants.toml."""
    return plant_details(*(curated.load("plants.toml", table) for table in ("plant", "plant_note", "leaf_level")))


def load_biology(report: Report) -> tuple[dict[int, dict], dict[int, dict]]:
    """(the M2 rows by Z, {Z: {table: [rows]}} for the M4 tables, plus "groups" from [[life]] and
    "plants" from plants.toml)."""
    rows = {r["Z"]: r for r in curated.load("biology.toml")}
    extras: dict[int, dict] = {}
    for table in BIOLOGY_TABLES:
        for r in curated.load("biology.toml", table):
            extras.setdefault(r["Z"], {}).setdefault(table, []).append(r)
    for z, groups in life_groups(curated.load("biology.toml", "life")).items():
        extras.setdefault(z, {})["groups"] = groups
    for z, rec in load_plants().items():
        # Uptake, typical amounts and leaf levels belong to elements plants need or benefit from; a note
        # (for example on toxicity) may concern any element.
        status = rows.get(z, {}).get("essential_plant", "no")
        if status == "no" and set(rec) - {"notes"}:
            raise ValueError(f"plants.toml Z={z}: facts or leaf levels, but biology.toml says plants do not need it")
        extras.setdefault(z, {})["plants"] = rec
    try:
        iarc = fetch_iarc.parse()
    except (SourceUnavailable, OSError) as exc:
        report.unavailable(fetch_iarc.SOURCE, str(exc))
        iarc = None
    for z, tables in extras.items():
        for r in tables.get("iarc", []):
            if iarc is None:
                r["_group"] = None
            elif r["agent"] not in iarc:
                raise ValueError(f"biology.toml: IARC lists no agent {r['agent']!r} (Z={z})")
            else:
                r["_group"] = iarc[r["agent"]]
    return rows, extras


def biology_record(row: dict | None, extra: dict | None) -> dict:
    if not row:
        out: dict = {
            "essentialPlant": "no",
            "essentialHuman": "no",
            "note": "Not known to be essential for plants or for humans.",
        }
    else:
        out = {"essentialPlant": row.get("essential_plant", "no"), "essentialHuman": row.get("essential_human", "no")}
        if row.get("plant_class"):
            out["plantClass"] = row["plant_class"]
        for side in ("plant", "human"):
            if row.get(f"{side}_role"):
                out[f"{side}Role"] = {
                    "text": row[f"{side}_role"],
                    "source": row[f"{side}_source"],
                    **({"doi": row[f"{side}_doi"]} if row.get(f"{side}_doi") else {}),
                }
        if row.get("note"):
            out["note"] = row["note"]
    extra = extra or {}
    if extra.get("groups"):
        out["groups"] = extra["groups"]
    if extra.get("plants"):
        out["plants"] = extra["plants"]
    uses = []
    for r in extra.get("isotope_use", []):
        use = {"field": r["field"], **_sourced(r)}
        if "A" in r:
            use = {"A": r["A"], **({"isomer": r["isomer"]} if r.get("isomer") else {}), **use}
        uses.append(use)
    if uses:
        out["isotopeUses"] = uses
    if extra.get("environment"):
        out["environment"] = [_sourced(r) for r in extra["environment"]]
    if extra.get("toxicity"):
        out["toxicity"] = [_sourced(r) for r in extra["toxicity"]]
    if extra.get("iarc"):
        out["iarc"] = [
            {
                "agent": r["agent"],
                "group": r["_group"]["group"],
                "volumes": r["_group"]["volumes"],
                "source": r["source"],
            }
            if r["_group"]
            else {
                "agent": r["agent"],
                "group": missing(
                    "source_unavailable_at_build", "The IARC list could not be read when the data was built."
                ),
                "source": r["source"],
            }
            for r in extra["iarc"]
        ]
    return out


# --- history ------------------------------------------------------------------------------------


def load_places(report: Report) -> dict[str, dict]:
    """{place as written in history.toml: {lat, lon, source} or a Missing}."""
    rows = curated.load("places.toml", "place")
    out: dict[str, dict] = {}
    gazetteers: dict[str, object] = {}
    for name, loader in (("natural_earth", fetch_natural_earth.places), ("geonames", fetch_geonames.places)):
        try:
            gazetteers[name] = loader()
        except (SourceUnavailable, OSError) as exc:
            report.unavailable(name, str(exc))
    for r in rows:
        g = gazetteers.get(r["gazetteer"])
        if g is None:
            out[r["place"]] = missing(
                "source_unavailable_at_build",
                f"The {r['gazetteer']} gazetteer could not be read when the data was built.",
            )
            continue
        if r["gazetteer"] == "natural_earth":
            hit = g.get((fetch_natural_earth.fold(r["name"]), fetch_natural_earth.fold(r["country"])))  # type: ignore[union-attr]
        else:
            hit = g.get(r["geonames_id"])  # type: ignore[union-attr]
        if hit is None:
            raise ValueError(f"places.toml: {r['place']!r} not found in {r['gazetteer']}")
        out[r["place"]] = {"lat": round(hit["lat"], 3), "lon": round(hit["lon"], 3), "source": r["source"]}
    return out


def history_record(row: dict | None, places: dict[str, dict]) -> dict:
    if not row:
        return {}
    out: dict = {"discovered": row["discovered"]}
    keys = {
        "discovered_text": "discoveredText",
        "discoverers": "discoverers",
        "place": "place",
        "isolated": "isolated",
        "isolated_by": "isolatedBy",
        "name_origin": "nameOrigin",
        "symbol_note": "symbolNote",
        "source": "source",
        "doi": "doi",
        "note": "note",
    }
    for k, v in keys.items():
        if row.get(k) not in (None, "", []):
            out[v] = row[k]
    if row.get("place"):
        if row["place"] not in places:
            raise ValueError(f"history.toml Z={row['Z']}: place {row['place']!r} has no row in places.toml")
        out["placeLocation"] = places[row["place"]]
    return out


# --- the world outline ----------------------------------------------------------------------------

# The map shows latitudes 60° S to 84° N (no discovery was made in Antarctica) in an equirectangular
# projection; rings are simplified to about a quarter of a degree and rounded to a tenth.
LAT_MIN, LAT_MAX = -60.0, 84.0
TOLERANCE_DEG = 0.25


def _simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas–Peucker on a ring (kept closed)."""
    if len(points) < 4:
        return points

    def dist(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0:
            return math.hypot(x - x1, y - y1)
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0.0, -1
        for k in range(i + 1, j):
            d = dist(points[k], points[i], points[j])
            if d > best:
                best, idx = d, k
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(points, keep, strict=True) if k]


def build_worldmap(report: Report) -> int:
    try:
        rings = fetch_natural_earth.land()
    except (SourceUnavailable, OSError) as exc:
        report.unavailable(fetch_natural_earth.SOURCE, str(exc))
        return 0
    paths = []
    for ring in rings:
        pts = [(lon, lat) for lon, lat in ring]
        if max(lat for _, lat in pts) < LAT_MIN:
            continue  # Antarctica
        simple = _simplify(pts, TOLERANCE_DEG)
        if len(simple) < 4:
            continue
        coords = [[round(lon, 1), round(max(LAT_MIN, min(LAT_MAX, lat)), 1)] for lon, lat in simple]
        paths.append(coords)
    doc = {
        "schemaVersion": 1,
        "source": fetch_natural_earth.SOURCE,
        "projection": "equirectangular",
        "bounds": {"lonMin": -180, "lonMax": 180, "latMin": LAT_MIN, "latMax": LAT_MAX},
        "rings": paths,
    }
    from build_details import dump_rows, validator

    validator("WorldMapFile").validate(doc)
    dump_rows(DATA_DIR / "worldmap.json", doc)
    return 1
