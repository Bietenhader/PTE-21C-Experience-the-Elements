# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""GeoNames (source id `geonames`, CC BY 4.0): coordinates of the discovery places that are too small
for the Natural Earth populated places (SPEC §10.11), e.g. Ytterby's neighbour towns, Dubna or Wako.

The bulk file cities5000 (every populated place with at least 5000 inhabitants) is downloaded once
and cached; places.toml names each place by its GeoNames id, so no coordinate is typed by hand.
"""

from __future__ import annotations

import io
import zipfile

from common import SourceUnavailable, http_get, raw_path

SOURCE = "geonames"
URL = "https://download.geonames.org/export/dump/cities5000.zip"
FILE = "cities5000.zip"


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)


def places() -> dict[int, dict]:
    """{geonameid: {name, asciiname, country, admin1, lat, lon, population}}."""
    path = raw_path(SOURCE, FILE)
    if not path.exists():
        raise SourceUnavailable(f"{SOURCE}: {FILE} is not cached in tools/raw/{SOURCE}")
    with zipfile.ZipFile(path) as z:
        text = z.read("cities5000.txt").decode("utf-8")
    out: dict[int, dict] = {}
    for line in io.StringIO(text):
        f = line.rstrip("\n").split("\t")
        if len(f) < 15:
            continue
        out[int(f[0])] = {
            "name": f[1],
            "asciiname": f[2],
            "country": f[8],
            "admin1": f[10],
            "lat": float(f[4]),
            "lon": float(f[5]),
            "population": int(f[14] or 0),
        }
    return out
