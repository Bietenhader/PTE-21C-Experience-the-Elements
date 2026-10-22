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
| three.js 0.186 (3D drawing of the orbitals; the marching-cubes tables come from its `MarchingCubes.js`) | MIT | 2010–2026 three.js authors |
| @react-three/fiber 9 (React renderer for three.js), with its helpers its-fine and suspend-react | MIT | Poimandres |
| KaTeX 0.18 (formulas) | MIT | 2013–2020 Khan Academy and other contributors |
| KaTeX fonts | SIL Open Font License 1.1 — `public/fonts/OFL-KaTeX.txt` | 2009–2010 Design Science, Inc.; 2014–2018 Khan Academy |
| D3 modules: d3-array, d3-scale, d3-scale-chromatic, d3-shape and their dependencies (d3-color, d3-format, d3-interpolate, d3-path, d3-time, d3-time-format, internmap) | ISC | 2010–2021 Mike Bostock |
| Floating UI (@floating-ui/react-dom, dom, core, utils) | MIT | 2021 Floating UI contributors |
| Zustand 5 and use-sync-external-store | MIT | 2019 Paul Henschel; Meta Platforms, Inc. and affiliates |

The ISC licence (D3): Permission to use, copy, modify, and/or distribute this software for any purpose with or
without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all
copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE.

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
