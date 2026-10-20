#!/usr/bin/env bash
# SPDX-License-Identifier: CC-BY-NC-SA-4.0
#
# Rebuild public/data from the original sources (SPEC §17.1). Needs internet access.
# Double-click in Finder; first time only, right-click → Open. Afterwards, commit the changed
# files in public/data, PROVENANCE.md, CREDITS.md and tools/build-report.md.
#
#   tools/pipeline.command            fetch what is not cached yet, then build
#   tools/pipeline.command --refresh  download every source again

set -euo pipefail
cd "$(dirname "$0")/.."

PY="$(command -v python3.11 || command -v python3 || true)"
if [ -z "$PY" ] || ! "$PY" -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
  echo "Python 3.11 or newer is needed. Install it once with Homebrew:  brew install python@3.11"
  read -r -p "Press Return to close." _ || true
  exit 1
fi

if [ ! -x tools/.venv/bin/python ]; then
  echo "First run: creating tools/.venv …"
  "$PY" -m venv tools/.venv
fi
tools/.venv/bin/pip install --quiet --upgrade pip
tools/.venv/bin/pip install --quiet -r tools/requirements-dev.txt

tools/.venv/bin/python tools/pipeline.py --all "$@"
tools/.venv/bin/python tools/report.py

echo
echo "Done. Read tools/build-report.md for anything the sources disagreed on."
