// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Resolves the active overlay into what the table and the legend draw. Heatmap and map faces are
// computed in a chunk that loads on first use (it carries the D3 colour scales).

import { useEffect, useState } from "react";
import type { Overlay } from "../app/route";
import type { ArrowTrend, CategoricalMap, ElementIndexEntry, Heatmap, TrendsFile } from "../data/types";
import type { Faces } from "../table/face";
import type { HeatLegend } from "./faces";
import type { Units } from "./values";

export type ActiveOverlay =
  | { kind: "arrows"; trend: ArrowTrend }
  | { kind: "heat"; heatmap: Heatmap; faces: Faces; legend: HeatLegend }
  | { kind: "map"; map: CategoricalMap; faces: Faces; counts: Record<string, number> };

export function useOverlay(
  overlay: Overlay | null,
  trends: TrendsFile,
  elements: ElementIndexEntry[],
  units: Units,
): ActiveOverlay | null {
  const [computed, setComputed] = useState<{ key: string; value: ActiveOverlay } | null>(null);
  const key = overlay ? `${overlay.kind}:${overlay.id}:${units.energy}:${units.temperature}` : "";
  const { energy, temperature } = units;

  useEffect(() => {
    if (!overlay || overlay.kind === "arrows") return;
    let live = true;
    void import("./faces").then((m) => {
      if (!live) return;
      const u = { energy, temperature };
      if (overlay.kind === "heat") {
        const heatmap = trends.heatmaps.find((h) => h.id === overlay.id);
        if (heatmap) setComputed({ key, value: { kind: "heat", heatmap, ...m.heatFaces(elements, heatmap, u) } });
      } else {
        const map = trends.maps.find((x) => x.id === overlay.id);
        if (map) setComputed({ key, value: { kind: "map", map, ...m.mapFaces(elements, map) } });
      }
    });
    return () => {
      live = false;
    };
  }, [overlay, trends, elements, energy, temperature, key]);

  if (!overlay) return null;
  if (overlay.kind === "arrows") {
    const trend = trends.arrows.find((a) => a.id === overlay.id);
    return trend ? { kind: "arrows", trend } : null;
  }
  return computed?.key === key ? computed.value : null;
}
