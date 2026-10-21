# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Build the per-element files the sheet loads on demand (SPEC §5, §10, §14):

    public/data/isotopes/{Z}.json   IAEA ground states of every known nuclide of the element
    public/data/spectra/{Z}.json    NIST visible lines of the neutral atom and the singly charged ion
    public/data/levels/{Z}.json     NIST lowest energy levels of the neutral atom, ionization limit

Bulk tables carry one `source` for the file and plain numbers in the units the file declares;
single values elsewhere are full Quantities. Reads tools/raw/ only, never the network.
"""

from __future__ import annotations

import json
import math
import re
from decimal import Decimal
from pathlib import Path

import jsonschema

import fetch_iaea
import fetch_nist_levels
import fetch_nist_lines
from common import (
    DATA_DIR,
    NUM_ELEMENTS,
    SCHEMA_DIR,
    TOOLS_DIR,
    Report,
    SourceUnavailable,
    dump_json,
    load_json,
    missing,
    quantity,
)

# SPEC §10.8 and IMPLEMENTER'S CHOICE I4 (docs/approach.md): caps per species.
LINE_CAP = 400
LEVEL_CAP = 60
SPECIES_LABEL = {0: "I", 1: "II"}

_SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def dump_rows(path: Path, obj: dict) -> None:
    """JSON with one array item per line: small, and still readable in a diff."""
    path.parent.mkdir(parents=True, exist_ok=True)
    parts = []
    for key, value in obj.items():
        if isinstance(value, list) and value:
            body = ",\n".join("  " + json.dumps(v, ensure_ascii=False, separators=(",", ":")) for v in value)
            parts.append(f"{json.dumps(key)}:[\n{body}\n]")
        else:
            parts.append(f"{json.dumps(key)}:{json.dumps(value, ensure_ascii=False, separators=(',', ':'))}")
    path.write_text("{\n" + ",\n".join(parts) + "\n}\n", encoding="utf-8")


def validator(definition: str) -> jsonschema.Draft7Validator:
    schema = load_json(SCHEMA_DIR / "pte.schema.json")
    return jsonschema.Draft7Validator({"$ref": f"#/definitions/{definition}", "definitions": schema["definitions"]})


def clear(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.json"):
        old.unlink()


# --- isotopes -------------------------------------------------------------------------------

LIMIT_WORDS = {"GT": "more than", "GE": "at least", "LT": "less than"}
OPERATOR_TEXT = {"GT": ">", "GE": "≥", "LT": "<", "AP": "≈"}


def half_life(rec: dict) -> tuple[dict | None, str | None]:
    hl = rec["halfLife"]
    if hl is None:
        return None, None
    op = hl["operator"]
    text = " ".join(x for x in (OPERATOR_TEXT.get(op, ""), hl["text"], hl["unit"]) if x)
    if hl["s"] is None:
        return missing("not_measured", "IAEA lists no half-life for this nuclide."), text or None
    if op in LIMIT_WORDS:
        return (
            missing(
                "not_measured", f"Only a limit is known: the half-life is {LIMIT_WORDS[op]} {hl['text']} {hl['unit']}."
            ),
            text,
        )
    note = None
    if op == "AP":
        note = "Approximate value."
    if hl["unit"] in ("eV", "keV", "MeV"):
        note = f"IAEA gives a level width of {hl['text']} {hl['unit']}; this is the half-life it implies."
    return quantity(hl["s"], "s", "iaea_livechart", unc=hl["unc"] or None, note=note), text


def isotope_record(rec: dict) -> dict:
    src = "iaea_livechart"
    out: dict = {"A": rec["A"], "N": rec["N"], "stable": rec["stable"]}
    hl, text = half_life(rec)
    if hl is not None:
        out["halfLife"] = hl
    if text:
        out["halfLifeText"] = text
    out["jp"] = rec["jp"]
    out["I"] = rec["I"] if rec["I"] is not None else missing("not_measured", "No spin assignment in ENSDF.")
    out["decays"] = [
        {
            "mode": d["mode"],
            "branching": quantity(d["percent"], "%", src, unc=d["unc"] or None)
            if d["percent"] is not None
            else missing("not_measured", "The decay mode is observed; its branching ratio is not given."),
        }
        for d in rec["decays"]
    ]
    if rec["abundance"] is not None:
        out["abundance"] = quantity(rec["abundance"], "%", src, unc=rec["abundanceUnc"] or None)
    else:
        out["abundance"] = missing("not_applicable", "Not part of the natural isotopic composition.")
    mass = Decimal(rec["massMicroU"]) / Decimal(10**6) if rec["massMicroU"] else None
    est = {"flag": "estimated", "note": "Atomic Mass Evaluation estimate from systematic trends."}
    extra = est if rec["massSystematics"] else {}
    if mass is not None:
        unc = rec["massUncMicroU"] / 1e6 if rec["massUncMicroU"] else None
        out["mass"] = quantity(float(mass), "u", src, unc=unc, **extra)
    else:
        out["mass"] = missing("not_measured", "No atomic mass in the evaluation.")
    out["massExcess"] = (
        quantity(rec["massExcessKeV"], "keV", src, unc=rec["massExcessUnc"] or None, **extra)
        if rec["massExcessKeV"] is not None
        else missing("not_measured", "No mass excess in the evaluation.")
    )
    out["bindingPerNucleon"] = (
        quantity(rec["bindingKeV"], "keV", src, unc=rec["bindingUnc"] or None, **extra)
        if rec["bindingKeV"] is not None
        else missing("not_measured", "No binding energy in the evaluation.")
    )
    spin = rec["I"]
    if rec["mu"] is not None:
        out["mu"] = quantity(rec["mu"], "μ_N", src, unc=rec["muUnc"] or None)
    elif spin == 0:
        out["mu"] = missing("not_applicable", "I = 0: a spinless nucleus has no magnetic dipole moment.")
    else:
        out["mu"] = missing("not_measured", "No measured magnetic dipole moment.")
    if rec["Q"] is not None:
        out["Q"] = quantity(rec["Q"], "b", src, unc=rec["QUnc"] or None)
    elif spin is not None and spin < 1:
        out["Q"] = missing(
            "not_applicable", f"I = {'0' if spin == 0 else '1/2'}: no electric quadrupole moment (needs I ≥ 1)."
        )
    else:
        out["Q"] = missing("not_measured", "No measured electric quadrupole moment.")
    if rec["radius"] is not None:
        out["chargeRadius"] = quantity(rec["radius"], "fm", src, unc=rec["radiusUnc"] or None)
    if rec["discovery"]:
        out["discoveryYear"] = rec["discovery"]
    return out


def build_isotopes(iaea: dict[int, list[dict]], symbols: dict[int, str], report: Report) -> int:
    folder = DATA_DIR / "isotopes"
    clear(folder)
    check = validator("IsotopesFile")
    written = 0
    for z in range(1, NUM_ELEMENTS + 1):
        recs = iaea.get(z)
        if not recs:
            report.add("Coverage notes", f"Z={z}: IAEA lists no nuclide.")
            continue
        doc = {
            "schemaVersion": 1,
            "Z": z,
            "symbol": symbols[z],
            "source": "iaea_livechart",
            "isotopes": [isotope_record(r) for r in recs],
        }
        check.validate(doc)
        dump_rows(folder / f"{z}.json", doc)
        written += 1
    return written


# --- spectra --------------------------------------------------------------------------------

_LEVEL_NUM = re.compile(r"[-+]?\d+(?:\.\d+)?")


def level_ev(text: str) -> float | None:
    """NIST level energies may carry [ ] / ( ) markers or '+x' offsets; the latter are not absolute."""
    if not text or "+" in text.strip("+-")[1:] or re.search(r"[a-wyz]", text):
        return None
    m = _LEVEL_NUM.search(text)
    return float(m.group()) if m else None


def intensity_value(text: str) -> float | None:
    m = re.search(r"\d+(?:\.\d+)?", text or "")
    return float(m.group()) if m else None


def line_record(row: dict, charge: int) -> dict:
    nm = row["obs"] if row["obs"] is not None else row["ritz"]
    out: dict = {"nm": nm, "charge": charge}
    inten = intensity_value(row["intensity"])
    if inten is not None:
        out["intensity"] = inten
    if row["intensity"] and row["intensity"] != (f"{inten:g}" if inten is not None else ""):
        out["intensityText"] = row["intensity"]
    if row["Aki"] is not None:
        out["Aki"] = row["Aki"]
    for side, key in (("lower", "Ei"), ("upper", "Ek")):
        lab: dict = {k: v for k, v in row[side].items() if v}
        ev = level_ev(row[key])
        if ev is not None:
            lab["eV"] = ev
        if lab:
            out[side] = lab
    return out


def strongest(rows: list[dict], cap: int) -> list[dict]:
    """The `cap` strongest lines: by NIST relative intensity, then by A_ki for lines without one."""
    ranked = sorted(
        rows,
        key=lambda r: (
            -(intensity_value(r["intensity"]) or -1),
            -(r["Aki"] or 0),
        ),
    )
    return ranked[:cap]


def build_spectra(lines: dict, symbols: dict[int, str], report: Report) -> int:
    folder = DATA_DIR / "spectra"
    clear(folder)
    check = validator("SpectraFile")
    written = 0
    visible = lines["visible"]
    for z in range(1, NUM_ELEMENTS + 1):
        species, kept = [], []
        for charge in (0, 1):
            rows = visible.get((z, charge))
            if not rows:
                continue
            top = strongest(rows, LINE_CAP)
            kept += [line_record(r, charge) for r in top]
            species.append(
                {
                    "charge": charge,
                    "label": f"{symbols[z]} {SPECIES_LABEL[charge]}",
                    "linesInWindow": len(rows),
                    "kept": len(top),
                }
            )
        if not species:
            continue
        medium = {r["medium"] for rows in (visible.get((z, c), []) for c in (0, 1)) for r in rows}
        doc = {
            "schemaVersion": 1,
            "Z": z,
            "symbol": symbols[z],
            "source": "nist_lines",
            "window": {
                "low": fetch_nist_lines.VISIBLE[0],
                "high": fetch_nist_lines.VISIBLE[1],
                "unit": "nm",
                "medium": "air" if medium == {"air"} else "vacuum",
            },
            "units": {"nm": "nm", "Aki": "s⁻¹", "eV": "eV"},
            "lines": sorted(kept, key=lambda r: (r["nm"], r["charge"])),
            "species": species,
        }
        check.validate(doc)
        dump_rows(folder / f"{z}.json", doc)
        written += 1
    return written


# --- levels ---------------------------------------------------------------------------------


def level_record(row: dict) -> dict | None:
    if row["suffix"] or "?" in row["eV"]:
        return None  # '+x' etc.: an energy relative to an unknown level, not absolute
    ev = level_ev(row["eV"])
    if ev is None:
        return None
    out: dict = {"eV": ev}
    try:
        unc = float(row["unc"]) if row["unc"] else None
    except ValueError:
        unc = None
    if unc:
        out["unc"] = unc
    out["configuration"] = row["configuration"]
    out["term"] = row["term"]
    out["J"] = row["J"]
    out["parity"] = "odd" if "*" in row["term"] else "even"
    try:
        if row["lande"]:
            out["gJ"] = float(row["lande"])
    except ValueError:
        pass
    flag = {"[": "interpolated", "(": "calculated"}.get(row["prefix"]) or (
        "interpolated" if row["eV"].startswith("[") else "calculated" if row["eV"].startswith("(") else None
    )
    if flag:
        out["flag"] = flag
    return out


def build_levels(levels: dict, symbols: dict[int, str], report: Report) -> int:
    folder = DATA_DIR / "levels"
    clear(folder)
    check = validator("LevelsFile")
    written = 0
    for z in range(1, NUM_ELEMENTS + 1):
        table = levels.get(z)
        if not table:
            continue
        recs = [r for r in (level_record(row) for row in table["levels"]) if r]
        if not recs:
            report.add("Coverage notes", f"Z={z}: NIST levels have no absolute energies.")
            continue
        recs.sort(key=lambda r: r["eV"])
        limit = table["limit"]
        if limit and level_ev(limit["eV"]) is not None:
            unc = float(limit["unc"]) if limit["unc"] and re.fullmatch(r"[\d.eE+-]+", limit["unc"]) else None
            lim = quantity(level_ev(limit["eV"]), "eV", "nist_levels", unc=unc, note=f"Limit: {limit['ion']}.")
        else:
            lim = missing("not_measured", "NIST lists no ionization limit with the levels of this atom.")
        doc = {
            "schemaVersion": 1,
            "Z": z,
            "symbol": symbols[z],
            "source": "nist_levels",
            "units": {"eV": "eV"},
            "levelsInDatabase": len(table["levels"]),
            "levels": recs[:LEVEL_CAP],
            "ionizationLimit": lim,
        }
        check.validate(doc)
        dump_rows(folder / f"{z}.json", doc)
        written += 1
    return written


# --- main -----------------------------------------------------------------------------------


def build_details(report: Report | None = None) -> dict[str, int]:
    own_report = report is None
    report = report or Report()
    symbols = {e["Z"]: e["symbol"] for e in load_json(DATA_DIR / "index.json")["elements"]}
    counts = {}
    for name, parser, builder in (
        ("isotopes", fetch_iaea.parse_full, build_isotopes),
        ("spectra", fetch_nist_lines.parse, build_spectra),
        ("levels", fetch_nist_levels.parse, build_levels),
    ):
        try:
            data = parser()
        except (SourceUnavailable, FileNotFoundError, OSError) as exc:
            report.unavailable(name, str(exc))
            counts[name] = 0
            continue
        counts[name] = builder(data, symbols, report)
    counts["elements"] = build_elements(load_json(DATA_DIR / "index.json"), report)
    if own_report and report.sections:
        # Append this step's findings to the report build.py wrote (python tools/pipeline.py runs both).
        path = TOOLS_DIR / "build-report.md"
        text = path.read_text(encoding="utf-8") if path.exists() else report.markdown()
        if path.exists():
            text = text.replace("\nNothing to report.\n", "\n")
            for title, lines_ in report.sections.items():
                text += f"## {title}\n\n" + "".join(f"- {line}\n" for line in lines_) + "\n"
        path.write_text(text, encoding="utf-8")
    print("per-element files: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    return counts


# --- elements/{Z}.json: per-panel detail (SPEC §5, §10) ---------------------------------------

L_LETTER = "spdfghik"


def _num(text: str) -> float | None:
    m = re.search(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", text or "")
    return float(m.group()) if m else None


def ladder(stages: list[dict]) -> dict:
    """SPEC §10.2: every ionization stage NIST lists, eV as NIST gives it (the app converts)."""
    out = []
    for st in stages:
        row: dict = {"stage": st["stage"], "eV": float(st["ie_eV"])}
        if st["unc_eV"]:
            row["unc"] = float(st["unc_eV"])
        flag = {"[": "interpolated", "(": "calculated"}.get(st["prefix"])
        if flag:
            row["flag"] = flag
        out.append(row)
    return {"source": "nist_gsie", "unit": "eV", "stages": out}


def eigenvalues(page: dict, hartree_ev: Decimal) -> list[dict]:
    out = []
    for orb in page["orbitals"]:
        for method in ("LDA", "ScRLDA"):
            if method in orb["hartree"]:
                ev = float(Decimal(repr(orb["hartree"][method])) * hartree_ev)
                out.append(
                    {"n": orb["n"], "l": orb["l"], "eV": round(ev, 4), "method": method, "source": "nist_srd141"}
                )
    return out


def cooling_gamma(row: dict, windows: dict) -> dict:
    """Γ/2π of a laser-cooling line from the A_ki NIST gives for the same line (SPEC §6.2)."""
    key = next(
        (
            k
            for k in windows
            if k[0] == row["Z"] and k[1] == row.get("charge", 0) and abs(k[2] - row["wavelength_nm"]) < 1e-3
        ),
        None,
    )
    lines = windows.get(key, []) if key else []
    best = None
    for ln in lines:
        nm = ln["obs"] if ln["obs"] is not None else ln["ritz"]
        if nm is None or ln["Aki"] is None:
            continue
        d = min(abs((ln["obs"] or 1e9) - row["wavelength_nm"]), abs((ln["ritz"] or 1e9) - row["wavelength_nm"]))
        if d < 0.005 and (best is None or d < best[0]):
            best = (d, ln)
    if best is None:
        return missing("not_measured", "NIST ASD gives no transition probability for this line.")
    aki = best[1]["Aki"]
    gamma_mhz = aki / (2 * math.pi) / 1e6
    return quantity(
        float(f"{gamma_mhz:.5g}"),
        "MHz",
        "nist_lines",
        note=f"Γ/2π from NIST's A_ki = {aki:.4g} s⁻¹ (accuracy class {best[1]['acc'] or '—'}), "
        "taking the upper level to "
        "decay only on this line; where it has other decay channels the true linewidth is slightly larger.",
    )


def lasercooling_record(row: dict, windows: dict) -> dict:
    out: dict = {
        "A": row["A"],
        "charge": row.get("charge", 0),
        "state": row["state"],
        "lower": row["lower"],
        "upper": row["upper"],
        "wavelength": quantity(row["wavelength_nm"], "nm", "nist_lines", note="Vacuum wavelength, NIST ASD."),
        "gamma": cooling_gamma(row, windows),
    }
    if "repump_nm" in row:
        out["repump"] = quantity(row["repump_nm"], "nm", "nist_lines", note="Vacuum wavelength, NIST ASD.")
    for m in ("first_cooled", "first_mot", "bec", "dfg"):
        if f"{m}_year" in row:
            key = {"first_cooled": "firstCooled", "first_mot": "firstMOT", "bec": "BEC", "dfg": "DFG"}[m]
            out[key] = {"year": row[f"{m}_year"], "doi": row[f"{m}_doi"], "source": "primary_literature"}
    out["source"] = row["source"]
    if row.get("note"):
        out["note"] = row["note"]
    return out


def hyperfine_record(row: dict) -> dict:
    src = row["source"]
    out: dict = {"A": row["A"], "charge": row.get("charge", 0)}
    if "I" in row:
        out["I"] = row["I"]
    if "J" in row:
        out["J"] = row["J"]
    extra = {"doi": row["doi"]} if row.get("doi") else {}
    if "A_MHz" in row:
        out["A_MHz"] = {**quantity(row["A_MHz"], "MHz", src, unc=row.get("A_unc_MHz")), **extra}
    if "B_MHz" in row:
        out["B_MHz"] = {**quantity(row["B_MHz"], "MHz", src, unc=row.get("B_unc_MHz")), **extra}
    split = quantity(row["splitting_Hz"], "Hz", src, unc=row.get("unc_Hz"), note=row.get("note"))
    if row.get("splitting_text"):
        split["text"] = row["splitting_text"]
    out["splitting"] = {**split, **extra}
    return out


def abundance_record(pub: dict | None) -> dict:
    out = {}
    for key, label in (("crust", "Earth's crust"), ("ocean", "sea water")):
        item = (pub or {}).get(key)
        if item:
            out[key] = quantity(
                float(Decimal(f"{item['value']:.6g}")),
                item["unit"],
                "pubchem",
                flag="estimated",
                note=f"Jefferson Lab estimate for {label}, via PubChem ('{item['text']}').",
            )
    return out


def biology_record(row: dict | None) -> dict:
    if not row:
        return {
            "essentialPlant": "no",
            "essentialHuman": "no",
            "note": "Not known to be essential for plants or for humans.",
        }
    out: dict = {"essentialPlant": row.get("essential_plant", "no"), "essentialHuman": row.get("essential_human", "no")}
    if row.get("plant_class"):
        out["plantClass"] = row["plant_class"]
    for side in ("plant", "human"):
        if row.get(f"{side}_role"):
            out[f"{side}Role"] = {
                "text": row[f"{side}_role"],
                "source": row[f"{side}_source"],
                **({"doi": row[f"{side}_doi"]} if row.get(f"{side}_doi") else {}),
            }
    if row.get("note"):
        out["note"] = row["note"]
    return out


def load_prose(z: int, symbol: str) -> dict | None:
    """tools/curated/prose/{Z}.md: front matter (Z, symbol, sources) and one paragraph, own words."""
    import curated
    from common import CURATED_DIR

    path = CURATED_DIR / "prose" / f"{z}.md"
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\nZ: (\d+)\nsymbol: (\S+)\nsources: \[([^\]]*)\]\n---\n(.+?)\s*$", text, re.S)
    if not m or int(m.group(1)) != z or m.group(2) != symbol:
        raise ValueError(f"prose/{z}.md: front matter does not match Z = {z}, {symbol}")
    sources = [x.strip() for x in m.group(3).split(",") if x.strip()]
    unknown = [x for x in sources if x not in curated.registry()]
    if unknown:
        raise ValueError(f"prose/{z}.md: unknown sources {unknown}")
    body = " ".join(m.group(4).split())
    words = len(body.split())
    if not 60 <= words <= 120:
        raise ValueError(f"prose/{z}.md: {words} words (SPEC §6.2: 60–120)")
    return {"text": body, "sources": sources}


def build_elements(index: dict, report: Report) -> int:
    import curated
    import fetch_codata
    import fetch_nist_gsie
    import fetch_nist_srd141
    import fetch_pubchem
    from build_metrology import build_metrology

    elements = index["elements"]
    symbols = {e["Z"]: e["symbol"] for e in elements}

    def safe(name, fn):
        try:
            return fn()
        except (SourceUnavailable, FileNotFoundError, OSError) as exc:
            report.unavailable(name, str(exc))
            return None

    codata = safe("nist_codata", fetch_codata.parse)
    hartree_ev = codata["Hartree energy in eV"]["value"] if codata else None
    srd = safe("nist_srd141", fetch_nist_srd141.parse) or {}
    for page in srd.values():
        for problem in page["problems"]:
            report.add("NIST SRD 141", problem)
    gsie = safe("nist_gsie", fetch_nist_gsie.parse_ladder) or {}
    abundance = safe("pubchem", fetch_pubchem.parse_abundance) or {}
    lines = safe("nist_lines", fetch_nist_lines.parse) or {"windows": {}}
    metrology = build_metrology(symbols, report)

    zeff: dict[int, list] = {}
    for r in curated.load("zeff.toml"):
        zeff.setdefault(r["Z"], []).append({"n": r["n"], "l": r["l"], "value": r["zeff"], "source": r["source"]})
    allen = {r["Z"]: r for r in curated.load("electronegativity_allen.toml")}
    hfs: dict[int, list] = {}
    for r in curated.load("hyperfine.toml"):
        hfs.setdefault(r["Z"], []).append(r)
    cooling: dict[int, list] = {}
    for r in curated.load("lasercooling.toml"):
        cooling.setdefault(r["Z"], []).append(r)
    biology = {r["Z"]: r for r in curated.load("biology.toml")}

    folder = DATA_DIR / "elements"
    clear(folder)
    check = validator("ElementDetailFile")
    for e in elements:
        z = e["Z"]
        doc: dict = {"schemaVersion": 1, "Z": z, "symbol": e["symbol"]}
        orbitals: dict = {
            "zeff": sorted(zeff.get(z, []), key=lambda r: (r["n"], r["l"])),
            "eigenvalues": eigenvalues(srd[z], hartree_ev) if z in srd and hartree_ev else [],
            "radii": {"covalent": e["radiusCovalent"], "vdw": e["radiusVdw"]},
        }
        doc["orbitals"] = orbitals
        en: dict = {"pauling": e["electronegativityPauling"]}
        if z in allen:
            a = allen[z]
            en["allen"] = quantity(
                a["chi"],
                "eV",
                a["source"],
                note="Configuration energy (Allen electronegativity) in eV, not converted to the Pauling-like scale; "
                f"{a['ref']}.",
            )
        else:
            en["allen"] = missing(
                "not_measured", "Allen's configuration energies (Mann et al. 2000) do not include this element."
            )
        doc["em"] = {
            "ionizationEnergies": ladder(gsie[z]) if z in gsie else {"source": "nist_gsie", "unit": "eV", "stages": []},
            "electronAffinity": e["electronAffinity"],
            "en": en,
        }
        ref_iso = e["hyperfineHeadline"].get("isotope") if "isotope" in e["hyperfineHeadline"] else None
        doc["probability"] = (
            {"referenceIsotope": ref_iso or e.get("mostStableMassNumber")}
            if (ref_iso or e.get("mostStableMassNumber"))
            else {}
        )
        doc["physical"] = {"abundance": abundance_record(abundance.get(z))}
        amo = metrology.get(z, {"clocks": [], "siHistory": []})
        doc["amo"] = {
            "hyperfine": [
                hyperfine_record(r) for r in sorted(hfs.get(z, []), key=lambda r: (r.get("charge", 0), r["A"]))
            ],
            "clocks": amo["clocks"],
            "laserCooling": [lasercooling_record(r, lines["windows"]) for r in cooling.get(z, [])],
            "siHistory": amo["siHistory"],
        }
        doc["biology"] = biology_record(biology.get(z))
        prose = load_prose(z, e["symbol"])
        if prose:
            doc["prose"] = prose
        check.validate(doc)
        dump_json(folder / f"{z}.json", doc)
    return len(elements)


if __name__ == "__main__":
    build_details()
