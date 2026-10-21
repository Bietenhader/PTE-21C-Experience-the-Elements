# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""NIST ASD spectral lines (source id `nist_lines`).

Two kinds of request, both tab-delimited:
  * the visible window 380–780 nm for the neutral atom (I) and the singly charged ion (II) of every
    element, wavelengths in air as ASD gives them between 200 and 2000 nm (SPEC §10.8);
  * a narrow window in vacuum around each laser-cooling and clock line named in
    tools/curated/lasercooling.toml, wherever it falls, for its Einstein coefficient A_ki.
"""

from __future__ import annotations

import csv
import io
import re
import tomllib
import urllib.parse

from common import CURATED_DIR, SourceUnavailable, element_symbols, http_get, raw_path

SOURCE = "nist_lines"
URL = (
    "https://physics.nist.gov/cgi-bin/ASD/lines1.pl?spectra={spectrum}&limits_type=0&low_w={low}&upp_w={high}"
    "&unit=1&de=0&I_scale_type=1&format=3&line_out=0&remove_js=on&en_unit=1&output=0&bibrefs=1&page_size=15"
    "&show_obs_wl=1&show_calc_wl=1&unc_out=1&order_out=0&show_av={medium}&tsb_value=0&A_out=0&intens_out=on"
    "&allowed_out=1&forbid_out=1&conf_out=on&term_out=on&enrg_out=on&J_out=on&submit=Retrieve+Data"
)
VISIBLE = (380, 780)
MEDIUM_AIR, MEDIUM_VACUUM = 2, 3  # 3 = vacuum at every wavelength (1 garbles lines above 1000 nm)
MAX_Z = 108
ROMAN = {0: "I", 1: "II"}
WINDOW_NM = 0.6


def visible_file(z: int, charge: int) -> str:
    return f"visible_{z:03d}_{charge}.tsv"


def window_file(z: int, charge: int, nm: float) -> str:
    return f"window_{z:03d}_{charge}_{nm:.3f}.tsv"


def spectrum(symbols: dict[int, str], z: int, charge: int) -> str:
    return urllib.parse.quote_plus(f"{symbols[z]} {ROMAN[charge]}")


def cooling_lines() -> list[tuple[int, int, float]]:
    """(Z, charge, vacuum wavelength in nm) of every line in lasercooling.toml."""
    path = CURATED_DIR / "lasercooling.toml"
    if not path.exists():
        return []
    rows = tomllib.loads(path.read_text(encoding="utf-8")).get("row", [])
    out = []
    for r in rows:
        for key in ("wavelength_nm", "repump_nm"):
            if key in r:
                out.append((r["Z"], r.get("charge", 0), float(r[key])))
    return sorted(set(out))


def fetch(refresh: bool = False) -> None:
    symbols = element_symbols()
    failures, total = [], 0
    for z in range(1, MAX_Z + 1):
        for charge in (0, 1):
            total += 1
            url = URL.format(spectrum=spectrum(symbols, z, charge), low=VISIBLE[0], high=VISIBLE[1], medium=MEDIUM_AIR)
            try:
                http_get(SOURCE, url, visible_file(z, charge), refresh=refresh)
            except SourceUnavailable as exc:
                failures.append(str(exc))
    for z, charge, nm in cooling_lines():
        total += 1
        url = URL.format(
            spectrum=spectrum(symbols, z, charge), low=nm - WINDOW_NM, high=nm + WINDOW_NM, medium=MEDIUM_VACUUM
        )
        try:
            http_get(SOURCE, url, window_file(z, charge, nm), refresh=refresh)
        except SourceUnavailable as exc:
            failures.append(str(exc))
    if failures and len(failures) == total:
        raise SourceUnavailable(f"{SOURCE}: every request failed; first: {failures[0]}")


def _value(text: str) -> str:
    return text.strip().removeprefix("=").strip('"').strip()


_NUM = re.compile(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")


def number(text: str) -> float | None:
    m = _NUM.search(text or "")
    return float(m.group()) if m else None


def parse_table(text: str) -> list[dict] | None:
    """Rows of one ASD lines answer, or None when ASD returned no table (an HTML page).

    Each row: {obs, ritz, unc, intensity (raw text), Aki, acc, Ei, Ek, lower{conf, term, J},
    upper{...}, type, ref, medium}."""
    first = text.split("\n", 1)[0]
    if not (first.startswith("obs_wl") or first.startswith("ritz_wl")):
        return None
    medium = "vacuum" if "_vac" in first else "air"
    reader = csv.reader(io.StringIO(text), delimiter="\t")
    header = [h.strip() for h in next(reader)]
    col = {h: i for i, h in enumerate(header)}
    obs_key = next((h for h in header if h.startswith("obs_wl")), None)
    ritz_key = next((h for h in header if h.startswith("ritz_wl")), None)
    rows = []
    for row in reader:
        if len(row) < 8:
            continue

        def get(name: str | None, row: list[str] = row) -> str:
            i = col.get(name) if name else None
            return _value(row[i]) if i is not None and i < len(row) else ""

        obs, ritz = number(get(obs_key)), number(get(ritz_key))
        if obs is None and ritz is None:
            continue
        rows.append(
            {
                "obs": obs,
                "ritz": ritz,
                "unc": number(get("unc_obs_wl")),
                "intensity": get("intens"),
                "Aki": number(get("Aki(s^-1)")),
                "acc": get("Acc"),
                "Ei": get("Ei(eV)"),
                "Ek": get("Ek(eV)"),
                "lower": {"conf": get("conf_i"), "term": get("term_i"), "J": get("J_i")},
                "upper": {"conf": get("conf_k"), "term": get("term_k"), "J": get("J_k")},
                "type": get("Type"),
                "ref": get("line_ref"),
                "medium": medium,
            }
        )
    return rows


def parse() -> dict:
    """{"visible": {(Z, charge): rows}, "windows": {(Z, charge, nm): rows}}."""
    out: dict = {"visible": {}, "windows": {}}
    base = raw_path(SOURCE, "")
    if not base.exists():
        raise SourceUnavailable(f"{SOURCE}: nothing cached in tools/raw/{SOURCE}")
    for path in sorted(base.glob("visible_*.tsv")):
        _, z, charge = path.stem.split("_")
        rows = parse_table(path.read_text(encoding="utf-8", errors="replace"))
        if rows:
            out["visible"][(int(z), int(charge))] = rows
    for path in sorted(base.glob("window_*.tsv")):
        _, z, charge, nm = path.stem.split("_", 3)
        rows = parse_table(path.read_text(encoding="utf-8", errors="replace"))
        out["windows"][(int(z), int(charge), float(nm))] = rows or []
    if not out["visible"]:
        raise SourceUnavailable(f"{SOURCE}: no visible-window tables cached")
    return out
