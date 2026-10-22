# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Build public/data/index.json, public/data/sources.json and src/physics/constants.ts.

Reads only the cached raw responses (tools/raw/) and the curated TOML files; never the network.
Every emitted file is validated against schema/pte.schema.json before it is written.
Rules applied here are SPEC §5.1 (headline derivation) and §7.3 (categories); each rule that
changes or overrides a source value is written to tools/build-report.md.
"""

from __future__ import annotations

import json
import re
import tomllib
from decimal import Decimal

import jsonschema

import build_images
import curated
import fetch_bipm
import fetch_ciaaw
import fetch_codata
import fetch_iaea
import fetch_nist_awic
import fetch_nist_gsie
import fetch_pubchem
import madelung
import ptable
from common import (
    CURATED_DIR,
    DATA_DIR,
    NUM_ELEMENTS,
    REPO_ROOT,
    SCHEMA_DIR,
    TOOLS_DIR,
    Report,
    SourceUnavailable,
    dump_json,
    is_missing,
    load_json,
    missing,
    parse_concise,
    quantity,
    retrieved_date,
    round_sig,
    round_with_unc,
    sig_digits,
)

PARSERS = {
    "pubchem": fetch_pubchem.parse,
    "nist_gsie": fetch_nist_gsie.parse,
    "nist_awic": fetch_nist_awic.parse,
    "iaea_livechart": fetch_iaea.parse,
    "nist_codata": fetch_codata.parse,
    "ciaaw": fetch_ciaaw.parse,
    "bipm_frequencies": fetch_bipm.parse,
}

# PubChem "GroupBlock" → SPEC §7.3 category. PubChem separates halogens; the reference table
# (and SPEC §7.3) counts them among the reactive nonmetals.
CATEGORY = {
    "Alkali metal": "alkali-metal",
    "Alkaline earth metal": "alkaline-earth-metal",
    "Lanthanide": "lanthanide",
    "Actinide": "actinide",
    "Transition metal": "transition-metal",
    "Post-transition metal": "post-transition-metal",
    "Metalloid": "metalloid",
    "Nonmetal": "reactive-nonmetal",
    "Halogen": "reactive-nonmetal",
    "Noble gas": "noble-gas",
}
UNKNOWN_FROM_Z = 109  # SPEC §7.3: "unknown properties (Z ≥ 109 where chemistry is unmeasured)"

STATE = {"Solid": "solid", "Liquid": "liquid", "Gas": "gas"}

# IMPLEMENTER'S CHOICE I5 (docs/approach.md): NIST ASD's own definitions of its markers.
IE_FLAG = {
    "": ("measured", None),
    "[": ("interpolated", "NIST: semi-empirical value (interpolation or extrapolation)"),
    "(": ("calculated", "NIST: theoretical (ab initio) value"),
}

CONSTANTS_FOR_TS = {
    "speed of light in vacuum": "c",
    "Planck constant": "h",
    "reduced Planck constant": "hbar",
    "elementary charge": "e",
    "Boltzmann constant": "kB",
    "Avogadro constant": "NA",
    "fine-structure constant": "alpha",
    "Bohr radius": "a0",
    "electron mass": "me",
    "atomic mass constant": "u",
    "hyperfine transition frequency of Cs-133": "deltaNuCs",
    "Hartree energy in eV": "hartreeEV",
    "Rydberg constant": "RInf",
}

_SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
_SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
NNBSP = " "  # narrow no-break space, the SI digit-group separator


def group_digits(text: str) -> str:
    """'9192631770' → '9 192 631 770' (narrow no-break spaces), integer part only."""
    head, dot, tail = text.partition(".")
    sign = "-" if head.startswith("-") else ""
    head = head.lstrip("-")
    if len(head) > 4:
        head = f"{int(head):,}".replace(",", NNBSP)
    return sign + head + dot + tail


def frac(x: float) -> str:
    return str(int(x)) if x == int(x) else f"{int(round(2 * x))}/2"


def load_curated(name: str) -> list[dict]:
    rows = tomllib.loads((CURATED_DIR / name).read_text(encoding="utf-8")).get("row", [])
    for row in rows:
        if not row.get("source"):
            raise ValueError(f"{name}: row without a source: {row}")
    return rows


def load_sources_toml() -> dict[str, dict]:
    return tomllib.loads((TOOLS_DIR / "sources.toml").read_text(encoding="utf-8"))


# --- field builders -----------------------------------------------------------------------


def atomic_weight(z, awic, ciaaw, iso_best, report):
    if awic is None:
        return missing("source_unavailable_at_build", "NIST AWIC could not be read at build time.")
    std = awic[z]["standard"]
    if std is None:
        return missing("no_stable_isotope", "No standard atomic weight: the element has no stable isotope.")
    if m := re.fullmatch(r"\[(\d+)\]", std):
        note = "No standard atomic weight: the element has no stable isotope."
        if iso_best and iso_best["A"] != int(m.group(1)):
            note += (
                f" NIST AWIC quotes [{m.group(1)}]; IAEA data make {iso_best['A']} the longest-lived"
                f" isotope (t½ = {iso_best['halfLifeText']}), which is shown."
            )
            report.add(
                "Cross-checks",
                f"Z={z}: AWIC key isotope [{m.group(1)}] ≠ IAEA longest-lived "
                f"{iso_best['A']} ({iso_best['halfLifeText']}); the tile shows ({iso_best['A']}).",
            )
        return missing("no_stable_isotope", note)
    if m := re.fullmatch(r"\[([\d.]+),([\d.]+)\]", std):
        low, high = float(m.group(1)), float(m.group(2))
        out = {"low": low, "high": high, "unit": "u", "source": "nist_awic"}
        abr = ciaaw.get(z, {}).get("abridged") if ciaaw else None
        # An abridged value is rounded, so it can sit just outside the interval (O: 15.999);
        # what IUPAC guarantees is that value ± range covers the interval.
        if abr and abr[0] - abr[1] <= low and high <= abr[0] + abr[1]:
            out["conventional"] = quantity(
                abr[0],
                "u",
                "ciaaw",
                note=f"IUPAC abridged standard atomic weight {abr[2]} ± {abr[1]:g} (CIAAW), shown as the single value.",
            )
        elif abr:
            report.add(
                "Cross-checks",
                f"Z={z}: CIAAW abridged {abr[2]} ± {abr[1]:g} does not cover the AWIC interval {std}; not used.",
            )
        return out
    value, unc = parse_concise(std)
    return quantity(value, "u", "nist_awic", unc=unc)


def ionization_energy(z, gsie, ev_to_kj, predicted=None):
    if gsie is None:
        return missing("source_unavailable_at_build", "NIST ASD could not be read at build time.")
    row = gsie.get(z)
    if (row is None or not row["ie_eV"]) and predicted and "ie1_eV" in predicted:
        ev = Decimal(repr(predicted["ie1_eV"]))
        kj = float(ev * ev_to_kj)
        unc = predicted.get("ie1_unc_eV")
        if unc:
            value, unc_kj = round_with_unc(kj, float(Decimal(repr(unc)) * ev_to_kj))
            ev_txt = f"{predicted['ie1_eV']} ± {unc} eV"
        else:
            value, unc_kj = round_sig(kj, sig_digits(repr(predicted["ie1_eV"]))), None
            ev_txt = f"{predicted['ie1_eV']} eV (no uncertainty given)"
        q = quantity(
            value,
            "kJ/mol",
            predicted["source"],
            unc=unc_kj,
            flag="predicted",
            note=f"Theoretical prediction {ev_txt}, converted to kJ/mol with the exact CODATA 2022 factor. "
            + first_sentence(predicted["note"]),
        )
        if predicted.get("doi"):
            q["doi"] = predicted["doi"]
        return q
    if row is None or not row["ie_eV"]:
        return missing(
            "predicted_only",
            "NIST ASD lists no ionization energy for this element; only theoretical predictions exist.",
        )
    flag, why = IE_FLAG[row["prefix"]]
    ev = Decimal(row["ie_eV"])
    kj = float(ev * ev_to_kj)
    if row["unc_eV"]:
        unc_ev = Decimal(row["unc_eV"])
        value, unc = round_with_unc(kj, float(unc_ev * ev_to_kj))
        ev_txt = f"{row['ie_eV']} ± {row['unc_eV']} eV"
    else:
        value, unc = round_sig(kj, sig_digits(row["ie_eV"])), None
        ev_txt = f"{row['ie_eV']} eV (no uncertainty given)"
    note = f"NIST value {ev_txt}, converted to kJ/mol with the exact CODATA 2022 factor."
    if why:
        note = f"{why}. {note}"
    return quantity(value, "kJ/mol", "nist_gsie", unc=unc, flag=flag, note=note)


def electronegativity(z, pub):
    if pub is None:
        return missing("source_unavailable_at_build", "PubChem could not be read at build time.")
    text = pub[z]["electronegativity"].strip()
    if not text:
        return missing("not_measured", "PubChem lists no Pauling electronegativity for this element.")
    return quantity(float(text), "", "pubchem", note="Pauling scale")


PUBCHEM_NUMBERS = {
    # field: (PubChem column, unit, what it is, note)
    "electronAffinity": ("electronAffinity", "eV", "electron affinity", None),
    "radiusVdw": ("radiusVdw", "pm", "van der Waals radius", "Van der Waals radius (Los Alamos National Laboratory)."),
    "meltingPoint": ("meltingPoint", "K", "melting point", None),
    "boilingPoint": ("boilingPoint", "K", "boiling point", None),
    "density": ("density", "g/cm³", "density", None),
}


PROPERTY_NOTES = {(r["Z"], r["field"]): r["note"] for r in curated.load("property_notes.toml")}


def pubchem_number(z, pub, field):
    column, unit, what, note = PUBCHEM_NUMBERS[field]
    if pub is None:
        return missing("source_unavailable_at_build", "PubChem could not be read at build time.")
    text = pub[z][column].strip()
    if not text:
        return missing("not_measured", f"PubChem lists no {what} for this element.")
    extra = PROPERTY_NOTES.get((z, field))
    if extra:
        note = f"{note} {extra}" if note else extra
    return quantity(float(text), unit, "pubchem", note=note)


def covalent_radius(z, pub):
    if pub is None:
        return missing("source_unavailable_at_build", "PubChem could not be read at build time.")
    text = pub[z]["radiusCovalent"]
    if not text:
        return missing("not_measured", "PubChem lists no covalent radius for this element.")
    value, unc, tag, others = fetch_pubchem.covalent_radius(text)
    note = "Covalent radius; PubChem's values are those of Cordero et al., Dalton Trans. 2008, 2832."
    if tag:
        note += f" Value for {tag}"
        note += f"; also {others}." if others else "."
    return quantity(value, "pm", "pubchem", unc=unc, note=note)


HISTORY = {r["Z"]: r for r in curated.load("history.toml")}


def discovery(z, pub, report=None):
    """tools/curated/history.toml where it has the element (it resolves the disagreements between
    PubChem's YearDiscovered and the discovery texts and IUPAC reports); PubChem otherwise."""
    row = HISTORY.get(z)
    if row:
        out = {"text": row.get("discovered_text") or str(row["discovered"]).capitalize(), "source": row["source"]}
        if isinstance(row["discovered"], int):
            out["year"] = row["discovered"]
        if row.get("doi"):
            out["doi"] = row["doi"]
        if pub is not None and report is not None:
            text = pub[z]["yearDiscovered"].strip()
            if text.isdigit() and int(text) != out.get("year"):
                report.add(
                    "Rules applied", f"Z={z}: discovery {text} (PubChem) → {out['text']} (tools/curated/history.toml)."
                )
        return out
    if pub is None:
        return {"text": "unknown", "source": "pubchem"}
    text = pub[z]["yearDiscovered"].strip()
    if text.isdigit():
        return {"year": int(text), "text": text, "source": "pubchem"}
    return {"text": "Antiquity" if text == "Ancient" else text, "source": "pubchem"}


def isotope_summary(iso):
    """Number of stable isotopes and, for elements without one, the longest half-life (IAEA)."""
    if iso is None:
        unavailable = missing("source_unavailable_at_build", "IAEA data could not be read at build time.")
        return unavailable, unavailable
    stable = sum(1 for x in iso if x["stable"])
    count = quantity(stable, "", "iaea_livechart", note="Ground-state isotopes marked STABLE by IAEA.")
    best = longest_lived(iso)
    if stable:
        longest = missing("not_applicable", "The element has stable isotopes.")
    elif best is None:
        longest = missing("not_measured", "IAEA lists no half-life for any isotope of this element.")
    else:
        longest = quantity(
            best["halfLifeS"],
            "s",
            "iaea_livechart",
            note=f"Longest-lived isotope {best['A']} (t½ = {best['halfLifeText']}).",
        )
    return count, longest


def oxidation_states(z, pub, report):
    if pub is None:
        return {
            "common": [],
            "other": [],
            "source": "pubchem",
            "note": "PubChem could not be read at build time (source_unavailable_at_build).",
        }
    jeff, lanl = pub[z]["oxidationJefferson"], pub[z]["oxidationLANL"]
    common, _ = fetch_pubchem.oxidation_list(jeff) if jeff else ([], False)
    every, predicted = fetch_pubchem.oxidation_list(lanl) if lanl else ([], False)
    out = {"common": common, "other": [s for s in every if s not in common], "source": "pubchem"}
    if predicted:
        out["flag"] = "predicted"
    if not jeff and not lanl:
        out["note"] = "PubChem lists no oxidation states for this element."
        report.add("Coverage notes", f"Z={z}: no oxidation states in PubChem.")
    elif not jeff:
        out["note"] = "PubChem gives no main (Jefferson Lab) list; all states are Los Alamos's full list."
    return out


def configuration(z, gsie, pub, report, predicted=None):
    cfg_aufbau = madelung.aufbau(z)
    if predicted and predicted.get("configuration") and not (gsie is not None and z in gsie):
        cfg = madelung.parse(predicted["configuration"])
        source, extra = (
            predicted["source"],
            {
                "flag": "predicted",
                "note": "NIST ASD has no ground configuration for this element; this is a prediction of relativistic "
                "calculations, as collected in the cited review.",
            },
        )
        if predicted.get("doi"):
            extra["doi"] = predicted["doi"]
        if pub is not None:
            try:
                if madelung.parse(pub[z]["configuration"]) != cfg:
                    report.add(
                        "Cross-checks",
                        f"Z={z}: PubChem predicted configuration {pub[z]['configuration']!r} ≠ "
                        f"{madelung.notation(cfg)!r} (tools/curated/superheavy.toml), which is used.",
                    )
            except ValueError:
                pass
    elif gsie is not None and z in gsie:
        cfg, source, extra = gsie[z]["config"], "nist_gsie", {}
        if pub is not None:
            try:
                if madelung.parse(pub[z]["configuration"]) != cfg:
                    report.add(
                        "Cross-checks",
                        f"Z={z}: PubChem configuration {pub[z]['configuration']!r} ≠ NIST "
                        f"{madelung.notation(cfg)!r}; NIST is used (SPEC §2.5).",
                    )
            except ValueError:
                pass
    elif pub is not None:
        text = pub[z]["configuration"]
        cfg = madelung.parse(text)
        word = re.search(r"\((\w+)\)", text)
        extra = {
            "flag": "predicted",
            "note": "NIST ASD has no ground configuration for this element; PubChem (Los Alamos National "
            f"Laboratory) gives this one, marked '{word.group(1) if word else 'predicted'}'.",
        }
        source = "pubchem"
    else:
        raise SourceUnavailable(f"Z={z}: no configuration source available")
    if madelung.electrons(cfg) != z:
        raise ValueError(f"Z={z}: configuration has {madelung.electrons(cfg)} electrons")
    return cfg, {
        "measured": madelung.notation(cfg),
        "aufbau": madelung.notation(cfg_aufbau),
        "anomalous": cfg != cfg_aufbau,
        "valenceSubshells": [{"n": n, "l": l, "occupancy": k} for n, l, k in madelung.valence(cfg)],
        "source": source,
        **extra,
    }


def ground_term(z, gsie, predicted=None, cfg=None):
    if gsie is None:
        return missing("source_unavailable_at_build", "NIST ASD could not be read at build time.")
    if z not in gsie and predicted and predicted.get("ground_level"):
        level = fetch_nist_gsie.parse_level(predicted["ground_level"])
        if abs(level["J"] - predicted["J"]) > 1e-9:
            raise ValueError(f"Z={z}: superheavy.toml ground level {predicted['ground_level']} and J disagree")
        level["parity"] = "odd" if sum(k * l for (_n, l), k in cfg.items()) % 2 else "even"
        level["term"] = level["term"].replace("*", "") + ("*" if level["parity"] == "odd" else "")
        out = {**level, "source": predicted["source"], "flag": "predicted"}
        out["note"] = (
            "Predicted by relativistic calculations; NIST ASD lists no ground level for this element. "
            "The state is close to jj coupling: the LS label names the level."
        )
        if predicted.get("doi"):
            out["doi"] = predicted["doi"]
        return out
    if z not in gsie:
        return missing(
            "predicted_only", "NIST ASD lists no ground level for this element; only theoretical predictions exist."
        )
    return {**gsie[z]["level"], "source": "nist_gsie"}


def pretty_term(term: dict) -> str:
    if term["coupling"] == "LS":
        mult = int(round(2 * term["S"] + 1))
        letter = "SPDFGHIKLMNOQRTUV"[term["L"]]
        odd = "°" if term["parity"] == "odd" else ""
        return f"{str(mult).translate(_SUP)}{letter}{odd}{frac(term['J']).translate(_SUB)}"
    if term["coupling"] == "jj":
        pair, _, _j = term["term"].rpartition(")")
        return f"{pair}){'°' if term['parity'] == 'odd' else ''}{frac(term['J']).translate(_SUB)}"
    return f"J = {frac(term['J'])}"


def hyperfine_headline(z, symbol, iso, term, hfs_rows):
    """SPEC §5.1. 'Stable' is read as 'naturally occurring' (IAEA abundance > 0), so that
    primordial Bi-209, Th-232 and U-235/238 can serve as reference isotopes (docs/approach.md)."""
    if iso is None:
        return missing("source_unavailable_at_build", "IAEA data could not be read at build time.")
    natural = [x for x in iso if x["abundance"]]
    if not natural:
        return missing(
            "no_stable_isotope",
            "No naturally occurring isotope, so there is no reference isotope for a ground-state hyperfine splitting.",
        )
    if is_missing(term):
        return missing(term["reason"], "The ground level J is not available.")
    if term["J"] == 0:
        return missing(
            "not_applicable", f"The ground level has J = 0 ({pretty_term(term)}): it has no hyperfine splitting."
        )
    with_spin = [x for x in natural if x["I"]]
    if not with_spin:
        return missing("not_applicable", "I = 0 for all naturally occurring isotopes: no hyperfine structure.")
    ref = max(with_spin, key=lambda x: x["abundance"])
    row = hfs_rows.get((z, ref["A"], 0))
    if row is None:
        return missing(
            "not_measured",
            f"Reference isotope {str(ref['A']).translate(_SUP)}{symbol} (I = {frac(ref['I'])}, "
            f"J = {frac(term['J'])}) has ground-state hyperfine structure, but its splitting is not yet "
            "in our curated table (tools/curated/hyperfine.toml).",
        )
    splitting = quantity(
        row["splitting_Hz"],
        "Hz",
        row["source"],
        unc=row.get("unc_Hz"),
        flag="measured" if row.get("unc_Hz") else None,
        note=row.get("note"),
    )
    if row.get("splitting_text"):
        splitting["text"] = row["splitting_text"]
    if row.get("doi"):
        splitting["doi"] = row["doi"]
    return {"isotope": ref["A"], "splitting": splitting}


def quantum_fact(symbol, cfg_entry, cfg, term, hfs):
    if cfg_entry.get("flag") == "predicted":
        return f"Predicted ground configuration {madelung.pretty(madelung.valence(cfg))}; no measurement exists."
    if cfg_entry["anomalous"]:
        a, b = madelung.differing(cfg, madelung.aufbau(sum(cfg.values())))
        return f"Ground state {madelung.pretty(a)} — the Aufbau rule predicts {madelung.pretty(b)}."
    if not is_missing(hfs):
        s = hfs["splitting"]
        value = group_digits(f"{s['value']:.0f}" if float(s["value"]).is_integer() else repr(s["value"]))
        exact = " (exact by definition)" if s.get("unc") == 0 else ""
        return f"Ground-state hyperfine splitting of {str(hfs['isotope']).translate(_SUP)}{symbol}: {value} Hz{exact}."
    if is_missing(term):
        return "No ground level is listed by NIST for this element."
    if term["coupling"] == "LS":
        return f"Ground term {pretty_term(term)}: S = {frac(term['S'])}, L = {term['L']}, J = {frac(term['J'])}."
    if term["coupling"] == "jj":
        return f"Ground level {pretty_term(term)} in jj coupling: J = {frac(term['J'])}."
    return f"Ground level J = {frac(term['J'])}; NIST assigns no term symbol."


def longest_lived(iso):
    timed = [x for x in iso if x["halfLifeS"]]
    return max(timed, key=lambda x: x["halfLifeS"]) if timed else None


def element_flags(bipm, symbols) -> dict[int, dict]:
    """laserCooled, clockSpecies, siHistory, essentialHuman, essentialPlant from the curated tables
    and the BIPM list. A flag whose table is missing is left out (schema: never default to false)."""
    by_symbol = {v: k for k, v in symbols.items()}
    out: dict[int, dict] = {z: {} for z in range(1, NUM_ELEMENTS + 1)}
    tables = {
        "laserCooled": ("lasercooling.toml", "row", lambda r: True),
        "essentialHuman": ("biology.toml", "row", lambda r: r.get("essential_human") == "yes"),
        "essentialPlant": ("biology.toml", "row", lambda r: r.get("essential_plant") == "yes"),
    }
    for flag, (name, table, test) in tables.items():
        if not (CURATED_DIR / name).exists():
            continue
        hits = {r["Z"] for r in curated.load(name, table) if test(r)}
        for z in out:
            out[z][flag] = z in hits
    # Clock species: a secondary representation of the second in the BIPM list, the caesium
    # definition, or a measured nuclear clock transition (thorium-229).
    clock = {r["Z"] for r in curated.load("clocks.toml", "clock")}
    clock |= {by_symbol[i["symbol"]] for i in bipm or [] if i["srs"] and i["symbol"] in by_symbol}
    si = {r["Z"] for r in curated.load("si_history.toml")}
    si |= {by_symbol[s] for i in bipm or [] for s, _a in i["elements"] if s in by_symbol}
    for z in out:
        out[z]["clockSpecies"] = z in clock
        out[z]["siHistory"] = z in si
    return out


def hyperfine_rows(bipm, symbols, report) -> dict[tuple[int, int, int], dict]:
    """hyperfine.toml rows checked against their own A (and B), plus the ground-state hyperfine
    frequencies in the BIPM list (rubidium-87), which are never typed by hand."""
    rows = {}
    for r in curated.load("hyperfine.toml"):
        key = (r["Z"], r["A"], r.get("charge", 0))
        if key in rows:
            raise ValueError(f"hyperfine.toml: {key} listed twice")
        if "A_MHz" in r:
            width = curated.hyperfine_width_hz(r)
            tol = max(3 * (r.get("unc_Hz") or 0), 1e-6 * r["splitting_Hz"], 1.0)
            if abs(width - r["splitting_Hz"]) > tol:
                raise ValueError(
                    f"hyperfine.toml {key}: splitting {r['splitting_Hz']} Hz ≠ {width:.0f} Hz from A and B"
                )
        rows[key] = r
    by_symbol = {v: k for k, v in symbols.items()}
    for item in bipm or []:
        t = item["transition"]
        if item["molecular"] or item["charge"] or not re.search(r"\(F=\d+\).*\(F=\d+\)", t) or item["unit"] > 9:
            continue
        lower, _, upper = t.partition(" - ")
        if re.sub(r"\(F=\d+\)", "", lower).strip() != re.sub(r"\(F=\d+\)", "", upper).strip():
            continue  # not a hyperfine transition within one level
        z = by_symbol.get(item["symbol"])
        value = Decimal(item["valueText"]).scaleb(item["unit"])
        unc = Decimal(item["uncText"]).scaleb(item["unit"]) / Decimal(repr(item["coverageFactor"]))
        key = (z, item["A"], 0)
        if key in rows:
            report.add("Cross-checks", f"{key}: hyperfine.toml row replaced by the BIPM recommended value.")
        rows[key] = {
            "Z": z,
            "A": item["A"],
            "charge": 0,
            "splitting_Hz": float(value),
            "splitting_text": format(value, "f"),
            "unc_Hz": float(unc),
            "source": "bipm_frequencies",
            "note": f"BIPM recommended value (secondary representation of the second, valid from {item['validFrom']}).",
        }
    return rows


# --- main ---------------------------------------------------------------------------------


def build() -> int:
    report = Report()
    data: dict[str, dict | None] = {}
    for sid, parser in PARSERS.items():
        try:
            data[sid] = parser()
        except (SourceUnavailable, FileNotFoundError, OSError) as exc:
            data[sid] = None
            report.unavailable(sid, str(exc))
    pub, gsie, awic, iaea, codata, ciaaw = (
        data[k] for k in ("pubchem", "nist_gsie", "nist_awic", "iaea_livechart", "nist_codata", "ciaaw")
    )
    if codata is None:
        raise SystemExit("CODATA constants are required for unit conversion; run the fetchers first.")
    ev_to_kj = fetch_codata.ev_to_kj_per_mol(codata)

    names = {row["Z"]: row for row in load_curated("names.toml")}
    hfs_rows = hyperfine_rows(data.get("bipm_frequencies"), {z: pub[z]["symbol"] for z in pub} if pub else {}, report)
    flags = element_flags(data.get("bipm_frequencies"), {z: pub[z]["symbol"] for z in pub} if pub else {})
    superheavy: dict[int, dict] = {}
    for r in curated.load("superheavy.toml"):
        superheavy.setdefault(r["Z"], {}).update({k: v for k, v in r.items() if k != "Z"} | {"note": r["note"]})

    elements = []
    for z in range(1, NUM_ELEMENTS + 1):
        iso = iaea.get(z) if iaea else None
        symbol = pub[z]["symbol"] if pub else (iso[0]["symbol"] if iso else f"Z{z}")
        name = pub[z]["name"] if pub else symbol
        if z in names:
            report.add("Rules applied", f"Z={z}: name {name!r} → {names[z]['name']!r} ({names[z]['source']}).")
            name = names[z]["name"]

        group_block = pub[z]["groupBlock"] if pub else None
        category = CATEGORY.get(group_block, "unknown")
        if z >= UNKNOWN_FROM_Z and category != "unknown":
            report.add("Rules applied", f"Z={z}: category {group_block!r} (PubChem) → unknown (SPEC §7.3, Z ≥ 109).")
            category = "unknown"

        state_txt = pub[z]["standardState"] if pub else ""
        state = STATE.get(state_txt, "unknown")
        if state_txt.startswith("Expected"):
            report.add("Rules applied", f"Z={z}: standard state {state_txt!r} (PubChem) → unknown.")

        cfg, cfg_entry = configuration(z, gsie, pub, report, superheavy.get(z))
        term = ground_term(z, gsie, superheavy.get(z), cfg)
        best = longest_lived(iso) if iso else None
        radioactive = not any(x["stable"] for x in iso) if iso else True
        hfs = hyperfine_headline(z, symbol, iso, term, hfs_rows)
        group, _fcell = ptable.standard_position(z, "lu")

        entry = {
            "Z": z,
            "symbol": symbol,
            "name": name,
            "category": category,
            "block": ptable.block(z),
            "period": ptable.period(z),
            "group": group,
            "standardState": state,
            "atomicWeight": atomic_weight(z, awic, ciaaw, best if radioactive else None, report),
        }
        if radioactive and best:
            entry["mostStableMassNumber"] = best["A"]
        stable_count, longest = isotope_summary(iso)
        entry.update(
            {
                "radioactive": radioactive,
                "ie1": ionization_energy(z, gsie, ev_to_kj, superheavy.get(z)),
                "electronegativityPauling": electronegativity(z, pub),
                "electronAffinity": pubchem_number(z, pub, "electronAffinity"),
                "radiusCovalent": covalent_radius(z, pub),
                "radiusVdw": pubchem_number(z, pub, "radiusVdw"),
                "meltingPoint": pubchem_number(z, pub, "meltingPoint"),
                "boilingPoint": pubchem_number(z, pub, "boilingPoint"),
                "density": pubchem_number(z, pub, "density"),
                "stableIsotopes": stable_count,
                "longestHalfLife": longest,
                "discovery": discovery(z, pub, report),
                "oxidationStates": oxidation_states(z, pub, report),
                "configuration": cfg_entry,
                "groundTerm": term,
                "hyperfineHeadline": hfs,
                "quantumFact": quantum_fact(symbol, cfg_entry, cfg, term, hfs),
                "images": [],
                "flags": {
                    "madelungAnomaly": cfg_entry["anomalous"] and cfg_entry.get("flag") != "predicted",
                    **flags.get(z, {}),
                },
            }
        )
        elements.append(entry)

    images = build_images.build_images({e["Z"]: e["name"] for e in elements}, iaea, report)
    for e in elements:
        e["images"] = images[e["Z"]]

    if awic and ciaaw:
        for z in range(1, NUM_ELEMENTS + 1):
            a, c = awic[z]["standard"], ciaaw.get(z, {}).get("standard")
            if a and c and a != c:
                report.add(
                    "NIST AWIC (IUPAC 2013) vs CIAAW 2024 standard atomic weights",
                    f"{elements[z - 1]['symbol']}: AWIC {a} · CIAAW {c}",
                )
    _report_ie_flags(elements, report)

    index = {"schemaVersion": 1, "elements": elements}
    sources = build_sources(index, data)
    validate("IndexFile", index)
    validate("SourcesFile", sources)
    dump_json(DATA_DIR / "index.json", index)
    dump_json(DATA_DIR / "sources.json", sources)
    write_constants_ts(codata, ev_to_kj)
    (TOOLS_DIR / "build-report.md").write_text(report.markdown(), encoding="utf-8")
    print(f"wrote {DATA_DIR / 'index.json'} ({len(elements)} elements), sources.json, constants.ts, build-report.md")
    return 0


def first_sentence(text: str) -> str:
    """Up to the first full stop that ends a sentence (not the one in "et al.")."""
    head = re.split(r"(?<!\bal)\.\s", text, maxsplit=1)[0]
    return head if head.endswith(".") else head + "."


def _report_ie_flags(elements, report):
    for e in elements:
        q = e["ie1"]
        if not is_missing(q) and q.get("flag") not in (None, "measured"):
            why = q.get("note", "").split(".")[0]
            report.add("NIST ionization-energy markers", f"{e['symbol']}: {q['flag']} — {why}")


def _sources_used(obj, acc: set) -> set:
    if isinstance(obj, dict):
        if isinstance(obj.get("source"), str):
            acc.add(obj["source"])
        if isinstance(obj.get("sources"), list):
            acc.update(x for x in obj["sources"] if isinstance(x, str))
        for v in obj.values():
            _sources_used(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            _sources_used(v, acc)
    return acc


def build_sources(index, data):
    registry = load_sources_toml()
    used = _sources_used(index, set()) | {"nist_codata"}
    out = {}
    for sid, s in registry.items():
        entry = {
            "id": sid,
            "title": s["title"],
            "url": s["url"],
            "licence": s["licence"],
            "licenceUrl": s["licence_url"],
            "citation": s["citation"],
            "kind": s["kind"],
        }
        if sid in data and data[sid] is None:
            entry["status"] = "unavailable"
        else:
            entry["status"] = "ok" if sid in used or s.get("used_in_app") else "not_yet_used"
        if s["kind"] == "fetched" and (date := retrieved_date(sid)) and entry["status"] != "not_yet_used":
            entry["retrieved"] = date
        if s.get("notes"):
            entry["notes"] = s["notes"]
        out[sid] = entry
    unknown = used - set(registry)
    if unknown:
        raise ValueError(f"sources used but not in tools/sources.toml: {sorted(unknown)}")
    return {"schemaVersion": 1, "sources": out}


def refresh_source_status() -> set:
    """After every data file is written: mark each source used anywhere in public/data as ok.

    build() writes sources.json from index.json alone, before the per-element files, trends and
    layouts exist; this pass looks at all of them. Unavailable sources stay unavailable.
    """
    path = DATA_DIR / "sources.json"
    doc = load_json(path)
    used = {"nist_codata"}
    for f in DATA_DIR.rglob("*.json"):
        if f != path:
            _sources_used(load_json(f), used)
    registry = load_sources_toml()
    unknown = used - set(registry)
    if unknown:
        raise ValueError(f"sources used but not in tools/sources.toml: {sorted(unknown)}")
    # Registry entries added since build() wrote sources.json (in registry order).
    entries = {}
    for sid, s in registry.items():
        entries[sid] = doc["sources"].get(sid) or {
            "id": sid,
            "title": s["title"],
            "url": s["url"],
            "licence": s["licence"],
            "licenceUrl": s["licence_url"],
            "citation": s["citation"],
            "kind": s["kind"],
            "status": "not_yet_used",
            **({"notes": s["notes"]} if s.get("notes") else {}),
        }
    doc["sources"] = entries
    for sid, entry in doc["sources"].items():
        if entry["status"] == "unavailable":
            continue
        # Sources the app itself computes with (e.g. Slater's rules) count as used.
        entry["status"] = "ok" if sid in used or registry[sid].get("used_in_app") else "not_yet_used"
        # build() set the retrieval date from the cache it built from; keep it, fill it only if absent.
        if registry[sid]["kind"] == "fetched" and entry["status"] == "ok" and "retrieved" not in entry:
            if date := retrieved_date(sid):
                entry["retrieved"] = date
        if entry["status"] != "ok":
            entry.pop("retrieved", None)
        # keep the key order of build_sources (retrieved before notes)
        if "notes" in entry:
            entry["notes"] = entry.pop("notes")
    validate("SourcesFile", doc)
    dump_json(path, doc)
    return used


def validate(definition: str, obj) -> None:
    schema = load_json(SCHEMA_DIR / "pte.schema.json")
    jsonschema.Draft7Validator({"$ref": f"#/definitions/{definition}", "definitions": schema["definitions"]}).validate(
        obj
    )


def _ts_number(d: Decimal) -> str:
    """The nearest IEEE double, written so that JavaScript reads back exactly that double."""
    return repr(float(d))


def write_constants_ts(codata, ev_to_kj):
    lines = [
        "// SPDX-License-Identifier: CC-BY-NC-SA-4.0",
        "// GENERATED by tools/build.py from the NIST CODATA 2022 ASCII table (source: nist_codata). Do not edit.",
        "",
        "export interface Constant {",
        "  readonly value: number;",
        "  /** Standard uncertainty; 0 when the value is exact by definition. */",
        "  readonly unc: number;",
        "  readonly unit: string;",
        "  readonly exact: boolean;",
        "  readonly name: string;",
        "  /** CODATA's own decimal text; `value` is the nearest double to it. */",
        "  readonly text: string;",
        "}",
        "",
        "export const CODATA = {",
    ]
    for name, key in CONSTANTS_FOR_TS.items():
        c = codata[name]
        unc = "0" if c["unc"] is None else _ts_number(c["unc"])
        lines.append(
            f"  {key}: {{ value: {_ts_number(c['value'])}, unc: {unc}, unit: {json.dumps(c['unit'])}, "
            f"exact: {'true' if c['unc'] is None else 'false'}, name: {json.dumps(name)}, "
            f"text: {json.dumps(c['text'])} }},"
        )
    lines += [
        "} as const satisfies Record<string, Constant>;",
        "",
        "/** 1 eV expressed in kJ/mol: e · N_A / 1000, exact (both factors are SI defining constants).",
        f" *  Exact decimal: {ev_to_kj}; the number below is the nearest double. */",
        f"export const EV_IN_KJ_PER_MOL = {_ts_number(ev_to_kj)};",
        "",
    ]
    text = "\n".join(lines)
    (REPO_ROOT / "src" / "physics").mkdir(parents=True, exist_ok=True)
    (REPO_ROOT / "src" / "physics" / "constants.ts").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(build())
