# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Electron configurations: the Madelung (Aufbau) generator, parsing and noble-gas notation.

Mirrors src/physics/madelung.ts; a Vitest test checks the two agree on all 118 elements.

A configuration is a dict {(n, l): occupancy}. The Madelung rule fills subshells in order of
increasing n + l, and for equal n + l in order of increasing n, each up to 2(2l + 1) electrons.
"""

from __future__ import annotations

import re

L_LETTERS = "spdfghik"
NOBLE_GASES = {2: "He", 10: "Ne", 18: "Ar", 36: "Kr", 54: "Xe", 86: "Rn", 118: "Og"}

Config = dict[tuple[int, int], int]


def capacity(l: int) -> int:
    return 2 * (2 * l + 1)


def madelung_order(max_n: int = 9) -> list[tuple[int, int]]:
    shells = [(n, l) for n in range(1, max_n + 1) for l in range(0, min(n, 5))]
    return sorted(shells, key=lambda s: (s[0] + s[1], s[0]))


_ORDER = madelung_order()


def aufbau(z: int) -> Config:
    """Ground configuration predicted by the Madelung rule for a neutral atom with z electrons."""
    left = z
    out: Config = {}
    for n, l in _ORDER:
        if left == 0:
            break
        k = min(left, capacity(l))
        out[(n, l)] = k
        left -= k
    return out


def last_filled(z: int) -> tuple[int, int, int]:
    """(n, l, k): the subshell the z-th electron enters under the Madelung rule, and k, its
    position in that subshell (1-based). Drives the Janet and ADOMAH layouts and the block."""
    left = z
    for n, l in _ORDER:
        k = min(left, capacity(l))
        if left <= capacity(l):
            return n, l, k
        left -= k
    raise ValueError(z)


_CORE = re.compile(r"^\[(?P<sym>[A-Z][a-z]?)\]$")
_SUBSHELL = re.compile(r"^(?P<n>\d+)(?P<l>[spdfghik])(?P<occ>\d+)?$")


def parse(text: str, core_lookup: dict[str, Config] | None = None) -> Config:
    """Parse '[Ar].3d6.4s2' (NIST), '[Rn]7s2 5f14 6d7 (calculated)' (PubChem) or '1s2.2s'.

    Bracketed cores expand to their own configuration: noble gases by the Madelung rule
    (exact for all of them), other cores via `core_lookup`. Parenthetical intermediate terms
    such as '(3F)' and trailing words are ignored. A subshell without a count holds one electron.
    """
    s = re.sub(r"\([^)]*\)", " ", text)  # drop '(3F)', '(predicted)'
    s = re.sub(r"(\])", r"\1 ", s)
    s = re.sub(r"(\d[spdfghik]\d*)", r" \1 ", s)
    tokens = [t for t in re.split(r"[\s.]+", s) if t]
    out: Config = {}
    for tok in tokens:
        if m := _CORE.match(tok):
            sym = m.group("sym")
            if core_lookup and sym in core_lookup:
                core = core_lookup[sym]
            elif sym in NOBLE_GASES.values():
                core = aufbau(next(z for z, g in NOBLE_GASES.items() if g == sym))
            else:
                raise ValueError(f"unknown core [{sym}] in {text!r}")
            for k, v in core.items():
                out[k] = out.get(k, 0) + v
        elif m := _SUBSHELL.match(tok):
            key = (int(m.group("n")), L_LETTERS.index(m.group("l")))
            out[key] = out.get(key, 0) + int(m.group("occ") or 1)
        elif re.fullmatch(r"[A-Za-z]+", tok):
            continue  # stray words
        else:
            raise ValueError(f"cannot parse token {tok!r} in configuration {text!r}")
    for (n, l), occ in out.items():
        if l >= n or occ > capacity(l):
            raise ValueError(f"impossible subshell {n}{L_LETTERS[l]}{occ} in {text!r}")
    return out


def electrons(cfg: Config) -> int:
    return sum(cfg.values())


def noble_core(cfg: Config) -> int:
    """Z of the largest noble gas whose configuration is fully contained in cfg (0 if none)."""
    best = 0
    total = electrons(cfg)
    for z in NOBLE_GASES:
        if z >= total:
            continue
        if all(cfg.get(k, 0) == v for k, v in aufbau(z).items()):
            best = max(best, z)
    return best


def valence(cfg: Config) -> list[tuple[int, int, int]]:
    """Subshells outside the noble-gas core, ordered by n then l: [(n, l, occupancy), …]."""
    core = aufbau(noble_core(cfg)) if noble_core(cfg) else {}
    rest = [(n, l, occ - core.get((n, l), 0)) for (n, l), occ in cfg.items()]
    return sorted([(n, l, k) for n, l, k in rest if k > 0])


def notation(cfg: Config) -> str:
    """Noble-gas notation with explicit counts, subshells ordered by n then l:
    '[Xe] 4f14 5d9 6s1'."""
    core = noble_core(cfg)
    parts = [f"[{NOBLE_GASES[core]}]"] if core else []
    parts += [f"{n}{L_LETTERS[l]}{k}" for n, l, k in valence(cfg)]
    return " ".join(parts)


_SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def pretty(subshells: list[tuple[int, int, int]]) -> str:
    """'4f¹⁴5d⁹6s¹' — for generated prose such as the hover card's quantum fact."""
    return "".join(f"{n}{L_LETTERS[l]}{str(k).translate(_SUP)}" for n, l, k in subshells)


def differing(measured: Config, predicted: Config) -> tuple[list, list]:
    """The subshells in which two configurations differ, each side ordered by n then l."""
    keys = {k for k in set(measured) | set(predicted) if measured.get(k, 0) != predicted.get(k, 0)}
    a = sorted((n, l, measured[(n, l)]) for n, l in keys if measured.get((n, l), 0))
    b = sorted((n, l, predicted[(n, l)]) for n, l in keys if predicted.get((n, l), 0))
    return a, b
