# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Natural Earth (source id `natural_earth`, public domain), for the history panel (SPEC §10.11).

Two GeoJSON files from the Natural Earth vector repository: the 1:110 million land polygons (the world
outline behind the discovery-place dots) and the 1:10 million populated places (the gazetteer that
gives a discovery city its coordinates). Natural Earth is in the public domain; the project asks for
a credit, which the sources registry gives.
"""

from __future__ import annotations

import json
import unicodedata

from common import SourceUnavailable, http_get, raw_path

SOURCE = "natural_earth"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
LAND = "ne_110m_land.geojson"
PLACES = "ne_10m_populated_places_simple.geojson"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, BASE + LAND, LAND, refresh=refresh)
    http_get(SOURCE, BASE + PLACES, PLACES, refresh=refresh)


def _load(name: str) -> dict:
    path = raw_path(SOURCE, name)
    if not path.exists():
        raise SourceUnavailable(f"{SOURCE}: {name} is not cached in tools/raw/{SOURCE}")
    return json.loads(path.read_text(encoding="utf-8"))


def land() -> list[list[list[float]]]:
    """Every outer ring of the land polygons, as [[lon, lat], …] (holes dropped: invisible at 110m)."""
    rings: list[list[list[float]]] = []
    for feature in _load(LAND)["features"]:
        geom = feature["geometry"]
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for polygon in polygons:
            rings.append(polygon[0])
    return rings


def fold(text: str) -> str:
    """Case- and accent-insensitive key: 'Köping' and 'Koping' match."""
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).casefold()


def places() -> dict[tuple[str, str], dict]:
    """{(folded name, folded country): {name, country, lat, lon, ne_id}} for every populated place."""
    out: dict[tuple[str, str], dict] = {}
    for feature in _load(PLACES)["features"]:
        p = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"]
        rec = {"name": p["name"], "country": p.get("adm0name") or "", "lat": lat, "lon": lon, "ne_id": p.get("ne_id")}
        for name in {p["name"], p.get("nameascii") or p["name"]}:
            out.setdefault((fold(name), fold(rec["country"])), rec)
    return out
