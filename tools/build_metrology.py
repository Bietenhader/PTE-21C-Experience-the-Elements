# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Clocks, standard frequencies and the elements' roles in the SI (SPEC §6.2, §10.6).

Combines the fetched BIPM list of standard frequencies with tools/curated/clocks.toml (caesium's
exact value, the thorium-229 nuclear transition, the timeline of the second) and
tools/curated/si_history.toml (definitions and prototypes). Writes public/data/metrology.json and
returns, per element, its clock rows and SI rows for public/data/elements/{Z}.json.
"""

from __future__ import annotations

from decimal import Decimal

import curated
import fetch_bipm
from common import DATA_DIR, Report, SourceUnavailable, dump_json, quantity

METRE_EXCLUDED = {("87Rb", "6.835 GHz"), ("176Lu+", "353.6 THz")}  # BIPM: not for the metre


def _species(item: dict) -> str:
    return item["target"]


def bipm_clock(item: dict, z: int) -> dict:
    value = Decimal(item["valueText"]).scaleb(item["unit"])
    expanded = Decimal(item["uncText"] or "0").scaleb(item["unit"])
    k = Decimal(repr(item["coverageFactor"]))
    unc = expanded / k
    note = f"BIPM recommended value, valid from {item['validFrom']}."
    if k != 1:
        note += (
            f" BIPM quotes an uncertainty of {format(expanded, 'f')} Hz with coverage factor "
            f"{item['coverageFactor']:g}; the standard uncertainty is shown."
        )
    if not item["uncText"]:
        note += " BIPM gives no uncertainty."
    freq = quantity(float(value), "Hz", "bipm_frequencies", unc=float(unc) if item["uncText"] else None, note=note)
    freq["text"] = format(value.normalize(), "f")
    return {
        "Z": z,
        "species": _species(item),
        "A": item["A"],
        "charge": item["charge"],
        "kind": "molecular" if item["molecular"] else "atomic",
        "label": item["label"],
        "transition": item["transition"],
        "srs": item["srs"],
        "metre": (item["target"], item["label"]) not in METRE_EXCLUDED,
        "frequency": freq,
    }


def curated_clock(row: dict, symbols: dict[int, str]) -> dict:
    text = row["frequency_text"]
    value = Decimal(text)
    freq = quantity(float(value), "Hz", row["source"], unc=row["unc_Hz"], flag=row.get("flag"), note=row.get("note"))
    freq["text"] = text
    for key in ("doi", "arxiv"):
        if row.get(key):
            freq[key] = row[key]
    return {
        "Z": row["Z"],
        "species": f"{row['A']}{symbols[row['Z']]}" + ("+" if row["charge"] else ""),
        "A": row["A"],
        "charge": row["charge"],
        "kind": row["kind"],
        "label": "defining frequency" if row["Z"] == 55 else "nuclear transition",
        "transition": row["transition"],
        "srs": False,
        "metre": False,
        "definesSecond": row["Z"] == 55,
        "frequency": freq,
    }


def generated_si_rows(items: list[dict], by_symbol: dict[str, int]) -> list[dict]:
    """The elements' roles that the BIPM list itself documents (never typed by hand)."""
    out = []
    for item in items:
        for symbol, a in item["elements"]:
            z = by_symbol.get(symbol)
            if z is None:
                continue
            if item["srs"]:
                role, text = "srs", f"{item['target']} ({item['label']}) is a secondary representation of the second."
            elif item["target"] == "HeNe":
                role, text = (
                    "recommended_radiation",
                    "The He–Ne laser (633 nm, helium and neon) is a recommended radiation for realizing the metre.",
                )
            elif item["target"] == "127I2":
                role, text = (
                    "recommended_radiation",
                    f"Lasers locked to iodine-127 molecules ({item['label']}) are recommended radiations "
                    "for realizing the metre.",
                )
            elif (item["target"], item["label"]) in METRE_EXCLUDED:
                role, text = (
                    "standard_frequency",
                    f"{item['target']} ({item['label']}) is a recommended standard frequency.",
                )
            else:
                role, text = (
                    "recommended_radiation",
                    f"{item['target']} ({item['label']}) is a recommended radiation for realizing the metre.",
                )
            out.append(
                {
                    "Z": z,
                    **({"A": a} if a else {}),
                    "unit": "second" if role == "srs" else "metre" if role == "recommended_radiation" else "frequency",
                    "role": role,
                    "text": text,
                    "validFrom": item["validFrom"],
                    "source": "bipm_frequencies",
                }
            )
    # One row per element and role: iodine has eight lines, the text names one.
    seen, unique = set(), []
    for r in out:
        key = (r["Z"], r["role"], r["text"] if r["role"] == "srs" else "")
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def si_row(row: dict) -> dict:
    out = {k: row[k] for k in ("Z", "unit", "role", "text", "source") if k in row}
    for key in ("A", "from", "to", "doi", "end_doi"):
        if key in row:
            out["endDoi" if key == "end_doi" else key] = row[key]
    return out


def build_metrology(symbols: dict[int, str], report: Report) -> dict[int, dict]:
    by_symbol = {v: k for k, v in symbols.items()}
    try:
        items = fetch_bipm.parse()
    except (SourceUnavailable, OSError) as exc:
        report.unavailable("bipm_frequencies", str(exc))
        items = []
    clocks = [bipm_clock(i, by_symbol[i["symbol"]]) for i in items if not i["molecular"] and i["symbol"] in by_symbol]
    clocks += [curated_clock(r, symbols) for r in curated.load("clocks.toml", "clock")]
    clocks.sort(key=lambda c: (c["Z"], c["A"] or 0, c["charge"], c["frequency"]["value"]))
    si = [si_row(r) for r in curated.load("si_history.toml")] + generated_si_rows(items, by_symbol)
    si.sort(key=lambda r: (r["Z"], r.get("from", 9999), r["unit"]))
    timeline = []
    for r in curated.load("clocks.toml", "event"):
        ev = {k: r[k] for k in ("year", "text", "source") if k in r}
        for key in ("doi", "arxiv"):
            if r.get(key):
                ev[key] = r[key]
        timeline.append(ev)
    timeline.sort(key=lambda e: e["year"])
    doc = {"schemaVersion": 1, "clocks": clocks, "siHistory": si, "timeline": timeline}
    dump_json(DATA_DIR / "metrology.json", doc)
    per: dict[int, dict] = {}
    for c in clocks:
        per.setdefault(c["Z"], {"clocks": [], "siHistory": []})["clocks"].append(c)
    for r in si:
        per.setdefault(r["Z"], {"clocks": [], "siHistory": []})["siHistory"].append(r)
    return per
