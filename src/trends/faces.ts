// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Tile faces for heatmaps and categorical maps (SPEC §8.2, §8.3). Loaded on first use, so D3
// stays out of the first download (SPEC §14).

import { scaleLinear, scaleLog } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import type { CategoricalMap, ElementIndexEntry, Heatmap } from "../data/types";
import type { Face } from "../table/face";
import { bestInk } from "../ui/contrast";
import { domain, formatValue, series, type Units } from "./values";

export interface HeatLegend {
  unit: string;
  log: boolean;
  /** CSS linear-gradient stops for the colour bar. */
  gradient: string;
  ticks: Array<{ text: string; at: number }>;
  min: string;
  max: string;
  missing: number;
}

export interface HeatResult {
  faces: Map<number, Face>;
  legend: HeatLegend;
}

export function heatFaces(elements: ElementIndexEntry[], h: Heatmap, units: Units): HeatResult {
  const points = series(elements, h, units);
  const log = h.scale === "log";
  const [lo, hi] = domain(points, log) ?? [0, 1];
  const scale = (log ? scaleLog() : scaleLinear()).domain([lo, hi === lo ? lo + 1 : hi]).range([0, 1]).clamp(true);
  const faces = new Map<number, Face>();
  let missing = 0;
  let unit = "";
  for (const p of points) {
    if (!p.v.ok) {
      missing++;
      faces.set(p.Z, {
        kind: "heat",
        fill: "var(--hatch-a)",
        ink: "var(--tile-ink)",
        text: p.v.text,
        missing: true,
        description: `Heatmap, ${p.v.long}.`,
      });
      continue;
    }
    unit = p.v.unit;
    const fill = interpolateViridis(scale(p.v.value));
    faces.set(p.Z, { kind: "heat", fill, ink: bestInk(fill), text: p.v.text, missing: false, description: `Heatmap, ${p.v.long}.` });
  }
  const stops = Array.from({ length: 11 }, (_, i) => `${interpolateViridis(i / 10)} ${i * 10}%`).join(", ");
  const ticks = scale
    .ticks(log ? 4 : 5)
    .filter((v) => v >= lo && v <= hi)
    .map((v) => ({ text: formatValue(v, unit), at: scale(v) }));
  return {
    faces,
    legend: {
      unit,
      log,
      gradient: `linear-gradient(to right, ${stops})`,
      ticks: thin(ticks),
      min: formatValue(lo, unit),
      max: formatValue(hi, unit),
      missing,
    },
  };
}

/** At most five tick labels, so they never collide on a phone. */
function thin<T>(ticks: T[]): T[] {
  if (ticks.length <= 5) return ticks;
  const step = Math.ceil(ticks.length / 5);
  return ticks.filter((_, i) => i % step === 0);
}

export interface MapResult {
  faces: Map<number, Face>;
  counts: Record<string, number>;
}

export function mapFaces(elements: ElementIndexEntry[], m: CategoricalMap): MapResult {
  const faces = new Map<number, Face>();
  const counts: Record<string, number> = Object.fromEntries(m.classes.map((c) => [c.id, 0]));
  for (const e of elements) {
    const id = m.values[String(e.Z)];
    const cls = m.classes.find((c) => c.id === id);
    if (!cls) throw new Error(`map ${m.id}: element ${e.Z} has no class`);
    counts[cls.id] = (counts[cls.id] ?? 0) + 1;
    faces.set(e.Z, {
      kind: "map",
      fill: `var(--map-${cls.tone})`,
      ink: "var(--tile-ink)",
      text: cls.short,
      missing: false,
      description: `Map, ${m.label}: ${cls.label}. ${cls.description}`,
    });
  }
  return { faces, counts };
}
