# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""What PubChem's compound records say about the chemistry of each element (SPEC §10.9).

For the elemental substance of every element (found by name: iron → CID 23925, hydrogen → the H₂
record), two parts of its PubChem compound record are cached:

- "Experimental Properties", where the Hazardous Substances Data Bank (HSDB, U.S. National Library of
  Medicine; source id `hsdb`) notes stability in air and attack by acids;
- "Stability and Reactivity", where CAMEO Chemicals (U.S. NOAA; source id `cameo_chemicals`) gives the
  reactions with air and water and the reactive group.

These texts are not copied into the app: the reactivity notes in tools/curated/chemistry.toml are our
own words, and the build checks that every note citing `hsdb` or `cameo_chemicals` has such a record
behind it. The fetcher also looks up the PubChem record of every compound named in chemistry.toml
(source id `pubchem_compounds`), so the build can check its formula.

One element, or one compound, that PubChem does not have never stops the pipeline.
"""

from __future__ import annotations

import json
import re
import tomllib
import urllib.parse

from common import CURATED_DIR, NUM_ELEMENTS, SourceUnavailable, http_get, raw_path

SOURCE = "hsdb"
CAMEO = "cameo_chemicals"
COMPOUNDS = "pubchem_compounds"

CID_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON"
VIEW_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading={heading}"
FORMULA_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/property/MolecularFormula/JSON"

HSDB_NAME = "Hazardous Substances Data Bank (HSDB)"
CAMEO_NAME = "CAMEO Chemicals"
# The headings each source fills, and the part of the record they sit in.
HSDB_HEADINGS = ("Stability/Shelf Life", "Other Experimental Properties", "Reactivities and Incompatibilities")
CAMEO_HEADINGS = ("Air and Water Reactions", "Reactive Group")


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def element_names() -> dict[int, str]:
    import fetch_pubchem

    return {z: rec["name"] for z, rec in fetch_pubchem.parse().items()}


def compound_names() -> list[str]:
    """Every compound name in tools/curated/chemistry.toml that cites a PubChem record."""
    path = CURATED_DIR / "chemistry.toml"
    if not path.exists():
        return []
    names: list[str] = []
    for row in tomllib.loads(path.read_text(encoding="utf-8")).get("row", []):
        for item in row.get("compounds", []) + row.get("oxidation_examples", []):
            name = item.get("lookup", item["name"])
            if item.get("source") == COMPOUNDS and name not in names:
                names.append(name)
    return names


def fetch(refresh: bool = False) -> None:
    failed = 0
    for z, name in element_names().items():
        try:
            path = http_get(
                SOURCE, CID_URL.format(name=urllib.parse.quote(name.lower())), f"cid_{z:03d}.json", refresh=refresh
            )
            cid = json.loads(path.read_text(encoding="utf-8"))["IdentifierList"]["CID"][0]
        except (SourceUnavailable, KeyError, IndexError, ValueError):
            failed += 1
            continue
        for source, heading, prefix in (
            (SOURCE, "Experimental Properties", "properties"),
            (CAMEO, "Stability and Reactivity", "reactivity"),
        ):
            try:
                http_get(
                    source,
                    VIEW_URL.format(cid=cid, heading=urllib.parse.quote(heading)),
                    f"{prefix}_{z:03d}.json",
                    refresh=refresh,
                )
            except SourceUnavailable:
                pass  # this record has no such heading (common for the rarer elements)
    for name in compound_names():
        try:
            http_get(
                COMPOUNDS, FORMULA_URL.format(name=urllib.parse.quote(name)), f"{_slug(name)}.json", refresh=refresh
            )
        except SourceUnavailable:
            failed += 1
    if failed and failed >= NUM_ELEMENTS:
        raise SourceUnavailable(f"{SOURCE}: no PubChem record could be fetched")


def section_texts(record: dict, headings: tuple[str, ...], contributor: str) -> dict[str, list[str]]:
    """{heading: [texts]} of one contributor in a PubChem pug_view record."""
    refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in record.get("Reference", [])}
    out: dict[str, list[str]] = {}

    def walk(section: dict) -> None:
        for sub in section.get("Section", []):
            heading = sub.get("TOCHeading", "")
            if heading in headings:
                for info in sub.get("Information", []):
                    if refs.get(info.get("ReferenceNumber")) != contributor:
                        continue
                    text = " ".join(s.get("String", "") for s in info.get("Value", {}).get("StringWithMarkup", []))
                    if text and text not in out.get(heading, []):
                        out.setdefault(heading, []).append(text)
            walk(sub)

    walk(record)
    return out


def _record(source: str, filename: str) -> dict | None:
    path = raw_path(source, filename)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8")).get("Record")


def parse() -> dict:
    """{"elements": {Z: {cid, hsdb: {heading: [text]}, cameo: {...}}}, "compounds": {name: {cid, formula}}}."""
    elements: dict[int, dict] = {}
    for z in range(1, NUM_ELEMENTS + 1):
        cid_path = raw_path(SOURCE, f"cid_{z:03d}.json")
        if not cid_path.exists():
            continue
        try:
            cid = json.loads(cid_path.read_text(encoding="utf-8"))["IdentifierList"]["CID"][0]
        except (KeyError, IndexError, ValueError):
            continue
        rec: dict = {"cid": cid, "hsdb": {}, "cameo": {}}
        if props := _record(SOURCE, f"properties_{z:03d}.json"):
            rec["hsdb"] |= section_texts(props, HSDB_HEADINGS, HSDB_NAME)
        if react := _record(CAMEO, f"reactivity_{z:03d}.json"):
            rec["hsdb"] |= section_texts(react, HSDB_HEADINGS, HSDB_NAME)
            rec["cameo"] = section_texts(react, CAMEO_HEADINGS, CAMEO_NAME)
        elements[z] = rec
    compounds: dict[str, dict] = {}
    for name in compound_names():
        path = raw_path(COMPOUNDS, f"{_slug(name)}.json")
        if not path.exists():
            continue
        props = json.loads(path.read_text(encoding="utf-8")).get("PropertyTable", {}).get("Properties", [])
        if props:
            compounds[name] = {"cid": props[0]["CID"], "formula": props[0]["MolecularFormula"]}
    return {"elements": elements, "compounds": compounds}


# --- formulas --------------------------------------------------------------------------------------

_TOKEN = re.compile(r"([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)")


def formula_counts(formula: str) -> dict[str, int]:
    """'Fe2(SO4)3' → {Fe: 2, S: 3, O: 12}; '·5H2O' parts are added; charges and states are ignored."""
    total: dict[str, int] = {}
    for part in re.split(r"[·•.]", formula):
        part = re.sub(r"\((?:aq|s|l|g)\)", "", part)
        # charges: our superscripts (Fe³⁺) and PubChem's suffixes (Ac2O3-6, BiTe+)
        part = re.sub(r"[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$", "", part.strip())
        part = re.sub(r"[+\-−]\d*$", "", part)
        mult = 1
        if m := re.match(r"^(\d+)(.*)$", part):
            mult, part = int(m.group(1)), m.group(2)
        stack: list[dict[str, int]] = [{}]
        pos = 0
        while pos < len(part):
            m = _TOKEN.match(part, pos)
            if not m:
                raise ValueError(f"cannot read formula {formula!r} at {part[pos:]!r}")
            pos = m.end()
            if m.group(1):
                stack[-1][m.group(1)] = stack[-1].get(m.group(1), 0) + int(m.group(2) or 1)
            elif m.group(3):
                stack.append({})
            else:
                inner = stack.pop()
                k = int(m.group(5) or 1)
                for el, n in inner.items():
                    stack[-1][el] = stack[-1].get(el, 0) + n * k
        for el, n in stack[0].items():
            total[el] = total.get(el, 0) + n * mult
    return total


def same_formula(ours: str, pubchem: str) -> bool:
    """PubChem writes formulas in Hill order (FeCl3 → Cl3Fe); compare the element counts."""
    return formula_counts(ours) == formula_counts(pubchem)
