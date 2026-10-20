// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Writes the prerendered table into dist/index.html (run by `npm run build` after both Vite
// builds). The markup comes from the app's own components (dist-ssr/prerender.js) and the
// committed data, so it is exactly what the live app draws with the default settings, and
// src/main.tsx can hydrate it in place (or, for other settings, replace it).

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const SSR = join(ROOT, "dist-ssr", "prerender.js");
const read = (p) => JSON.parse(readFileSync(join(DIST, "data", p), "utf8"));

const { render } = await import(pathToFileURL(SSR).href);
const data = {
  index: read("index.json"),
  sources: read("sources.json"),
  layouts: { standard18: read("layouts/standard18.json") },
  trends: null,
};
const html = render(data);

const page = join(DIST, "index.html");
let template = readFileSync(page, "utf8");

// Inline the stylesheet so the first paint needs nothing but this file, and let the script and
// the data load behind the fonts: the prerendered table is already on screen.
const css = /<link rel="stylesheet" crossorigin href="([^"]+)">/.exec(template);
if (!css?.[1]) throw new Error("no stylesheet link in dist/index.html");
const cssFile = join(DIST, css[1].replace("/PTE-21C-Experience-the-Elements/", ""));
template = template.replace(css[0], `<style>${readFileSync(cssFile, "utf8")}</style>`);
template = template.replace('<script type="module" crossorigin', '<script type="module" fetchpriority="low" crossorigin');
const marker = '<div id="root"></div>';
if (!template.includes(marker)) throw new Error("dist/index.html has no empty #root to fill");
// The mark is the "first table paint" of the performance budget (tools/lighthouse.mjs): the first
// animation frame after the prerendered table is parsed is the frame that paints it.
const filled = template.replace(
  marker,
  `<div id="root" data-prerendered>${html}</div>` +
    `<script>requestAnimationFrame(function(){requestAnimationFrame(function(){performance.mark("pte:table")})})</script>`,
);
writeFileSync(page, filled);
rmSync(join(ROOT, "dist-ssr"), { recursive: true, force: true });
console.log(`prerendered the table into dist/index.html (${(filled.length / 1024).toFixed(0)} KiB)`);
