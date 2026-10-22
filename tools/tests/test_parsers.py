# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Pure parsing and rounding helpers — no network, no raw files."""

from __future__ import annotations

import pytest

import madelung as M
from common import parse_concise, round_with_unc, sig_digits
from fetch_iaea import parse_spin
from fetch_nist_gsie import parse_level
from fetch_pubchem import oxidation_list


@pytest.mark.parametrize(
    ("text", "value", "unc"),
    [
        ("55.845(2)", 55.845, 0.002),
        ("4.002602(2)", 4.002602, 0.000002),
        ("1.00782503223(9)", 1.00782503223, 9e-11),
        ("207.2(1)", 207.2, 0.1),
        ("12.011", 12.011, None),
        ("7.0527(11#)", 7.0527, 0.0011),
    ],
)
def test_parse_concise(text, value, unc):
    v, u = parse_concise(text)
    assert v == value
    assert u == pytest.approx(unc) if unc is not None else u is None


def test_round_with_unc_keeps_two_significant_digits():
    assert round_with_unc(375.70389, 0.0000164) == (375.7038900, 0.000016)
    assert sig_digits("0.00012") == 2 and sig_digits("13.598") == 5


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2S<1/2>", {"term": "2S1/2", "coupling": "LS", "S": 0.5, "L": 0, "J": 0.5, "parity": "even"}),
        ("1S0", {"term": "1S0", "coupling": "LS", "S": 0.0, "L": 0, "J": 0.0, "parity": "even"}),
        ("1G*<4>", {"term": "1G*4", "coupling": "LS", "S": 0.0, "L": 4, "J": 4.0, "parity": "odd"}),
        ("(1/2,1/2)0", {"term": "(1/2,1/2)0", "coupling": "jj", "J": 0.0, "parity": "even"}),
        ("<5/2>", {"term": "J=5/2", "coupling": "J", "J": 2.5, "parity": "even"}),
    ],
)
def test_parse_nist_level(text, expected):
    assert parse_level(text) == expected


def test_parse_configurations():
    assert M.notation(M.parse("[Ar].3d6.4s2")) == "[Ar] 3d6 4s2"
    assert M.notation(M.parse("1s2.2s")) == "[He] 2s1"
    assert M.notation(M.parse("[Rn]7s2 5f14 6d7 (calculated)")) == "[Rn] 5f14 6d7 7s2"
    cd_core = M.aufbau(48)
    assert M.notation(M.parse("[Cd].5p", core_lookup={"Cd": cd_core})) == "[Kr] 4d10 5s2 5p1"


def test_aufbau_examples():
    assert M.notation(M.aufbau(1)) == "1s1"
    assert M.notation(M.aufbau(29)) == "[Ar] 3d9 4s2"  # the prediction Cu violates
    assert M.notation(M.aufbau(78)) == "[Xe] 4f14 5d8 6s2"
    assert M.notation(M.aufbau(118)) == "[Rn] 5f14 6d10 7s2 7p6"
    assert M.last_filled(57) == (4, 3, 1)  # La: first 4f electron under Madelung
    assert M.last_filled(71) == (5, 2, 1)  # Lu: first 5d electron


@pytest.mark.parametrize(("jp", "spin"), [("7/2+", 3.5), ("(6)+", 6.0), ("0+", 0.0), ("1/2-", 0.5), ("", None)])
def test_parse_spin(jp, spin):
    assert parse_spin(jp) == spin


def test_oxidation_list_ignores_commentary():
    assert oxidation_list("-4, -2, -1, +1,+2, +3 ​(an amphoteric oxide)") == ([3, 2, 1, -1, -2, -4], False)
    assert oxidation_list("7, 6, 5, 4 acidic, basic or amphoteric; depending on the oxidation state 2") == (
        [7, 6, 5, 4],
        False,
    )
    assert oxidation_list("-1, 0, +1,+2 ​(predicted)") == ([2, 1, 0, -1], True)


def test_commons_author_names_lose_wiki_leftovers():
    import build_images

    assert (
        build_images.clean_author("Alchemist-hp ( talk ) ( www.pse-mendelejew.de )")
        == "Alchemist-hp (www.pse-mendelejew.de)"
    )
    assert build_images.clean_author("Unknown author Unknown author") == "Unknown author"
    assert build_images.clean_author("Marco Cardin") == "Marco Cardin"
    assert build_images.clean_author("Ed Ed Ed") == "Ed Ed Ed"  # only an exact doubling is merged
