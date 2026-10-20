# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""PROVENANCE.md / CREDITS.md are current and the licence audit passes (SPEC §6.4, §15.3)."""

from __future__ import annotations

import report


def test_generated_reports_are_up_to_date():
    assert report.main(["--check"]) == 0, "run: python tools/report.py"


def test_licence_audit(index, sources):
    assert report.audit(index, sources) == []
