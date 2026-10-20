# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Periodic-table geometry derived from the Madelung filling order.

The position rules are SPEC §7.2. Under the Madelung rule the electron that completes element Z
enters subshell (n, l) as the k-th electron of that subshell; that alone fixes the block, the
18-column group and the cell in every layout. Lu and Lr come out in group 3 (5d¹ / 6d¹) and La
and Ac at the start of the f-block (4f¹ / 5f¹), which is the IUPAC-2021 default (SPEC §3).
"""

from __future__ import annotations

from madelung import last_filled

PERIOD_ENDS = (2, 10, 18, 36, 54, 86, 118)
BLOCKS = "spdf"


def period(z: int) -> int:
    return next(i + 1 for i, end in enumerate(PERIOD_ENDS) if z <= end)


def block(z: int) -> str:
    return BLOCKS[last_filled(z)[1]]


def standard_position(z: int, variant: str = "lu") -> tuple[int | None, int | None]:
    """(group 1–18, None) for the main table or (None, f-cell 1–15) for the detached f rows.

    variant "lu": Lu/Lr in group 3, La–Yb and Ac–No in f-cells 1–14.
    variant "la": La/Ac in group 3, Ce–Lu and Th–Lr in f-cells 2–15.
    """
    _n, l, k = last_filled(z)
    if variant == "la":
        if z in (57, 89):
            return 3, None
        if z in (71, 103):
            return None, 15
    elif variant != "lu":
        raise ValueError(variant)
    if l == 0:
        return (18 if z == 2 else k), None
    if l == 1:
        return 12 + k, None
    if l == 2:
        return 2 + k, None
    return None, k
