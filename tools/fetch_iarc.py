# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""IARC Monographs list of classifications (source id `iarc_classifications`), for the biology panel
(SPEC §10.10): the carcinogen group of the agents that are elements or element compounds.

The IARC web list is drawn by a script that carries the whole table as JavaScript object literals
({name:"…",group:"1",cas:[…],volume:[…],year:…,yeareval:…}); the fetcher caches that script and the
parser reads those literals. biology.toml names an agent exactly as IARC does; its group and volumes
come from here, never from the curated file.
"""

from __future__ import annotations

import re

from common import SourceUnavailable, http_get, raw_path

SOURCE = "iarc_classifications"
URL = "https://webapi.iarc.who.int/loc/loc.app.js"
FILE = "loc.app.js"

_ENTRY = re.compile(
    r'\{name:"(?P<name>[^"]+)",group:"(?P<group>[^"]+)"(?:,cas:\[[^\]]*\])?,volume:\[(?P<volume>[^\]]*)\],'
    r"year:(?P<year>[^,]+),yeareval:(?P<eval>[^,}]+)"
)


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, FILE, refresh=refresh)


def parse() -> dict[str, dict]:
    """{agent name: {group, volumes, year}} for every classified agent."""
    path = raw_path(SOURCE, FILE)
    if not path.exists():
        raise SourceUnavailable(f"{SOURCE}: {FILE} is not cached in tools/raw/{SOURCE}")
    text = path.read_text(encoding="utf-8", errors="replace")
    out: dict[str, dict] = {}
    for m in _ENTRY.finditer(text):
        volumes = [v.strip().strip('"') for v in m.group("volume").split(",") if v.strip()]
        year = m.group("year").strip().strip('"')
        # The script is minified: the year 2000 is written 2e3.
        if re.fullmatch(r"[\d.e]+", year):
            year = str(int(float(year)))
        out[m.group("name")] = {"group": m.group("group"), "volumes": volumes, "year": year}
    if len(out) < 500:
        raise ValueError(f"{SOURCE}: only {len(out)} agents parsed; the IARC script has changed")
    return out
