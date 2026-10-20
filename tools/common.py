# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Shared helpers for the PTE-21C data pipeline.

Fetchers use `http_get`, which sends a descriptive User-Agent, keeps a polite per-host
interval, retries transient failures and caches every raw response under tools/raw/
(gitignored). A source that cannot be reached raises `SourceUnavailable`; the build
turns that into Missing{source_unavailable_at_build} for the affected fields instead of
failing (SPEC §6.1).
"""

from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent
RAW_DIR = TOOLS_DIR / "raw"
CURATED_DIR = TOOLS_DIR / "curated"
DATA_DIR = REPO_ROOT / "public" / "data"
SCHEMA_DIR = REPO_ROOT / "schema"

REPO_URL = "https://github.com/Bietenhader/PTE-21C-Experience-the-Elements"
USER_AGENT = f"PTE-21C-pipeline/0.1 (educational periodic table; +{REPO_URL})"

NUM_ELEMENTS = 118

# Minimum seconds between two requests to the same host (SPEC §6.1, §12.6).
HOST_INTERVAL = {
    "pubchem.ncbi.nlm.nih.gov": 0.5,  # PubChem allows 5/s; we use 2/s
    "nds.iaea.org": 0.5,  # IAEA asks for ≤ 3/s
}
DEFAULT_INTERVAL = 1.0
_last_request: dict[str, float] = {}


class SourceUnavailable(Exception):
    """A source could not be fetched and has no cached copy."""


def raw_path(source_id: str, filename: str) -> Path:
    return RAW_DIR / source_id / filename


def _meta_path(source_id: str) -> Path:
    return RAW_DIR / source_id / "_meta.json"


def read_meta(source_id: str) -> dict:
    p = _meta_path(source_id)
    return json.loads(p.read_text()) if p.exists() else {}


def _write_meta(source_id: str, filename: str, url: str) -> None:
    meta = read_meta(source_id)
    meta.setdefault("files", {})[filename] = {
        "url": url,
        "retrieved": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _meta_path(source_id).write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")


def retrieved_date(source_id: str) -> str | None:
    """Date (YYYY-MM-DD) of the oldest cached file of a source, or None if nothing is cached."""
    files = read_meta(source_id).get("files", {})
    dates = sorted(f["retrieved"][:10] for f in files.values())
    return dates[0] if dates else None


def http_get(source_id: str, url: str, filename: str, *, refresh: bool = False, timeout: float = 120) -> Path:
    """Return the cached raw file for `url`, downloading it first if needed."""
    path = raw_path(source_id, filename)
    if path.exists() and not refresh:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    host = urllib.parse.urlparse(url).hostname or ""
    interval = HOST_INTERVAL.get(host, DEFAULT_INTERVAL)
    last_error: Exception | None = None
    for attempt in range(4):
        wait = _last_request.get(host, 0) + interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_request[host] = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read()
            tmp = path.with_suffix(path.suffix + ".part")
            tmp.write_bytes(body)
            tmp.replace(path)
            _write_meta(source_id, filename, url)
            return path
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc
            if isinstance(exc, urllib.error.HTTPError) and exc.code in (400, 401, 403, 404):
                break  # not transient
            time.sleep(2**attempt)
    if path.exists():
        return path  # stale cache beats nothing
    raise SourceUnavailable(f"{source_id}: {url} → {last_error}")


# --- Quantity / Missing -------------------------------------------------------------------


def quantity(
    value: float, unit: str, source: str, *, unc: float | None = None, flag: str | None = None, note: str | None = None
) -> dict:
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        raise ValueError(f"quantity() needs a finite number, got {value!r} from {source}")
    q: dict = {"value": value}
    if unc is not None:
        q["unc"] = unc
    q["unit"] = unit
    q["source"] = source
    if flag:
        q["flag"] = flag
    if note:
        q["note"] = note
    return q


def missing(reason: str, note: str | None = None) -> dict:
    m: dict = {"missing": True, "reason": reason}
    if note:
        m["note"] = note
    return m


def is_missing(x: object) -> bool:
    return isinstance(x, dict) and x.get("missing") is True


# --- Number parsing -----------------------------------------------------------------------

_CONCISE = re.compile(r"^(?P<num>[+-]?\d+(?:\.\d+)?)(?:\((?P<unc>\d+)#?\))?#?$")


def parse_concise(text: str) -> tuple[float, float | None]:
    """Parse NIST concise notation: '55.845(2)' → (55.845, 0.002); '4.002602' → (4.002602, None).

    Digit-group spaces and non-breaking spaces are ignored. The uncertainty in parentheses
    applies to the last digits of the number.
    """
    s = text.replace(" ", "").replace(" ", "").replace(" ", "")
    m = _CONCISE.match(s)
    if not m:
        raise ValueError(f"not a concise number: {text!r}")
    num = m.group("num")
    value = float(num)
    if m.group("unc") is None:
        return value, None
    decimals = len(num.split(".")[1]) if "." in num else 0
    unc = float(Decimal(m.group("unc")).scaleb(-decimals))
    return value, unc


def sig_digits(text: str) -> int:
    """Significant digits of a decimal string ('0.00012' → 2, '13.598' → 5)."""
    digits = re.sub(r"[^0-9]", "", text.split("e")[0].split("E")[0]).lstrip("0")
    return max(1, len(digits))


def round_sig(x: float, n: int) -> float:
    if x == 0:
        return 0.0
    return round(x, n - 1 - math.floor(math.log10(abs(x))))


def round_with_unc(value: float, unc: float) -> tuple[float, float]:
    """Round an uncertainty to two significant digits and the value to the same decimal place."""
    if unc <= 0:
        return value, unc
    exp = math.floor(math.log10(unc))
    decimals = 1 - exp
    return round(value, decimals), round(unc, decimals)


# --- Pipeline report ----------------------------------------------------------------------


class Report:
    """Collects the loud lines of a pipeline run; written to tools/build-report.md."""

    def __init__(self) -> None:
        self.sections: dict[str, list[str]] = {}

    def add(self, section: str, line: str) -> None:
        self.sections.setdefault(section, []).append(line)

    def unavailable(self, source_id: str, error: str) -> None:
        self.add("Sources unavailable at build", f"**{source_id}** — {error}")
        print(f"!!! SOURCE UNAVAILABLE: {source_id}: {error}")

    def markdown(self) -> str:
        out = [
            "<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->",
            "# Pipeline report",
            "",
            "Generated by `python tools/pipeline.py`. Lists every source problem, every disagreement",
            "between sources and every rule the build applied. Read it after each pipeline run.",
            "",
        ]
        for title, lines in self.sections.items():
            out += [f"## {title}", ""] + [f"- {line}" for line in lines] + [""]
        if not self.sections:
            out += ["Nothing to report.", ""]
        return "\n".join(out)


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
