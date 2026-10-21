<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# NOTICE — third-party software and fonts

PTE-21C itself is licensed under CC BY-NC-SA 4.0 (see LICENSE). The following third-party works are used under
their own licences, which are not changed by the project licence. `npm run check:licences` verifies that no
GPL/AGPL/LGPL package is used and that everything shipped to visitors is permissively licensed (SPEC §15.2).

## Shipped with the web app

| Component | Licence | Copyright |
|---|---|---|
| React, React DOM, scheduler 19.x | MIT | Meta Platforms, Inc. and affiliates |
| Alegreya Sans (fonts in `public/fonts/`) | SIL Open Font License 1.1 — `public/fonts/OFL-Alegreya-Sans.txt` | 2013 The Alegreya Sans Project Authors (Huerta Tipográfica) |
| IBM Plex Sans Variable | SIL Open Font License 1.1 — `public/fonts/OFL-IBM-Plex-Sans.txt` | 2019 IBM Corp. |
| IBM Plex Mono | SIL Open Font License 1.1 — `public/fonts/OFL-IBM-Plex-Mono.txt` | 2017 IBM Corp. |

The MIT licence: Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following
conditions: The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Development tools (not shipped)

Build, test and lint tools, used only on developer machines and in CI: Vite, Vitest, TypeScript, ESLint and
its plugins, typescript-eslint, json-schema-to-typescript and Playwright (MIT or Apache-2.0); axe-core and
@axe-core/playwright for accessibility tests, and lightningcss inside Vite (MPL-2.0, used unmodified).
The data pipeline uses jsonschema, pytest and ruff (MIT) and Pillow (MIT-CMU, a permissive licence) to convert
photographs. Their full licence texts ship inside each package. Two published tables (Clementi–Raimondi
effective nuclear charges and Allen's configuration energies) were read from their transcription in the
mendeleev package (MIT); the numbers are credited to the original papers.
