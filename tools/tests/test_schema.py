# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Schema validation and provenance invariants of the committed data (SPEC §13.1, §4.3.1)."""

from __future__ import annotations

import tomllib

import jsonschema
import pytest
from conftest import LAYOUT_IDS

from build import validate
from common import CURATED_DIR, DATA_DIR, NUM_ELEMENTS, SCHEMA_DIR, TOOLS_DIR, load_json


def test_schema_is_valid_draft7():
    jsonschema.Draft7Validator.check_schema(load_json(SCHEMA_DIR / "pte.schema.json"))


def test_index_matches_schema(index):
    validate("IndexFile", index)


def test_sources_match_schema(sources):
    validate("SourcesFile", sources)


@pytest.mark.parametrize("lid", LAYOUT_IDS)
def test_layout_matches_schema(layouts, lid):
    validate("LayoutFile", layouts[lid])
    assert layouts[lid]["id"] == lid


def test_one_entry_per_element_in_order(elements):
    assert [e["Z"] for e in elements] == list(range(1, NUM_ELEMENTS + 1))
    assert len({e["symbol"] for e in elements}) == NUM_ELEMENTS


def _walk(obj, path=""):
    if isinstance(obj, dict):
        yield path, obj
        for k, v in obj.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk(v, f"{path}[{i}]")
    else:
        yield path, obj


def test_every_source_resolves(index, sources):
    known = set(sources["sources"])
    bad = [
        (p, o["source"]) for p, o in _walk(index) if isinstance(o, dict) and "source" in o and o["source"] not in known
    ]
    assert not bad, bad


def test_registry_matches_toml(sources):
    registry = tomllib.loads((TOOLS_DIR / "sources.toml").read_text(encoding="utf-8"))
    assert set(sources["sources"]) == set(registry)


def test_no_null_except_f_block_group(elements):
    """'No numeric null' (SPEC §13.1). The only null allowed is `group` for the f-block (SPEC §5)."""
    for e in elements:
        for path, value in _walk(e):
            if value is None:
                assert path == ".group" and e["block"] == "f", (e["symbol"], path)


def test_every_quantity_has_unit_and_source(index):
    units = set(load_json(SCHEMA_DIR / "pte.schema.json")["definitions"]["Unit"]["enum"])
    for path, o in _walk(index):
        if isinstance(o, dict) and "value" in o and isinstance(o["value"], int | float):
            assert o.get("unit") in units, path
            assert o.get("source"), path


def test_every_missing_has_a_reason(index):
    reasons = {"not_measured", "not_applicable", "no_stable_isotope", "predicted_only", "source_unavailable_at_build"}
    for path, o in _walk(index):
        if isinstance(o, dict) and o.get("missing") is True:
            assert o.get("reason") in reasons, path
            assert o.get("note"), f"{path}: every Missing in index.json explains itself"


@pytest.mark.parametrize("toml_file", sorted(p.name for p in CURATED_DIR.glob("*.toml")))
def test_every_curated_row_has_a_registered_source(toml_file, sources):
    """SPEC §6.2: every row of every table names a registered source (biology.toml names one per
    claim: plant_source, human_source); primary_literature rows give their DOI or arXiv id."""
    doc = tomllib.loads((CURATED_DIR / toml_file).read_text(encoding="utf-8"))
    # images.toml chooses files (credits come with each file); trends.toml cites per trend.
    for table, rows in doc.items():
        if table not in ("row", "clock", "event"):
            continue
        for row in rows:
            keys = [k for k in row if (k == "source" or k.endswith("_source")) and k != "wavelength_source"]
            assert keys, (toml_file, table, row)
            for k in keys:
                assert row[k] in sources["sources"], (toml_file, k, row)
                if row[k] == "primary_literature":
                    doi = row.get(k.replace("source", "doi")) or row.get("doi") or row.get("arxiv")
                    assert doi, (toml_file, "primary_literature without a DOI", row)


def test_fetched_sources_used_in_m0_have_retrieval_dates(sources):
    for sid, s in sources["sources"].items():
        if s["kind"] == "fetched" and s["status"] == "ok":
            assert s.get("retrieved"), sid


DETAIL_FILES = [
    ("elements", "ElementDetailFile"),
    ("isotopes", "IsotopesFile"),
    ("spectra", "SpectraFile"),
    ("levels", "LevelsFile"),
]


@pytest.mark.parametrize(("folder", "definition"), DETAIL_FILES, ids=[f for f, _ in DETAIL_FILES])
def test_per_element_files_match_schema(folder, definition):
    """Every per-element file the panels load validates (SPEC §13.1), not only at build time."""
    schema = load_json(SCHEMA_DIR / "pte.schema.json")
    v = jsonschema.Draft7Validator({"$ref": f"#/definitions/{definition}", "definitions": schema["definitions"]})
    files = sorted((DATA_DIR / folder).glob("*.json"))
    assert files, f"public/data/{folder} is empty"
    for f in files:
        errors = list(v.iter_errors(load_json(f)))
        assert not errors, f"{folder}/{f.name}: {errors[0].message}"


@pytest.mark.parametrize(
    ("name", "definition"),
    [
        ("metrology.json", "MetrologyFile"),
        ("cie1931.json", "ColourMatchingFile"),
        ("relativity.json", "RelativityFile"),
    ],
)
def test_shared_files_match_schema(name, definition):
    schema = load_json(SCHEMA_DIR / "pte.schema.json")
    v = jsonschema.Draft7Validator({"$ref": f"#/definitions/{definition}", "definitions": schema["definitions"]})
    v.validate(load_json(DATA_DIR / name))
