# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Golden values (SPEC §13.1, §20) that M0's data can already answer."""

from __future__ import annotations

import tomllib

from common import CURATED_DIR

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
    """SPEC §11.4: for J = 1/2 the ground splitting is A(I + 1/2); the curated file must agree."""
    rows = tomllib.loads((CURATED_DIR / "hyperfine.toml").read_text(encoding="utf-8"))["row"]
    for r in rows:
        if r["J"] == 0.5 and "A_MHz" in r:
            predicted = r["A_MHz"] * 1e6 * (r["I"] + 0.5)
            tolerance = max(r["unc_Hz"] * 3, abs(r["splitting_Hz"]) * 1e-12)
            assert abs(predicted - r["splitting_Hz"]) <= tolerance, r


def test_hyperfine_reasons(by_symbol):
    """The muted tile states of SPEC §7.1: I = 0, J = 0, no stable isotope, not yet compiled."""
    assert by_symbol["Ce"]["hyperfineHeadline"]["reason"] == "not_applicable"  # all natural isotopes I = 0
    assert "I = 0" in by_symbol["Ce"]["hyperfineHeadline"]["note"]
    assert by_symbol["He"]["hyperfineHeadline"]["reason"] == "not_applicable"  # ¹S₀ ground level
    assert "J = 0" in by_symbol["He"]["hyperfineHeadline"]["note"]
    assert by_symbol["Tc"]["hyperfineHeadline"]["reason"] == "no_stable_isotope"
    assert by_symbol["H"]["hyperfineHeadline"]["reason"] == "not_measured"


def test_ionization_energy_flags_follow_nist_markers(by_symbol):
    assert by_symbol["H"]["ie1"]["flag"] == "calculated"  # NIST prints it in parentheses
    assert by_symbol["Md"]["ie1"]["flag"] == "interpolated"  # square brackets
    assert by_symbol["Fe"]["ie1"]["flag"] == "measured"
    assert by_symbol["Og"]["ie1"]["reason"] == "predicted_only"


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
