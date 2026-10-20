# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Shared fixtures. The tests read only committed files (public/data, schema, tools/curated)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))

from common import DATA_DIR, load_json  # noqa: E402

LAYOUT_IDS = ("standard18", "long32", "janet", "adomah")


@pytest.fixture(scope="session")
def index() -> dict:
    return load_json(DATA_DIR / "index.json")


@pytest.fixture(scope="session")
def elements(index) -> list[dict]:
    return index["elements"]


@pytest.fixture(scope="session")
def by_symbol(elements) -> dict[str, dict]:
    return {e["symbol"]: e for e in elements}


@pytest.fixture(scope="session")
def sources() -> dict:
    return load_json(DATA_DIR / "sources.json")


@pytest.fixture(scope="session")
def layouts() -> dict[str, dict]:
    return {lid: load_json(DATA_DIR / "layouts" / f"{lid}.json") for lid in LAYOUT_IDS}
