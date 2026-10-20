// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Build-time render of the table with the default settings (tools/prerender.mjs writes it into
// dist/index.html). It lets the table paint before any script has run (SPEC §13.4: first table
// paint < 1.5 s on a throttled phone); the live app replaces it once its data is in.
import { renderToString } from "react-dom/server";
import { App } from "./app/App";
import type { Dataset } from "./data/load";

export function render(data: Dataset): string {
  return renderToString(<App boot={{ data }} />);
}
