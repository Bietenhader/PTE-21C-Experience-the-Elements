// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// WCAG 2.2 AA contrast for every tile on every category fill, both palettes, both themes (SPEC §2.9, §7.3).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bestInk, contrast } from "../ui/contrast";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const root = block(":root");
const themes = {
  "dark · Campion": root,
  "light · Campion": { ...root, ...block(':root[data-theme="light"]') },
  "dark · Colour-safe": { ...root, ...block(':root[data-palette="colour-safe"]') },
  "light · Colour-safe": {
    ...root,
    ...block(':root[data-theme="light"]'),
    ...block(':root[data-palette="colour-safe"]'),
    ...block(':root[data-theme="light"][data-palette="colour-safe"]'),
  },
};

const CATEGORIES = [
  "alkali-metal",
  "alkaline-earth-metal",
  "lanthanide",
  "actinide",
  "transition-metal",
  "post-transition-metal",
  "metalloid",
  "reactive-nonmetal",
  "noble-gas",
  "unknown",
];

describe.each(Object.entries(themes))("%s", (_name, vars) => {
  const v = (k: string) => {
    const value = vars[k];
    if (!value) throw new Error(`missing token ${k}`);
    return value;
  };

  it.each(CATEGORIES)("tile text on %s passes 4.5:1", (cat) => {
    expect(contrast(v("--tile-ink"), v(`--cat-${cat}`))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v("--tile-ink-muted"), v(`--cat-${cat}`))).toBeGreaterThanOrEqual(4.5);
  });

  it("page text passes 4.5:1", () => {
    expect(contrast(v("--text"), v("--bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v("--text-muted"), v("--bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v("--link"), v("--bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring passes 3:1 against the page", () => {
    expect(contrast(v("--focus"), v("--bg"))).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme accents", () => {
  it.each(Object.entries({ "dark · Campion": themes["dark · Campion"], "dark · Colour-safe": themes["dark · Colour-safe"] }))(
    "%s hover accents pass the 3:1 non-text minimum",
    (_name, vars) => {
      for (const cat of CATEGORIES) {
        expect(contrast(vars[`--accent-${cat}`] ?? "", vars["--bg"] ?? "")).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe("map tones and hatching (SPEC §8.3)", () => {
  it.each(Object.entries(themes))("%s: tile text passes 4.5:1 on every map tone and on the hatch", (_name, vars) => {
    for (let tone = 1; tone <= 8; tone++) {
      expect(contrast(vars["--tile-ink"] ?? "", vars[`--map-${tone}`] ?? ""), `tone ${tone}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const h of ["--hatch-a", "--hatch-b"]) {
      expect(contrast(vars["--tile-ink"] ?? "", vars[h] ?? ""), h).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("heatmap ink", () => {
  it("black or white always reaches 4.5:1 on any fill", () => {
    for (let i = 0; i < 4096; i++) {
      const hex = `#${[i >> 8, (i >> 4) & 15, i & 15].map((n) => (n * 17).toString(16).padStart(2, "0")).join("")}`;
      expect(contrast(bestInk(hex), hex)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
