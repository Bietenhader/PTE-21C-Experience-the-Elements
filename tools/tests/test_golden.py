# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Golden values (SPEC §11.3, §11.4, §13.1, §20)."""

from __future__ import annotations

import math
import tomllib
from decimal import Decimal

import pytest

import curated
from common import CURATED_DIR, DATA_DIR, is_missing, load_json

MADELUNG_ANOMALIES = {
    "Cr", "Cu", "Nb", "Mo", "Ru", "Rh", "Pd", "Ag", "La", "Ce",
    "Gd", "Pt", "Au", "Ac", "Th", "Pa", "U", "Np", "Cm", "Lr",
}  # fmt: skip


def test_iron_ground_state(by_symbol):
    fe = by_symbol["Fe"]
    assert fe["configuration"]["measured"] == "[Ar] 3d6 4s2"
    assert fe["groundTerm"]["term"] == "5D4"
    assert (fe["groundTerm"]["S"], fe["groundTerm"]["L"], fe["groundTerm"]["J"]) == (2, 2, 4)


def test_caesium_ie1_kj_per_mol(by_symbol):
    ie = by_symbol["Cs"]["ie1"]
    assert ie["unit"] == "kJ/mol"
    assert abs(ie["value"] - 375.7) / 375.7 < 1e-3


def test_uranium_longest_lived_isotope(by_symbol):
    assert by_symbol["U"]["mostStableMassNumber"] == 238


def test_madelung_anomaly_set(elements):
    """If NIST changes the set, this test tells us — that is the point (SPEC §11.2)."""
    flagged = {e["symbol"] for e in elements if e["configuration"]["anomalous"]}
    assert flagged == MADELUNG_ANOMALIES
    assert {e["symbol"] for e in elements if e["flags"]["madelungAnomaly"]} == MADELUNG_ANOMALIES


def test_caesium_hyperfine_defines_the_second(by_symbol):
    h = by_symbol["Cs"]["hyperfineHeadline"]
    assert h["isotope"] == 133
    assert h["splitting"]["value"] == 9_192_631_770
    assert h["splitting"]["unc"] == 0
    assert h["splitting"]["unit"] == "Hz"


def test_hyperfine_rows_consistent_with_a_constant():
    """SPEC §11.4: the splitting recomputed from A (and B) agrees with the stored one; for J = 1/2
    that is |A|(I + 1/2)."""
    rows = tomllib.loads((CURATED_DIR / "hyperfine.toml").read_text(encoding="utf-8"))["row"]
    for r in rows:
        if "A_MHz" not in r:
            continue
        width = curated.hyperfine_width_hz(r)
        if r["J"] == 0.5:
            assert width == pytest.approx(abs(r["A_MHz"]) * 1e6 * (r["I"] + 0.5), rel=1e-12)
        tolerance = max(3 * (r.get("unc_Hz") or 0), abs(r["splitting_Hz"]) * 1e-9, 1.0)
        assert abs(width - r["splitting_Hz"]) <= tolerance, r


def test_hyperfine_reasons(by_symbol):
    """The muted tile states of SPEC §7.1: I = 0, J = 0, no stable isotope, not yet compiled."""
    assert by_symbol["Ce"]["hyperfineHeadline"]["reason"] == "not_applicable"  # all natural isotopes I = 0
    assert "I = 0" in by_symbol["Ce"]["hyperfineHeadline"]["note"]
    assert by_symbol["He"]["hyperfineHeadline"]["reason"] == "not_applicable"  # ¹S₀ ground level
    assert "J = 0" in by_symbol["He"]["hyperfineHeadline"]["note"]
    assert by_symbol["Tc"]["hyperfineHeadline"]["reason"] == "no_stable_isotope"
    # not yet compiled: N-14's ground level 4S3/2 has hyperfine structure, not yet in the table
    assert by_symbol["N"]["hyperfineHeadline"]["reason"] == "not_measured"
    assert "not yet in our curated table" in by_symbol["N"]["hyperfineHeadline"]["note"]


def test_ionization_energy_flags_follow_nist_markers(by_symbol):
    assert by_symbol["H"]["ie1"]["flag"] == "calculated"  # NIST prints it in parentheses
    assert by_symbol["Md"]["ie1"]["flag"] == "interpolated"  # square brackets
    assert by_symbol["Fe"]["ie1"]["flag"] == "measured"
    # Z ≥ 109: no NIST value; a published relativistic prediction, flagged so (tools/curated/superheavy.toml)
    assert by_symbol["Og"]["ie1"]["flag"] == "predicted"
    assert by_symbol["Og"]["ie1"]["source"] != "nist_gsie"


def test_interval_elements_carry_a_sourced_display_value(elements):
    intervals = [e for e in elements if "low" in e["atomicWeight"]]
    assert {e["symbol"] for e in intervals} >= {"H", "Li", "B", "C", "N", "O", "Mg", "Si", "S", "Cl", "Br", "Tl"}
    for e in intervals:
        w = e["atomicWeight"]
        assert w["conventional"]["source"] == "ciaaw", e["symbol"]


def test_group3_default_is_lu_lr(by_symbol):
    assert (by_symbol["Lu"]["group"], by_symbol["Lu"]["block"]) == (3, "d")
    assert (by_symbol["Lr"]["group"], by_symbol["Lr"]["block"]) == (3, "d")
    assert (by_symbol["La"]["group"], by_symbol["La"]["block"]) == (None, "f")


def test_iupac_names(by_symbol):
    assert by_symbol["Cs"]["name"] == "Caesium"
    assert by_symbol["Al"]["name"] == "Aluminium"
    assert by_symbol["S"]["name"] == "Sulfur"


# --- M2: per-element files ---------------------------------------------------------------------

HBAR = 6.62607015e-34 / (2 * math.pi)  # exact (SI)
K_B = 1.380649e-23  # exact (SI)
U_KG = 1.66053906892e-27  # CODATA 2022, as in src/physics/constants.ts


def _detail(z: int) -> dict:
    return load_json(DATA_DIR / "elements" / f"{z}.json")


def _isotope(z: int, a: int) -> dict:
    return next(i for i in load_json(DATA_DIR / "isotopes" / f"{z}.json")["isotopes"] if i["A"] == a)


def test_rubidium_87_d2_cooling_limits_from_the_data():
    """SPEC §11.3 golden test (Steck): T_D ≈ 145.6 μK, T_r ≈ 362 nK, v_r ≈ 5.88 mm/s within 0.5 %,
    computed from the stored wavelength, linewidth and isotope mass."""
    row = next(r for r in _detail(37)["amo"]["laserCooling"] if r["A"] == 87 and r["charge"] == 0)
    lam = row["wavelength"]["value"] * 1e-9
    assert row["wavelength"]["unit"] == "nm" and row["gamma"]["unit"] == "MHz"
    gamma = 2 * math.pi * row["gamma"]["value"] * 1e6
    mass = _isotope(37, 87)["mass"]["value"] * U_KG
    k = 2 * math.pi / lam
    assert HBAR * gamma / (2 * K_B) == pytest.approx(145.6e-6, rel=5e-3)
    assert HBAR**2 * k**2 / (mass * K_B) == pytest.approx(362e-9, rel=5e-3)
    assert HBAR * k / mass == pytest.approx(5.88e-3, rel=5e-3)


def test_hydrogen_ground_hyperfine(by_symbol):
    """SPEC §11.4: H-1 1 420 405 751.768(2) Hz, test tolerance 1 Hz."""
    h = by_symbol["H"]["hyperfineHeadline"]
    assert h["isotope"] == 1
    assert abs(h["splitting"]["value"] - 1_420_405_751.768) <= 1


def test_rubidium_87_hyperfine_is_the_bipm_value():
    """SPEC §11.4: Rb-87 agrees with the BIPM list (metrology.json) to 1 mHz."""
    row = next(h for h in _detail(37)["amo"]["hyperfine"] if h["A"] == 87)
    clock = next(
        c
        for c in load_json(DATA_DIR / "metrology.json")["clocks"]
        if c["species"] == "87Rb" and c["label"] == "6.835 GHz"
    )
    assert abs(Decimal(row["splitting"]["text"]) - Decimal(clock["frequency"]["text"])) <= Decimal("0.001")
    assert Decimal(row["splitting"]["text"]) == pytest.approx(Decimal("6834682610.9043126"), abs=Decimal("0.001"))


def test_spinless_nuclei_have_no_moments():
    """A nucleus with I = 0 has no magnetic dipole and no quadrupole moment; I = 1/2 has no quadrupole."""
    for path in (DATA_DIR / "isotopes").glob("*.json"):
        for iso in load_json(path)["isotopes"]:
            jp = (iso.get("jp") or "").strip("()")
            if jp[:1] == "0" and not jp.startswith("0."):
                assert is_missing(iso["mu"]), (path.name, iso["A"])
                assert is_missing(iso["Q"]), (path.name, iso["A"])
            if jp.startswith("1/2"):
                assert is_missing(iso["Q"]), (path.name, iso["A"])


def test_oxygen_16_has_no_moment_but_oxygen_17_does():
    """The IAEA ground-state CSV attaches an excited state's moment to O-16; the level table does not."""
    assert is_missing(_isotope(8, 16)["mu"])
    assert _isotope(8, 17)["mu"]["value"] == pytest.approx(-1.8935, abs=1e-3)


def test_every_element_file_names_its_cosmic_origin_and_crystal(by_symbol):
    for z in range(1, 119):
        d = _detail(z)
        assert "origin" in d["nucleus"] and "crystal" in d["physical"]
    fe = _detail(26)
    assert fe["physical"]["crystal"]["pearson"] == "cI2"
    assert sum(fe["nucleus"]["origin"]["fractions"].values()) == pytest.approx(1)
    assert fe["nucleus"]["origin"]["flag"] == "estimated"


def test_cie_standard_observer():
    """SPEC §11.6: the CIE 1931 2° observer on the 5 nm grid; ȳ = 1 at 555 nm, x̄(600) = 1.0622."""
    cie = load_json(DATA_DIR / "cie1931.json")
    assert (cie["start"], cie["step"], len(cie["y"])) == (380, 5, 81)
    assert cie["y"][(555 - 380) // 5] == 1.0
    assert cie["x"][(600 - 380) // 5] == pytest.approx(1.0622, abs=1e-6)
    assert max(cie["y"]) == 1.0
