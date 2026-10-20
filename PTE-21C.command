#!/usr/bin/env bash
# SPDX-License-Identifier: CC-BY-NC-SA-4.0
#
# PTE-21C launcher (SPEC §17.1). Double-click in Finder, or open from Spotlight.
# First time only: macOS may refuse to open it — right-click the file, choose "Open", then "Open".
# It installs what the app needs (once), starts it, and opens it in your browser.
# To stop the app, close this Terminal window (or press Control-C).

set -euo pipefail
cd "$(dirname "$0")"

echo "PTE-21C — Experience the Elements"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it once with Homebrew (https://brew.sh):"
  echo
  echo "    brew install node@22"
  echo
  echo "then open this launcher again."
  read -r -p "Press Return to close." _ || true
  exit 1
fi

major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 22 ]; then
  echo "This app needs Node.js 22 or newer; this Mac has $(node --version). Update it with:"
  echo
  echo "    brew install node@22"
  echo
  read -r -p "Press Return to close." _ || true
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing the app's building blocks (this takes a minute)…"
  npm install --no-audit --no-fund --loglevel=error
  echo
fi

echo "Starting PTE-21C. Your browser will open in a moment."
echo "Leave this window open while you use the app; close it to stop."
echo
exec npm run dev -- --open
