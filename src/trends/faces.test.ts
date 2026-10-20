// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, TrendsFile } from "../data/types";
import { contrast } from "../ui/contrast";
import { heatFaces, mapFaces } from "./faces";

const read = <T,>(p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), "utf8")) as T;
const elements = read<IndexFile>("index.json").elements;
const trends = read<TrendsFile>("trends.json");
const units = { energy: "kJ/mol", temperature: "K" } as const;

describe("heatmap faces", () => {
  it.each(trends.heatmaps.map((h) => [h.id, h] as const))("%s: a face per element, readable ink, honest gaps", (_id, h) => {
    const { faces, legend } = heatFaces(elements, h, units);
    expect(faces.size).toBe(118);
    let missing = 0;
    for (const f of faces.values()) {
      expect(f.text).not.toBe("");
      // A count can truly be zero (technetium has no stable isotope); nothing else may show 0.
      if (h.id !== "stable-isotopes") expect(f.text).not.toBe("0");
      if (f.missing) missing++;
      else expect(contrast(f.ink, f.fill)).toBeGreaterThanOrEqual(4.5);
    }
    expect(legend.missing).toBe(missing);
    expect(legend.gradient).toMatch(/^linear-gradient/);
    for (const t of legend.ticks) expect(t.at).toBeGreaterThanOrEqual(0);
  });

  it("colours the extremes of ionization energy at the ends of the scale", () => {
    const { faces } = heatFaces(elements, trends.heatmaps.find((h) => h.id === "ie1") as never, units);
    expect(faces.get(2)?.fill).toBe("#fde725"); // He: highest first ionization energy → bright end
    expect(faces.get(55)?.fill).toBe("#440154"); // Cs: lowest measured → dark end
  });
});

describe("map faces", () => {
  it.each(trends.maps.map((m) => [m.id, m] as const))("%s: every element in a declared class", (_id, m) => {
    const { faces, counts } = mapFaces(elements, m);
    expect(faces.size).toBe(118);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(118);
    for (const f of faces.values()) expect(f.fill).toMatch(/^var\(--map-[1-8]\)$/);
  });
});
