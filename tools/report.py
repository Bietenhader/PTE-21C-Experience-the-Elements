# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Write PROVENANCE.md, CREDITS.md and public/data/coverage.json from the committed data, and run
the licence audit (SPEC §6.4, §15.3–15.4).

    python tools/report.py           regenerate the three files and audit
    python tools/report.py --check   fail if any of them is out of date or the audit fails (CI)

The coverage table counts, per field, how many of the 118 elements have a value rather than a
Missing; the About page shows the same table (coverage.json).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build
from common import DATA_DIR, NUM_ELEMENTS, REPO_ROOT, is_missing, load_json

# SPEC §15.3 allow-list for images (names as recorded in credits).
IMAGE_LICENCE_ALLOW = {
    "Public domain",
    "CC0 1.0",
    "CC BY 2.0",
    "CC BY 2.5",
    "CC BY 3.0",
    "CC BY 4.0",
    "CC BY-SA 2.0",
    "CC BY-SA 2.5",
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
    "FAL 1.3",
    "GFDL 1.2",
    "GFDL 1.3",
}
FORBIDDEN = re.compile(r"\b(NC|ND)\b|all rights reserved|©", re.IGNORECASE)

# (label, group, test) — `test(entry, detail)` is True when the element has the value.
INDEX_FIELDS = [
    ("Standard atomic weight (or most-stable mass number)", "atomicWeight", "mass"),
    ("Ground configuration (NIST)", "configuration", "config"),
    ("Ground configuration (NIST or published prediction)", "configuration", "config_any"),
    ("Ground term / level (NIST)", "groundTerm", "nist"),
    ("Ground term / level (NIST or published prediction)", "groundTerm", None),
    ("First ionization energy (NIST)", "ie1", "nist"),
    ("First ionization energy (NIST or published prediction)", "ie1", None),
    ("Pauling electronegativity", "electronegativityPauling", None),
    ("Oxidation states", "oxidationStates", "ox"),
    ("Ground-state hyperfine headline", "hyperfineHeadline", None),
    ("Electron affinity", "electronAffinity", None),
    ("Covalent radius", "radiusCovalent", None),
    ("Van der Waals radius", "radiusVdw", None),
    ("Melting point", "meltingPoint", None),
    ("Boiling point", "boilingPoint", None),
    ("Density", "density", None),
    ("Number of stable isotopes", "stableIsotopes", None),
    ("Longest half-life (elements without a stable isotope)", "longestHalfLife", None),
    ("Photograph (not a placeholder)", "images", "photo"),
    ("Photograph or honest placeholder", "images", "images"),
]


# Why a field covers fewer than 118 elements, where the data records no Missing reason itself.
COVERAGE_NOTES = {
    "Ground configuration (NIST)": "NIST ASD stops at Z = 108; Z ≥ 109 are published predictions.",
    "Ground term / level (NIST)": "NIST ASD stops at Z = 108; Z ≥ 109 are published predictions.",
    "First ionization energy (NIST)": "NIST ASD stops at Z = 108; Z ≥ 109 are published predictions.",
    "Oxidation states": "PubChem lists none for nihonium.",
    "Photograph (not a placeholder)": "The rest show a placeholder saying why there is no photograph.",
    "Visible spectrum of the neutral atom (NIST lines)": "NIST lists no visible line of the neutral atom.",
    "Energy levels of the neutral atom (NIST)": "NIST ASD stops at Z = 108.",
    "Ionization energies, all stages listed by NIST": "NIST lists none above Z = 110.",
    "Clementi–Raimondi effective nuclear charges": "The tables cover helium to radon; hydrogen needs none.",
    "Orbital eigenvalues (NIST SRD 141)": "NIST SRD 141 covers Z = 1–92.",
    "Allen electronegativity": "Allen's configuration energies (Mann et al. 2000) cover these elements only.",
    "Hyperfine structure, any isotope or ion": "Not yet compiled for the rest, or there is none (I = 0 or J = 0).",
    "Clock or standard frequency": "Only these elements have a clock or a recommended frequency.",
    "Laser cooling": "Only these elements have been laser-cooled.",
    "Role in the SI": "Only these elements define or realize, or once defined, an SI unit.",
    "Abundance in the Earth's crust": "Not estimated for the rest (radioactive or synthetic elements).",
    "Abundance in sea water": "Not estimated for the rest: radioactive or synthetic elements, and seven rare "
    "ones (As, Rh, Pd, Te, Os, Ir, Pt).",
    "Solar-system abundance (log ε)": "Not tabulated: no long-lived isotope, or not measured.",
    "Amount in the human body": "ICRP Publication 23 gives amounts for these elements only.",
    "Crystal structure": "The Crystallography Open Database has no entry for the rest.",
    "Annual production": "USGS gives no world production for the rest (none at all for hydrogen and oxygen).",
    "Cosmic origin (nucleosynthesis)": "Not in the model (Kobayashi et al. 2020), or its figure cannot be read.",
    "Biology: a known role": "No known role in plants or humans.",
}


def has_value(e: dict, key: str, mode: str | None) -> bool:
    v = e[key]
    if mode == "mass":
        return not is_missing(v) or "mostStableMassNumber" in e
    if mode == "config":
        return v.get("source") == "nist_gsie"
    if mode == "config_any":
        return bool(v.get("measured"))
    if mode == "nist":
        return not is_missing(v) and v.get("source") == "nist_gsie"
    if mode == "ox":
        return bool(v["common"] or v["other"])
    if mode == "images":
        return bool(v)
    if mode == "photo":
        return any(img.get("kind") != "placeholder" for img in v)
    return not is_missing(v)


def detail_counts(details: dict[int, dict]) -> list[tuple[str, int, str]]:
    """(label, elements covered, source note) for the per-element files."""

    def n(test) -> int:
        return sum(1 for d in details.values() if test(d))

    def present(section: dict, key: str) -> bool:
        return key in section and not is_missing(section[key])

    rows = [
        ("Isotope records (IAEA)", len(list((DATA_DIR / "isotopes").glob("*.json"))), "iaea_livechart"),
        (
            "Visible spectrum of the neutral atom (NIST lines)",
            sum(
                1
                for f in (DATA_DIR / "spectra").glob("*.json")
                if any(ln["charge"] == 0 for ln in load_json(f)["lines"])
            ),
            "nist_lines",
        ),
        ("Energy levels of the neutral atom (NIST)", len(list((DATA_DIR / "levels").glob("*.json"))), "nist_levels"),
        (
            "Ionization energies, all stages listed by NIST",
            n(lambda d: d["em"]["ionizationEnergies"]["stages"]),
            "nist_gsie",
        ),
        ("Clementi–Raimondi effective nuclear charges", n(lambda d: d["orbitals"]["zeff"]), "clementi_zeff"),
        ("Orbital eigenvalues (NIST SRD 141)", n(lambda d: d["orbitals"]["eigenvalues"]), "nist_srd141"),
        ("Allen electronegativity", n(lambda d: not is_missing(d["em"]["en"]["allen"])), "allen_en"),
        ("Hyperfine structure, any isotope or ion", n(lambda d: d["amo"]["hyperfine"]), "hyperfine.toml"),
        ("Clock or standard frequency", n(lambda d: d["amo"]["clocks"]), "bipm_frequencies, clocks.toml"),
        ("Laser cooling", n(lambda d: d["amo"]["laserCooling"]), "lasercooling.toml"),
        ("Role in the SI", n(lambda d: d["amo"]["siHistory"]), "si_history.toml, bipm_frequencies"),
        ("Abundance in the Earth's crust", n(lambda d: present(d["physical"]["abundance"], "crust")), "pubchem"),
        ("Abundance in sea water", n(lambda d: present(d["physical"]["abundance"], "ocean")), "pubchem"),
        (
            "Solar-system abundance (log ε)",
            n(lambda d: present(d["physical"]["abundance"], "solarLogEps")),
            "lodders2025",
        ),
        ("Amount in the human body", n(lambda d: present(d["physical"]["abundance"], "body")), "icrp23"),
        ("Crystal structure", n(lambda d: present(d["physical"], "crystal")), "cod"),
        ("Annual production", n(lambda d: bool(d["physical"].get("production"))), "production.toml"),
        (
            "Cosmic origin (nucleosynthesis)",
            n(lambda d: present(d["nucleus"], "origin")),
            "kobayashi2020",
        ),
        (
            "Biology: a known role",
            n(lambda d: d["biology"].get("plantRole") or d["biology"].get("humanRole")),
            "biology.toml",
        ),
        ("History: discovery", n(lambda d: bool(d.get("history"))), "history.toml"),
        ("Our own short text", n(lambda d: bool(d.get("prose"))), "prose/{Z}.md"),
    ]
    return rows


def coverage(index: dict, details: dict[int, dict]) -> dict:
    els = index["elements"]
    fields = []
    for label, key, mode in INDEX_FIELDS:
        count = sum(has_value(e, key, mode) for e in els)
        reasons: dict[str, int] = {}
        for e in els:
            if not has_value(e, key, mode) and isinstance(e[key], dict) and is_missing(e[key]):
                reasons[e[key]["reason"]] = reasons.get(e[key]["reason"], 0) + 1
        fields.append({"label": label, "count": count, "missing": reasons, "file": "index.json"})
    for label, count, src in detail_counts(details):
        fields.append({"label": label, "count": count, "missing": {}, "file": src})
    for f in fields:
        if f["count"] < NUM_ELEMENTS and f["label"] in COVERAGE_NOTES:
            f["note"] = COVERAGE_NOTES[f["label"]]
    return {"schemaVersion": 1, "total": NUM_ELEMENTS, "fields": fields}


def provenance(index: dict, sources: dict, cov: dict) -> str:
    out = [
        "<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->",
        "<!-- GENERATED by tools/report.py — do not edit by hand. -->",
        "# PROVENANCE",
        "",
        "Every number in `public/data/` carries a `source` key from the registry below "
        "(`tools/sources.toml` → `public/data/sources.json`). Disagreements between sources and every rule the "
        "build applied are listed in [`tools/build-report.md`](tools/build-report.md); the choice of every "
        "photograph is explained in [`tools/images-report.md`](tools/images-report.md).",
        "",
        "## Sources",
        "",
        "| id | Source | Licence / terms | Retrieved | Status |",
        "|---|---|---|---|---|",
    ]
    for sid, s in sources["sources"].items():
        status = {"ok": "used", "unavailable": "**unavailable at build**", "not_yet_used": "not yet used"}[s["status"]]
        out.append(
            f"| `{sid}` | [{s['title']}]({s['url']}) | [{s['licence']}]({s['licenceUrl']}) | "
            f"{s.get('retrieved', '—' if s['kind'] != 'fetched' else 'not fetched')} | {status} |"
        )
    out += ["", "### Citations", ""]
    for sid, s in sources["sources"].items():
        if s["status"] == "ok":
            out.append(f"- `{sid}` — {s['citation']}")
    out += [
        "",
        f"## Field coverage (of {NUM_ELEMENTS} elements)",
        "",
        "| Field | Elements with a value | Missing, by reason | Where |",
        "|---|---|---|---|",
    ]
    for f in cov["fields"]:
        rtxt = ", ".join(f"{r}: {c}" for r, c in sorted(f["missing"].items())) or "—"
        out.append(f"| {f['label']} | {f['count']} | {rtxt} | {f['file']} |")
    out += [
        "",
        "Predictions for Z ≥ 109 (configurations, ground levels, ionization energies) come from published "
        "relativistic calculations, are flagged *predicted* and are marked † in the app.",
        "",
    ]
    return "\n".join(out)


def credits(index: dict) -> str:
    out = [
        "<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->",
        "<!-- GENERATED by tools/report.py — do not edit by hand. -->",
        "# CREDITS",
        "",
        "Every photograph shown by PTE-21C, with its author, licence and source (SPEC §15.4). Files are resized "
        "only — never cropped or recoloured. Photographs from images-of-elements.com are by Jürgen Kummer under "
        "CC BY 3.0 unless the line says otherwise; the licence asks for a link to the element's page, given here "
        "and in the app.",
        "",
        "| Element | Title | Author | Licence | Source |",
        "|---|---|---|---|---|",
    ]
    placeholders = []
    for e in index["elements"]:
        for img in e["images"]:
            if img.get("kind") == "placeholder":
                placeholders.append(e)
                continue
            out.append(
                f"| {e['name']} | {img['title']} | {img['author']} | [{img['licence']}]({img['licenceUrl']}) | "
                f"[{img['sourceUrl'].split('//')[-1].split('/')[0]}]({img['sourceUrl']}) |"
            )
    out += [
        "",
        "## Honest placeholders",
        "",
        "These elements show a drawn card instead of a photograph (SPEC §12.5): "
        + ", ".join(e["name"] for e in placeholders)
        + ".",
        "",
        "## Fonts and software",
        "",
        "Fonts and software libraries keep their own licences; see [`NOTICE.md`](NOTICE.md).",
        "",
    ]
    return "\n".join(out)


def audit(index: dict, sources: dict) -> list[str]:
    problems = []
    for sid, s in sources["sources"].items():
        if not s.get("licence"):
            problems.append(f"source {sid} has no licence recorded")
    for e in index["elements"]:
        if not e["images"]:
            problems.append(f"{e['symbol']}: neither a photograph nor a placeholder")
        for img in e["images"]:
            if img.get("kind") == "placeholder":
                continue
            if img["licence"] not in IMAGE_LICENCE_ALLOW:
                problems.append(f"{e['symbol']}: image licence {img['licence']!r} is not on the allow-list")
            if FORBIDDEN.search(img["licence"]) or FORBIDDEN.search(img["author"]):
                problems.append(f"{e['symbol']}: image {img['file']} carries a restrictive mark")
            for key in ("title", "author", "licenceUrl", "sourceUrl", "attribution"):
                if not img.get(key):
                    problems.append(f"{e['symbol']}: image {img['file']} has no {key}")
            if img.get("source") == "images_of_elements" and "images-of-elements.com" not in img["sourceUrl"]:
                problems.append(f"{e['symbol']}: images-of-elements photo without the element-page link")
            if not (REPO_ROOT / "public" / img["file"]).exists() or not (REPO_ROOT / "public" / img["thumb"]).exists():
                problems.append(f"{e['symbol']}: image file {img['file']} is not vendored")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    index = load_json(DATA_DIR / "index.json")
    sources = load_json(DATA_DIR / "sources.json")
    details = {int(p.stem): load_json(p) for p in (DATA_DIR / "elements").glob("*.json")}
    cov = coverage(index, details)
    build.validate("CoverageFile", cov)
    files = {
        REPO_ROOT / "PROVENANCE.md": provenance(index, sources, cov),
        REPO_ROOT / "CREDITS.md": credits(index),
        DATA_DIR / "coverage.json": json.dumps(cov, ensure_ascii=False, indent=1) + "\n",
    }
    status = 0
    for path, text in files.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                print(f"{path.name} is out of date: run python tools/report.py")
                status = 1
        else:
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.name}")
    problems = audit(index, sources)
    for p in problems:
        print(f"LICENCE AUDIT: {p}")
    if problems:
        status = 1
    else:
        print("licence audit: ok")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
