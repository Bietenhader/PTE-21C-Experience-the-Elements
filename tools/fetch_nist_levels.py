# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""NIST ASD energy levels of the neutral atoms (source id `nist_levels`).

One tab-delimited request per element (spectrum "<Symbol> I"), with configurations, terms, J,
uncertainties and Landé g factors. ASD answers an HTML page instead of a table when it has no
levels for a spectrum; that element then has no levels file (Missing in the app).
The whole list is cached; the build keeps the lowest levels (SPEC §10.8, cap I4) and the
ionization limit.
"""

from __future__ import annotations

import csv
import io
import urllib.parse

from common import NUM_ELEMENTS, SourceUnavailable, element_symbols, http_get, raw_path

SOURCE = "nist_levels"
URL = (
    "https://physics.nist.gov/cgi-bin/ASD/energy1.pl?de=0&spectrum={spectrum}&submit=Retrieve+Data"
    "&units=1&format=3&output=0&page_size=15&multiplet_ordered=0&conf_out=on&term_out=on&level_out=on"
    "&unc_out=1&j_out=on&lande_out=on&perc_out=on&biblio=on&temp="
)
# ASD lists neutral-atom levels up to einsteinium and a few heavier ground levels; asking for
# every element costs ~2 minutes at the polite 1 request/s and lets the data decide.
MAX_Z = 108


def filename(z: int) -> str:
    return f"levels_{z:03d}.tsv"


def fetch(refresh: bool = False) -> None:
    symbols = element_symbols()
    failures = []
    for z in range(1, MAX_Z + 1):
        url = URL.format(spectrum=urllib.parse.quote_plus(f"{symbols[z]} I"))
        try:
            http_get(SOURCE, url, filename(z), refresh=refresh)
        except SourceUnavailable as exc:
            failures.append(str(exc))
    if len(failures) == MAX_Z:
        raise SourceUnavailable(f"{SOURCE}: every request failed; first: {failures[0]}")


def _value(text: str) -> str:
    return text.strip().removeprefix("=").strip('"').strip()


def parse_table(text: str) -> dict | None:
    """{levels: [{configuration, term, J, eV, unc, prefix, suffix, lande, ref}], limit: {...}} or
    None when ASD returned no table (an HTML page)."""
    if not text.startswith("Configuration"):
        return None
    reader = csv.reader(io.StringIO(text), delimiter="\t")
    header = [h.strip() for h in next(reader)]
    col = {h: i for i, h in enumerate(header)}
    levels: list[dict] = []
    limit = None
    for row in reader:
        if not row or len(row) < 5:
            continue

        def get(name: str, row: list[str] = row) -> str:
            i = col.get(name)
            return _value(row[i]) if i is not None and i < len(row) else ""

        level = get("Level (eV)")
        if get("Term") == "Limit":
            limit = {
                "eV": level,
                "unc": get("Uncertainty (eV)"),
                "ion": get("Configuration"),
                "ref": get("Reference"),
            }
            continue
        if not level:
            continue
        levels.append(
            {
                "configuration": get("Configuration"),
                "term": get("Term"),
                "J": get("J"),
                "eV": level,
                "unc": get("Uncertainty (eV)"),
                "prefix": get("Prefix"),
                "suffix": get("Suffix"),
                "lande": get("Lande"),
                "ref": get("Reference"),
            }
        )
    return {"levels": levels, "limit": limit}


def parse() -> dict[int, dict]:
    """{Z: parsed table} for every element ASD has levels for."""
    out: dict[int, dict] = {}
    found_any = False
    for z in range(1, NUM_ELEMENTS + 1):
        path = raw_path(SOURCE, filename(z))
        if not path.exists():
            continue
        found_any = True
        table = parse_table(path.read_text(encoding="utf-8", errors="replace"))
        if table and table["levels"]:
            out[z] = table
    if not found_any:
        raise SourceUnavailable(f"{SOURCE}: nothing cached in tools/raw/{SOURCE}")
    return out
