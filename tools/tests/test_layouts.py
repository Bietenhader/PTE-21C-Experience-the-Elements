# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Layout invariants (SPEC §7.2, §13.1)."""

from __future__ import annotations

import pytest
from conftest import LAYOUT_IDS

from common import NUM_ELEMENTS
from madelung import last_filled


def cells(layouts, lid, variant="lu"):
    return {int(z): (c["col"], c["row"]) for z, c in layouts[lid]["variants"][variant]["cells"].items()}


def rows_of(layout_cells):
    rows: dict[int, list[int]] = {}
    for z, (_col, row) in layout_cells.items():
        rows.setdefault(row, []).append(z)
    return rows


@pytest.mark.parametrize("lid", LAYOUT_IDS)
@pytest.mark.parametrize("variant", ["lu", "la"])
def test_every_element_exactly_once(layouts, lid, variant):
    c = cells(layouts, lid, variant)
    assert sorted(c) == list(range(1, NUM_ELEMENTS + 1))
    assert len(set(c.values())) == NUM_ELEMENTS, "two elements share a cell"
    assert all(1 <= col <= 32 and row >= 1 for col, row in c.values())


def test_janet_row_lengths(layouts):
    lengths = [len(v) for _r, v in sorted(rows_of(cells(layouts, "janet")).items())]
    assert lengths == [2, 2, 8, 8, 18, 18, 32, 30]  # row 8 reaches 32 with elements 119–120 (v0.2)


def test_janet_rows_are_n_plus_l(layouts):
    for z, (_col, row) in cells(layouts, "janet").items():
        n, l, _k = last_filled(z)
        assert row == n + l, z


def test_janet_row_contents(layouts):
    rows = rows_of(cells(layouts, "janet"))
    assert sorted(rows[3]) == [5, 6, 7, 8, 9, 10, 11, 12]  # B–Ne, Na, Mg
    assert sorted(rows[7]) == list(range(57, 89))  # La … Ra


def test_adomah_rows_by_n_increasing_upward(layouts):
    c = cells(layouts, "adomah")
    max_row = max(row for _col, row in c.values())
    for z, (_col, row) in c.items():
        assert row == max_row + 1 - last_filled(z)[0], z
    assert c[1][1] == max_row  # n = 1 at the bottom
    rows = rows_of(c)
    n4 = sorted(rows[max_row + 1 - 4])
    assert n4 == sorted([19, 20, *range(31, 37), *range(39, 49), *range(57, 71)])  # 4s 4p 4d 4f


@pytest.mark.parametrize("lid", ["janet", "adomah"])
def test_left_step_forms_ignore_group3_toggle(layouts, lid):
    assert cells(layouts, lid, "lu") == cells(layouts, lid, "la")
    assert layouts[lid]["group3Sensitive"] is False


def test_standard18_toggle_moves_exactly_four_tiles(layouts):
    lu, la = cells(layouts, "standard18", "lu"), cells(layouts, "standard18", "la")
    moved = {z for z in lu if lu[z] != la[z]}
    assert moved == {57, 71, 89, 103}  # La, Lu, Ac, Lr


def test_standard18_detached_rows(layouts):
    lu = cells(layouts, "standard18", "lu")
    group3_col = lu[21][0]  # Sc
    assert lu[71] == (group3_col, 6) and lu[103] == (group3_col, 7)  # Lu, Lr under Y
    assert lu[57] == (group3_col, 9)  # La starts the detached lanthanide row under group 3
    assert {row for col, row in lu.values()} == {1, 2, 3, 4, 5, 6, 7, 9, 10}  # one-row gap at 8


def test_long32_toggle_swaps_la_lu_and_ac_lr(layouts):
    lu, la = cells(layouts, "long32", "lu"), cells(layouts, "long32", "la")
    group3_col = lu[21][0]
    assert lu[71][0] == group3_col and la[57][0] == group3_col
    assert lu[103][0] == group3_col and la[89][0] == group3_col

    def row_order(variant, period_row):
        return [z for _c, z in sorted((c, z) for z, (c, r) in variant.items() if r == period_row)]

    for period_row in (6, 7):
        for variant in (lu, la):
            row = sorted(col for col, r in variant.values() if r == period_row)
            assert row == list(range(1, 33))  # 32 unbroken columns
        # Every tile except the four keeps its relative order along the row.
        keep = [z for z in row_order(lu, period_row) if z not in (57, 71, 89, 103)]
        assert keep == [z for z in row_order(la, period_row) if z not in (57, 71, 89, 103)]
