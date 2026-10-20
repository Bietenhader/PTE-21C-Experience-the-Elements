# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""IUPAC CIAAW standard and abridged atomic weights (source id `ciaaw`).

Not in the SPEC §6.1 list; added in M0 because NIST AWIC gives no single display value for
interval elements and still carries the IUPAC 2013 table. See docs/approach.md.
"""

from __future__ import annotations

import html
import re

from common import http_get, raw_path

SOURCE = "ciaaw"
STANDARD_URL = "https://www.ciaaw.org/atomic-weights.htm"
ABRIDGED_URL = "https://www.ciaaw.org/abridged-atomic-weights.htm"

_ROW = re.compile(r"<tr><td>(\d+)</td><td>([A-Z][a-z]?)</td><td>(.*?)</td><td>(.*?)</td>", re.S)


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, STANDARD_URL, "standard.htm", refresh=refresh)
    http_get(SOURCE, ABRIDGED_URL, "abridged.htm", refresh=refresh)


def _rows(filename: str) -> dict[int, str]:
    text = raw_path(SOURCE, filename).read_text(encoding="utf-8", errors="replace")
    out = {}
    for z, _sym, _name, value in _ROW.findall(text):
        v = html.unescape(re.sub(r"<[^>]+>", "", value))
        out[int(z)] = re.sub(r"[\s  ]+", "", v)
    return out


def parse() -> dict[int, dict]:
    """{Z: {standard: '[1.00784,1.00811]' | '55.845(2)' | None, abridged: (value, ±) | None}}."""
    standard = _rows("standard.htm")
    abridged = _rows("abridged.htm")
    out: dict[int, dict] = {}
    for z in sorted(set(standard) | set(abridged)):
        std = standard.get(z)
        abr = abridged.get(z)
        m = re.fullmatch(r"([\d.]+)±([\d.]+)", abr or "")
        out[z] = {
            "standard": None if std in (None, "—", "") else std,
            "abridged": (float(m.group(1)), float(m.group(2)), m.group(1)) if m else None,
        }
    return out
