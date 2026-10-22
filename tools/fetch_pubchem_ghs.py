# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""GHS hazard classification of each element's elemental substance, from PubChem (source id `pubchem_ghs`).

For every element: PubChem's name lookup gives the CID of the elemental substance (iron → 23925,
hydrogen → 783, the H₂ molecule), and the compound record's "GHS Classification" section lists one
block per contributor: the EU harmonised classification (CLP Regulation (EC) No 1272/2008, Annex VI)
where one exists, PubChem's aggregation of the notifications to the ECHA C&L Inventory (with the
share of reports behind each hazard statement), and national lists (Japan's NITE, Safe Work
Australia, HSDB). The build shows one block, chosen by `choose()`:

1. the EU harmonised classification, a legal classification;
2. otherwise the ECHA aggregation with the most reports, which is how PubChem summarises what
   companies notify (several aggregations exist when an element has several EC numbers);
3. otherwise the first other contributor.

An element with no GHS section in PubChem (404) is recorded as such, not refetched every run.
"""

from __future__ import annotations

import json
import re

from common import NUM_ELEMENTS, SourceUnavailable, http_get, raw_path

SOURCE = "pubchem_ghs"
NAME_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON"
GHS_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=GHS+Classification"

HARMONISED = "Regulation (EC) No 1272/2008"
ECHA = "European Chemicals Agency (ECHA)"

# The nine GHS pictograms (UN GHS, Annex 3) with the short names used on screen.
PICTOGRAMS = {
    "GHS01": "Explosive",
    "GHS02": "Flammable",
    "GHS03": "Oxidising",
    "GHS04": "Gas under pressure",
    "GHS05": "Corrosive",
    "GHS06": "Acute toxicity",
    "GHS07": "Harmful or irritant",
    "GHS08": "Health hazard",
    "GHS09": "Hazardous to the environment",
}


def _names() -> dict[int, str]:
    table = json.loads(raw_path("pubchem", "periodictable.json").read_text(encoding="utf-8"))["Table"]
    cols = table["Columns"]["Column"]
    out = {}
    for row in table["Row"]:
        cell = dict(zip(cols, row["Cell"], strict=True))
        out[int(cell["AtomicNumber"])] = cell["Name"].lower()
    return out


def cid_of(z: int) -> int | None:
    path = raw_path(SOURCE, f"cid_{z:03d}.json")
    if not path.exists():
        return None
    cids = json.loads(path.read_text(encoding="utf-8")).get("IdentifierList", {}).get("CID", [])
    return cids[0] if cids else None


def _absent(z: int, what: str) -> None:
    raw_path(SOURCE, f"ghs_{z:03d}.json").write_text(json.dumps({"absent": what}) + "\n", encoding="utf-8")


def fetch(refresh: bool = False) -> None:
    names = _names()
    failed = []
    for z in range(1, NUM_ELEMENTS + 1):
        try:
            http_get(SOURCE, NAME_URL.format(name=names[z]), f"cid_{z:03d}.json", refresh=refresh)
        except SourceUnavailable as exc:
            failed.append(f"{z} (name lookup: {exc})")
            continue
        cid = cid_of(z)
        ghs = raw_path(SOURCE, f"ghs_{z:03d}.json")
        if cid is None or (ghs.exists() and not refresh):
            continue
        try:
            http_get(SOURCE, GHS_URL.format(cid=cid), f"ghs_{z:03d}.json", refresh=refresh)
        except SourceUnavailable as exc:
            if "404" in str(exc):
                _absent(z, f"PubChem has no GHS Classification section for CID {cid}")
            else:
                failed.append(f"{z} ({exc})")
    if len(failed) == NUM_ELEMENTS:
        raise SourceUnavailable(f"{SOURCE}: every element failed, e.g. {failed[0]}")
    for line in failed:
        print(f"!!! {SOURCE}: element {line}")


# --- parsing -----------------------------------------------------------------------------------

_STATEMENT = re.compile(
    r"^(?P<code>H\d{3}[A-Za-z]*(?:\+H\d{3}[A-Za-z]*)*)(?:\s*\((?P<share>[\d.]+)%\))?:\s*(?P<text>[^\[]+?)\s*(?:\[.*\])?$"
)
_REPORTS = re.compile(r"provided per (\d+) reports|provided by (\d+) compan")
_NOT_MET = re.compile(r"does not meet GHS hazard criteria for ([\d.]+)%\s*\((\d+)\s+of\s+(\d+)\)")


def _strings(info: dict) -> list[str]:
    return [s.get("String", "") for s in info.get("Value", {}).get("StringWithMarkup", [])]


def _urls(info: dict) -> list[str]:
    return [m.get("URL", "") for s in info.get("Value", {}).get("StringWithMarkup", []) for m in s.get("Markup", [])]


def parse_statement(text: str) -> dict | None:
    """'H228 (15.5%): Flammable solid [Danger Flammable solids]' → {code, share, text}."""
    m = _STATEMENT.match(text.strip())
    if not m:
        return None
    out: dict = {"code": m["code"], "text": m["text"].strip()}
    if m["share"]:
        out["share"] = float(m["share"])
    return out


def blocks(record: dict) -> list[dict]:
    """One dict per contributor block of the GHS Classification section, in PubChem's order."""
    refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in record.get("Reference", [])}

    def find(sec: dict) -> dict | None:
        if sec.get("TOCHeading") == "GHS Classification":
            return sec
        for sub in sec.get("Section", []):
            if (hit := find(sub)) is not None:
                return hit
        return None

    section = next((hit for sec in record.get("Section", []) if (hit := find(sec)) is not None), None)
    if section is None:
        return []
    by_ref: dict[int, dict] = {}
    for info in section.get("Information", []):
        ref = info.get("ReferenceNumber")
        b = by_ref.setdefault(
            ref,
            {
                "contributor": refs.get(ref, "?"),
                "pictograms": [],
                "signal": None,
                "statements": [],
                "notClassified": False,
            },
        )
        name = info.get("Name", "")
        strings = _strings(info)
        if name == "Pictogram(s)":
            for url in _urls(info):
                if m := re.search(r"(GHS0\d)\.svg", url):
                    b["pictograms"].append(m.group(1))
        elif name == "Signal":
            b["signal"] = next((s.strip() for s in strings if s.strip() in ("Danger", "Warning")), None)
        elif name == "GHS Hazard Statements":
            for s in strings:
                if s.strip().startswith("Not Classified"):
                    b["notClassified"] = True
                elif (st := parse_statement(s)) is not None:
                    b["statements"].append(st)
        elif name == "Note":
            if m := _NOT_MET.search(" ".join(strings)):
                b["notMet"] = {"share": float(m.group(1)), "reports": int(m.group(2)), "of": int(m.group(3))}
        elif name == "ECHA C&L Notifications Summary":
            if m := _REPORTS.search(" ".join(strings)):
                b["reports"] = int(m.group(1) or m.group(2))
    return list(by_ref.values())


def choose(found: list[dict]) -> dict | None:
    """The block shown: the EU harmonised classification, else the largest ECHA aggregation, else the first."""
    if not found:
        return None
    for b in found:
        if HARMONISED in b["contributor"]:
            return b | {"basis": "eu_harmonised"}
    echa = [b for b in found if b["contributor"] == ECHA]
    if echa:
        return max(echa, key=lambda b: b.get("reports", 0)) | {"basis": "echa_notifications"}
    return found[0] | {"basis": "other"}


def parse() -> dict[int, dict]:
    """{Z: {cid, status: 'ok'|'absent', block?}} for every element whose files are cached."""
    out: dict[int, dict] = {}
    for z in range(1, NUM_ELEMENTS + 1):
        path = raw_path(SOURCE, f"ghs_{z:03d}.json")
        cid = cid_of(z)
        if not path.exists():
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        if "absent" in doc:
            out[z] = {"cid": cid, "status": "absent"}
            continue
        block = choose(blocks(doc.get("Record", {})))
        out[z] = {"cid": cid, "status": "ok" if block else "absent", "block": block}
    return out
