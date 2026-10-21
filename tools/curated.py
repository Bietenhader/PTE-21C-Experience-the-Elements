# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Loading and checking the hand-compiled tables in tools/curated/ (SPEC §6.2).

Every row must name a source that exists in tools/sources.toml; a row without one, or with an
unknown key, stops the build. Rows that cite `primary_literature` must give a DOI or an arXiv id.
"""

from __future__ import annotations

import tomllib
from decimal import Decimal
from functools import cache

from common import CURATED_DIR, TOOLS_DIR


@cache
def registry() -> dict[str, dict]:
    return tomllib.loads((TOOLS_DIR / "sources.toml").read_text(encoding="utf-8"))


def load(name: str, table: str = "row") -> list[dict]:
    """Rows of tools/curated/<name> (empty list if the file does not exist)."""
    path = CURATED_DIR / name
    if not path.exists():
        return []
    rows = tomllib.loads(path.read_text(encoding="utf-8")).get(table, [])
    reg = registry()
    for row in rows:
        for key in [k for k in row if k == "source" or k.endswith("_source")]:
            if key == "wavelength_source" and row[key] == "nist_lines":
                continue
            src = row[key]
            if src not in reg:
                raise ValueError(f"{name}: unknown source {src!r} in {row}")
            doi_key = key.replace("source", "doi")
            if src == "primary_literature" and not (row.get(doi_key) or row.get("doi") or row.get("arxiv")):
                raise ValueError(f"{name}: primary_literature row without a DOI or arXiv id: {row}")
        if not any(k == "source" or k.endswith("_source") for k in row):
            raise ValueError(f"{name}: row without a source: {row}")
    return rows


# --- hyperfine (SPEC §11.4) -------------------------------------------------------------------


def hyperfine_levels(I: float, J: float, A: float, B: float | None) -> dict[float, float]:
    """{F: E_F} in the unit of A and B (SPEC §11.4)."""
    out = {}
    F = abs(I - J)
    while F <= I + J + 1e-9:
        K = F * (F + 1) - I * (I + 1) - J * (J + 1)
        E = A / 2 * K
        if B and I >= 1 and J >= 1:
            E += B * (1.5 * K * (K + 1) - 2 * I * (I + 1) * J * (J + 1)) / (4 * I * (2 * I - 1) * J * (2 * J - 1))
        out[F] = E
        F += 1
    return out


def hyperfine_width_hz(row: dict) -> float:
    """E(F_max) − E(F_min) in Hz, recomputed from A (and B) of a hyperfine.toml row."""
    levels = hyperfine_levels(row["I"], row["J"], row["A_MHz"], row.get("B_MHz"))
    return abs(levels[max(levels)] - levels[min(levels)]) * 1e6


def splitting_decimal(row: dict) -> Decimal:
    text = row.get("splitting_text")
    return Decimal(text) if text else Decimal(repr(row["splitting_Hz"]))
