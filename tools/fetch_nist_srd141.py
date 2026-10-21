# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""NIST SRD 141, atomic reference data for electronic-structure calculations (source id `nist_srd141`).

One HTML page per element, Z = 1–92: total energies and orbital eigenvalues of the neutral atom
in four density-functional approximations (LDA, LSD, RLDA, ScRLDA), in hartree. The second row
under an orbital is the spin-down value (LSD) or the j = l + 1/2 value (RLDA); the first row is
kept for each method. The pages also list the singly charged ion, which is skipped.
"""

from __future__ import annotations

import html
import re

from common import SourceUnavailable, element_symbols, http_get, raw_path

SOURCE = "nist_srd141"
URL = "https://math.nist.gov/DFTdata/atomdata/tables/{z:02d}{symbol}.html"
MAX_Z = 92
METHODS = ("LDA", "LSD", "RLDA", "ScRLDA")
L_LETTER = "spdf"


def filename(z: int) -> str:
    return f"srd141_{z:03d}.html"


def fetch(refresh: bool = False) -> None:
    symbols = element_symbols()
    failures = []
    for z in range(1, MAX_Z + 1):
        try:
            http_get(SOURCE, URL.format(z=z, symbol=symbols[z]), filename(z), refresh=refresh)
        except SourceUnavailable as exc:
            failures.append(str(exc))
    if len(failures) == MAX_Z:
        raise SourceUnavailable(f"{SOURCE}: every request failed; first: {failures[0]}")


def parse_page(text: str, symbol: str) -> dict:
    """{configuration, Etot{method: hartree}, orbitals: [{n, l, hartree{method: value}}], problems[]}
    for the neutral atom only.

    A method whose column is not complete for every orbital (the Sm page lists its ScRLDA values
    one row out of step) is dropped for that element and named in `problems`.
    """
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    lines = text.splitlines()
    start = next(i for i, ln in enumerate(lines) if re.match(rf"^\s*\d+\s+{symbol}\s", ln))
    config = re.sub(r"^\s*\d+\s+\S+\s+", "", lines[start]).strip()
    out: dict = {"configuration": config, "Etot": {}, "orbitals": [], "problems": []}
    rows: list[tuple[int, int, list[float]]] = []
    orphan = False
    for ln in lines[start + 1 :]:
        if re.match(r"^\s*\d+\s+\S+\+", ln) or "Return to" in ln:
            break  # the ion's block starts
        m = re.match(r"^\s*Etot\s*=\s*(.+)$", ln)
        if m:
            out["Etot"] = dict(zip(METHODS, (float(x) for x in m.group(1).split()), strict=False))
            continue
        m = re.match(r"^\s*(\d+)([spdf])\s+(.+)$", ln)
        if m:
            rows.append((int(m.group(1)), L_LETTER.index(m.group(2)), [float(x) for x in m.group(3).split()]))
            continue
        # A continuation row (LSD spin-down, RLDA j = l + 1/2) starts in the LSD column; a number
        # further left than that belongs to no orbital.
        if re.match(r"^\s{0,20}-?\d", ln):
            orphan = True
    if not rows:
        raise ValueError(f"SRD 141 {symbol}: no orbital rows found")
    usable = [m for i, m in enumerate(METHODS) if all(len(v) > i for _, _, v in rows)]
    if orphan or any(len(v) != len(METHODS) for _, _, v in rows):
        usable = [m for m in usable if m != "ScRLDA"] if len(rows[0][2]) == 3 or orphan else usable
        dropped = [m for m in METHODS if m not in usable]
        out["problems"].append(f"{symbol}: column(s) {', '.join(dropped)} out of step with the orbitals; not used")
    for n, l, values in rows:
        out["orbitals"].append({"n": n, "l": l, "hartree": {m: values[METHODS.index(m)] for m in usable}})
    return out


def parse() -> dict[int, dict]:
    symbols = element_symbols()
    out: dict[int, dict] = {}
    for z in range(1, MAX_Z + 1):
        path = raw_path(SOURCE, filename(z))
        if path.exists():
            out[z] = parse_page(path.read_text(encoding="utf-8", errors="replace"), symbols[z])
    if not out:
        raise SourceUnavailable(f"{SOURCE}: nothing cached in tools/raw/{SOURCE}")
    return out
