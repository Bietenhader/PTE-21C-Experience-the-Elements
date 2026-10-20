<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Contributing

Thank you for helping. By contributing you agree that your contribution is licensed under
**CC BY-NC-SA 4.0**, the project licence.

## The three rules

1. **No number without a source.** Every value carries a `source` key from `tools/sources.toml`.
2. **Missing is shown as missing, with a reason** — never as 0, a dash or a guess.
3. **Nothing typed into app code.** Data comes from the fetchers in `tools/` or from a curated TOML row.

## Adding or correcting a curated value

Curated values live in `tools/curated/*.toml`, one `[[row]]` per value. Each row needs a `source` that exists
in `tools/sources.toml` (add the source there first if it is new: title, URL, licence, citation) and, where one
exists, a `doi`. Transcribe the number from the primary reference with its uncertainty; if you are not sure
of a value, leave it out — an honest gap beats a plausible guess. Write any prose in your own words.

Then run `tools/pipeline.command` (or `python tools/pipeline.py --offline` if the raw cache is present) and
`python tools/report.py`, and check `tools/build-report.md`.

## Before opening a pull request

```
npm run lint && npm run typecheck && npm test && npm run test:e2e
cd tools && pytest && ruff check . && ruff format --check .
```

New source files start with `// SPDX-License-Identifier: CC-BY-NC-SA-4.0` (`#` in Python and TOML).
Dependencies must be MIT, ISC, BSD, Apache-2.0 or similarly permissive; no GPL, AGPL or LGPL.
