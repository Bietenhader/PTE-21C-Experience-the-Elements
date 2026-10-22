# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""CIE 1931 2° colour-matching functions (source id `cie_cmf`), for the spectrum colours (SPEC §11.6).

The CIE publishes the standard observer as a data file (1 nm, 360–830 nm) with a metadata record
that carries its checksum; the build keeps the SPEC's 5 nm grid from 380 to 780 nm. The numbers are
the values of the international standard (CIE 018:2019, Table 6; ISO/CIE 11664-1:2019), used as
numerical facts with that citation.
"""

from __future__ import annotations

import hashlib
import json

from common import SourceUnavailable, http_get, raw_path

SOURCE = "cie_cmf"
BASE = "https://files.cie.co.at/Publications-datasets/"
FILE = "CIE_xyz_1931_2deg.csv"
META = FILE + "_metadata.json"
START, END, STEP = 380, 780, 5


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, BASE + META, META, refresh=refresh)
    http_get(SOURCE, BASE + FILE, FILE, refresh=refresh)


def checksum_ok() -> bool:
    meta = json.loads(raw_path(SOURCE, META).read_text(encoding="utf-8"))
    want = next((c["checksum"] for c in meta.get("checksums", []) if c.get("hashMethod") == "sha256"), None)
    got = hashlib.sha256(raw_path(SOURCE, FILE).read_bytes()).hexdigest()
    return want == got


def parse() -> dict:
    """{start, step, x, y, z}: the matching functions on the SPEC's 5 nm grid, 380–780 nm."""
    path = raw_path(SOURCE, FILE)
    if not path.exists():
        raise SourceUnavailable(f"{SOURCE}: {FILE} is not cached in tools/raw/{SOURCE}")
    if not checksum_ok():
        raise ValueError(f"{SOURCE}: {FILE} does not match the SHA-256 in its CIE metadata record")
    rows: dict[int, tuple[float, float, float]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 4 or not parts[0].isdigit():
            continue
        rows[int(parts[0])] = (float(parts[1]), float(parts[2]), float(parts[3]))
    grid = range(START, END + 1, STEP)
    missing = [nm for nm in grid if nm not in rows]
    if missing:
        raise ValueError(f"{SOURCE}: no row for {missing[:5]} nm")
    return {
        "start": START,
        "step": STEP,
        "x": [rows[nm][0] for nm in grid],
        "y": [rows[nm][1] for nm in grid],
        "z": [rows[nm][2] for nm in grid],
    }
