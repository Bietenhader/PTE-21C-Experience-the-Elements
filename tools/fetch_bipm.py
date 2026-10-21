# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""BIPM recommended values of standard frequencies (source id `bipm_frequencies`).

The BIPM Time Department's CCL-CCTF API serves the list as XML (NPL MeP schema): one request
for the list of (species, frequency) pairs, then one per atomic species valid on the retrieval
date. Of the molecular references only iodine (¹²⁷I₂, the absorber of the iodine-stabilized lasers)
and the He–Ne laser itself are kept, for the elements' roles in realizing the metre; CH₄, OsO₄ and
C₂H₂ are skipped.
"""

from __future__ import annotations

import html
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from common import SourceUnavailable, http_get, raw_path

SOURCE = "bipm_frequencies"
API = "https://webtai.bipm.org/api/ccl-cctf/v1.0/"
LIST_URL = API + "get_list.html"
ITEM_URL = API + "xml_auto.html?target={target}&freq={freq}&date={date}"
LIST_FILE = "list.html"

# An atom or atomic ion: mass number, element symbol, optional charge sign ("87Rb", "171Yb+", "H").
ATOMIC = re.compile(r"^(?P<A>\d+)?(?P<symbol>[A-Z][a-z]?)(?P<ion>\+)?$")
# Molecular or laser references kept, with the element(s) they stand for.
KEPT_OTHER = {"127I2": [("I", 127)], "HeNe": [("He", None), ("Ne", None)]}
NS = {"freq": "NPL_MeP_Schema", "si": "https://ptb.de/si"}
# D-SI unit strings → power of ten relative to the hertz.
HERTZ = {"\\hertz": 0, "\\kilo\\hertz": 3, "\\mega\\hertz": 6, "\\giga\\hertz": 9, "\\tera\\hertz": 12}


def item_file(target: str, freq: str) -> str:
    return "item_" + re.sub(r"[^A-Za-z0-9.]+", "_", f"{target}_{freq}") + ".xml"


def list_items() -> list[tuple[str, str]]:
    """[(species, frequency label)] from the cached list page, e.g. ('171Yb+', '642 THz')."""
    text = raw_path(SOURCE, LIST_FILE).read_text(encoding="utf-8", errors="replace")
    items = []
    for target, freq in re.findall(r"target=([^|&\"<\s]+)\|([^&\"<\s]+)&", html.unescape(text)):
        target = urllib.parse.unquote(target.replace("\\%2B", "+").replace("%2B", "+"))
        items.append((target, urllib.parse.unquote_plus(freq)))
    return sorted(set(items))


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, LIST_URL, LIST_FILE, refresh=refresh)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    for target, freq in list_items():
        if not ATOMIC.match(target) and target not in KEPT_OTHER:
            continue
        url = ITEM_URL.format(target=urllib.parse.quote(target), freq=urllib.parse.quote_plus(freq), date=date)
        http_get(SOURCE, url, item_file(target, freq), refresh=refresh)


def parse_item(text: str) -> dict | None:
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        raise ValueError("BIPM answer declares a DOCTYPE/ENTITY; refusing to parse it")
    root = ET.fromstring(text)  # no DTD (checked above), so no entity expansion
    if root.tag != f"{{{NS['freq']}}}stdfreq":
        return None
    value = root.find("freq:value/si:real/si:value", NS)
    unc = root.find("freq:value/si:real/si:expandedUnc/si:uncertainty", NS)
    k = root.find("freq:value/si:real/si:expandedUnc/si:coverageFactor", NS)
    unit = root.find("freq:value/si:real/si:unit", NS)
    if value is None or unit is None or (unit.text or "") not in HERTZ:
        raise ValueError(f"BIPM item without a frequency value: {text[:200]!r}")
    return {
        "target": root.findtext("freq:target", default="", namespaces=NS),
        "label": root.findtext("freq:freqlabel", default="", namespaces=NS),
        "validFrom": root.findtext("freq:validfrom", default="", namespaces=NS),
        "srs": root.findtext("freq:srs", default="false", namespaces=NS).strip() == "true",
        "transition": root.findtext("freq:transitionname", default="", namespaces=NS).strip(),
        "valueText": value.text.strip() if value.text else "",
        "unit": HERTZ[unit.text or ""],
        "uncText": unc.text.strip() if unc is not None and unc.text else "",
        "coverageFactor": float(k.text) if k is not None and k.text else 1.0,
    }


def parse() -> list[dict]:
    """Every kept standard frequency: [{target, A, symbol, charge, molecular, elements [(symbol, A)],
    label, validFrom, srs, transition, valueText, uncText, unit (power of ten of the hertz),
    coverageFactor}]."""
    if not raw_path(SOURCE, LIST_FILE).exists():
        raise SourceUnavailable(f"{SOURCE}: nothing cached in tools/raw/{SOURCE}")
    out = []
    for target, freq in list_items():
        m = ATOMIC.match(target)
        if not m and target not in KEPT_OTHER:
            continue
        path = raw_path(SOURCE, item_file(target, freq))
        if not path.exists():
            continue
        item = parse_item(path.read_text(encoding="utf-8"))
        if item is None:
            continue
        if m:
            item.update(
                {
                    "A": int(m.group("A")) if m.group("A") else None,
                    "symbol": m.group("symbol"),
                    "charge": 1 if m.group("ion") else 0,
                    "molecular": False,
                    "elements": [(m.group("symbol"), int(m.group("A")) if m.group("A") else None)],
                }
            )
        else:
            symbol, a = KEPT_OTHER[target][0]
            item.update({"A": a, "symbol": symbol, "charge": 0, "molecular": True, "elements": KEPT_OTHER[target]})
        out.append(item)
    if not out:
        raise SourceUnavailable(f"{SOURCE}: no atomic standard frequencies parsed")
    return out
