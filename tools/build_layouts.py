# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Generate public/data/layouts/{standard18,long32,janet,adomah}.json (SPEC §7.2).

All four share one 32-column coordinate space (columns 1–32, rows from 1; row 0 and column 0
or 7 carry labels) so that switching layouts is a pure translation of tiles. Positions follow
from the Madelung filling order via tools/ptable.py; nothing is placed by hand.
"""

from __future__ import annotations

from build import validate
from common import DATA_DIR, NUM_ELEMENTS, dump_json
from madelung import last_filled
from ptable import period, standard_position

STANDARD_OFFSET = 7  # groups 1–18 → columns 8–25, centred in the 32-column space
F_ROW = {6: 9, 7: 10}  # detached f rows sit below a one-row gap
F_CELL_OFFSET = 9  # f-cell 1 → column 10, the column of group 3
BLOCK_START = {3: 1, 2: 15, 1: 25, 0: 31}  # janet/adomah, blocks right-aligned: f d p s
BLOCK_SPAN = {3: 14, 2: 10, 1: 6, 0: 2}
BLOCK_NAME = "spdf"


def standard18(variant: str) -> dict:
    cells = {}
    for z in range(1, NUM_ELEMENTS + 1):
        group, fcell = standard_position(z, variant)
        if group is not None:
            cells[str(z)] = {"col": group + STANDARD_OFFSET, "row": period(z)}
        else:
            cells[str(z)] = {"col": fcell + F_CELL_OFFSET, "row": F_ROW[period(z)]}
    labels = [
        {"text": str(g), "col": g + STANDARD_OFFSET, "row": 0, "kind": "group", "title": f"Group {g}"}
        for g in range(1, 19)
    ]
    labels += [
        {"text": str(p), "col": STANDARD_OFFSET, "row": p, "kind": "period", "title": f"Period {p}"}
        for p in range(1, 8)
    ]
    # Insertion markers: where the detached row belongs (left edge of the cell) and the row itself.
    insert_col = 3 + STANDARD_OFFSET if variant == "lu" else 4 + STANDARD_OFFSET
    first_f_col = (1 if variant == "lu" else 2) + F_CELL_OFFSET
    for p, mark, family in ((6, "*", "lanthanide"), (7, "**", "actinide")):
        title = f"The {family} row below the table is inserted here, in period {p}"
        labels.append({"text": mark, "col": insert_col, "row": p, "kind": "marker", "title": title})
        labels.append(
            {
                "text": mark,
                "col": first_f_col,
                "row": F_ROW[p],
                "kind": "marker",
                "title": f"Period-{p} f-block, detached",
            }
        )
    return {"cells": cells, "labels": labels}


def long32(variant: str) -> dict:
    cells = {}
    for z in range(1, NUM_ELEMENTS + 1):
        group, fcell = standard_position(z, variant)
        if group is not None:
            col = group if group <= 2 else group + 14  # group 3 → column 17
        else:
            col = fcell + 2 if variant == "lu" else fcell + 1  # lu: La → 3; la: Ce → 3, Lu → 16
        cells[str(z)] = {"col": col, "row": period(z)}
    labels = [
        {"text": str(g), "col": g if g <= 2 else g + 14, "row": 0, "kind": "group", "title": f"Group {g}"}
        for g in range(1, 19)
    ]
    labels.append(
        {
            "text": "f-block",
            "col": 3,
            "row": 0,
            "span": 14,
            "kind": "block",
            "title": "f-block, shown inline between groups 2 and 3",
        }
    )
    labels += [{"text": str(p), "col": 0, "row": p, "kind": "period", "title": f"Period {p}"} for p in range(1, 8)]
    return {"cells": cells, "labels": labels}


def _block_labels() -> list[dict]:
    return [
        {
            "text": f"{BLOCK_NAME[l]}-block",
            "col": BLOCK_START[l],
            "row": 0,
            "span": BLOCK_SPAN[l],
            "kind": "block",
            "title": f"l = {l}",
        }
        for l in (3, 2, 1, 0)
    ]


def janet() -> dict:
    cells = {}
    for z in range(1, NUM_ELEMENTS + 1):
        n, l, k = last_filled(z)
        cells[str(z)] = {"col": BLOCK_START[l] + k - 1, "row": n + l}
    rows = sorted({c["row"] for c in cells.values()})
    labels = _block_labels() + [
        {"text": str(r), "col": 0, "row": r, "kind": "row", "title": f"n + l = {r}"} for r in rows
    ]
    return {"cells": cells, "labels": labels}


def adomah() -> dict:
    cells = {}
    max_n = max(last_filled(z)[0] for z in range(1, NUM_ELEMENTS + 1))
    for z in range(1, NUM_ELEMENTS + 1):
        n, l, k = last_filled(z)
        cells[str(z)] = {"col": BLOCK_START[l] + k - 1, "row": max_n + 1 - n}  # n = 1 at the bottom
    labels = _block_labels() + [
        {"text": str(n), "col": 0, "row": max_n + 1 - n, "kind": "row", "title": f"n = {n}"}
        for n in range(1, max_n + 1)
    ]
    return {"cells": cells, "labels": labels}


LAYOUTS = {
    "standard18": {
        "title": "Standard 18-column table",
        "caption": "The familiar IUPAC-style form: 18 groups and 7 periods, with the f-block detached below. "
        "By default lutetium and lawrencium sit in group 3 under scandium and yttrium (IUPAC 2021).",
        "rowAxis": "period",
        "group3Sensitive": True,
        "build": standard18,
    },
    "long32": {
        "title": "32-column long form",
        "caption": "The same table with the f-block placed inline between groups 2 and 3, so every period "
        "reads as one unbroken row of increasing atomic number.",
        "rowAxis": "period",
        "group3Sensitive": True,
        "build": long32,
    },
    "janet": {
        "title": "Janet left-step table",
        "caption": "Charles Janet's arrangement (1928): each row collects the subshells with the same n + l, "
        "and the blocks run f, d, p, s from left to right. Elements are placed by the idealized "
        "Madelung filling order, deliberately ignoring the measured anomalies.",
        "rowAxis": "n+l",
        "group3Sensitive": False,
        "build": lambda _variant: janet(),
    },
    "adomah": {
        "title": "ADOMAH table",
        "caption": "Valery Tsimmerman's ADOMAH form: one row per principal quantum number n, with n increasing "
        "upwards and the blocks right-aligned as in Janet's table. The Madelung filling order "
        "appears along the diagonals.",
        "rowAxis": "n",
        "group3Sensitive": False,
        "build": lambda _variant: adomah(),
    },
}


def build_layouts() -> int:
    for lid, spec in LAYOUTS.items():
        layout = {
            "schemaVersion": 1,
            "id": lid,
            "title": spec["title"],
            "caption": spec["caption"],
            "rowAxis": spec["rowAxis"],
            "group3Sensitive": spec["group3Sensitive"],
            "variants": {v: spec["build"](v) for v in ("lu", "la")},
        }
        validate("LayoutFile", layout)
        dump_json(DATA_DIR / "layouts" / f"{lid}.json", layout)
    print(f"wrote {len(LAYOUTS)} layouts to {DATA_DIR / 'layouts'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(build_layouts())
