# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""NIST ASD ground states and ionization energies (source id `nist_gsie`).

One CSV request for all spectra H–Og plus the ASD help page, whose definitions of the
abbreviated cores ([Cd], [Hg], …) are parsed rather than typed in.
"""

from __future__ import annotations

import csv
import html
import re

import madelung
from common import http_get, raw_path

SOURCE = "nist_gsie"
URL = (
    "https://physics.nist.gov/cgi-bin/ASD/ie.pl?spectra=H-Og&submit=Retrieve+Data&units=1&format=2"
    "&order=0&at_num_out=on&sp_name_out=on&ion_charge_out=on&el_name_out=on&seq_out=on&shells_out=on"
    "&conf_out=on&level_out=on&ion_conf_out=on&e_out=0&unc_out=on&biblio=on"
)
HELP_URL = "https://physics.nist.gov/PhysRefData/ASD/Html/iehelp.html"
CSV_FILE = "ie_all.csv"
HELP_FILE = "iehelp.html"

L_FROM_LETTER = {c: i for i, c in enumerate("SPDFGHIKLMNOQRTUV")}


def fetch(refresh: bool = False) -> None:
    http_get(SOURCE, URL, CSV_FILE, refresh=refresh)
    http_get(SOURCE, HELP_URL, HELP_FILE, refresh=refresh)


def core_definitions() -> dict[str, madelung.Config]:
    """{'Cd': {...}, 'Hg': {...}, …} from the ASD help text '[Cd] = 1s 2 2s 2 …'."""
    text = raw_path(SOURCE, HELP_FILE).read_text(encoding="latin-1")
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text)))
    cores: dict[str, madelung.Config] = {}
    for sym, body in re.findall(r"\[([A-Z][a-z]?)\] = ((?:\d+[spdf] \d+ ?)+)", text):
        cfg = {}
        for n, letter, occ in re.findall(r"(\d+)([spdf]) (\d+)", body):
            cfg[(int(n), "spdf".index(letter))] = int(occ)
        cores[sym] = cfg
    if "Cd" not in cores or "Hg" not in cores:
        raise ValueError("ASD help page no longer defines the [Cd]/[Hg] cores; check the parser")
    return cores


def parse_level(text: str) -> dict:
    """'2S<1/2>' / '1S0' / '1G*<4>' / '(1/2,1/2)0' / '<5/2>' → {term, coupling, S?, L?, J, parity}."""
    m = re.fullmatch(r"(?P<mult>\d+)(?P<L>[A-Z])(?P<odd>\*)?(?:<(?P<Jb>[\d/]+)>|(?P<J>[\d/]+))", text)
    if m:
        jtxt = m.group("Jb") or m.group("J")
        mult = int(m.group("mult"))
        return {
            "term": f"{mult}{m.group('L')}{'*' if m.group('odd') else ''}{jtxt}",
            "coupling": "LS",
            "S": (mult - 1) / 2,
            "L": L_FROM_LETTER[m.group("L")],
            "J": _frac(jtxt),
            "parity": "odd" if m.group("odd") else "even",
        }
    m = re.fullmatch(r"\((?P<j1>[\d/]+),(?P<j2>[\d/]+)\)(?P<odd>\*)?(?:<(?P<Jb>[\d/]+)>|(?P<J>[\d/]+))", text)
    if m:  # jj coupling, e.g. Pb I '(1/2,1/2)0'
        jtxt = m.group("Jb") or m.group("J")
        return {
            "term": f"({m.group('j1')},{m.group('j2')}){'*' if m.group('odd') else ''}{jtxt}",
            "coupling": "jj",
            "J": _frac(jtxt),
            "parity": "odd" if m.group("odd") else "even",
        }
    m = re.fullmatch(r"(?P<odd>\*)?<?(?P<J>[\d/]+)>?", text)
    if m:  # NIST gives only J (Sg, Bh, Hs)
        return {
            "term": f"J={m.group('J')}",
            "coupling": "J",
            "J": _frac(m.group("J")),
            "parity": "odd" if m.group("odd") else "even",
        }
    raise ValueError(f"unrecognised NIST ground level {text!r}")


def _frac(s: str) -> float:
    num, _, den = s.partition("/")
    return int(num) / int(den or 1)


def parse() -> dict[int, dict]:
    """{Z: {shells, level, prefix, ie_eV (str), unc_eV (str), refs}} for neutral atoms."""
    cores = core_definitions()
    out: dict[int, dict] = {}
    with raw_path(SOURCE, CSV_FILE).open(encoding="utf-8") as fh:
        reader = csv.reader(fh)
        header = [h.strip() for h in next(reader)]
        col = {name: i for i, name in enumerate(header)}

        def get(row: list[str], name: str) -> str:
            key = next(k for k in col if k.startswith(name))
            return row[col[key]].strip().removeprefix("=").strip('"').strip()

        for row in reader:
            if len(row) < len(header) - 1 or get(row, "Ion Charge") != "0":
                continue
            z = int(get(row, "At. num"))
            shells = get(row, "Ground Shells")
            cfg = madelung.parse(shells, core_lookup=cores)
            if madelung.electrons(cfg) != z:
                raise ValueError(f"Z={z}: {shells!r} has {madelung.electrons(cfg)} electrons")
            out[z] = {
                "shells": shells,
                "config": cfg,
                "level": parse_level(get(row, "Ground Level")),
                "prefix": get(row, "Prefix"),
                "ie_eV": get(row, "Ionization Energy"),
                "unc_eV": get(row, "Uncertainty"),
                "refs": get(row, "References"),
            }
    return out
