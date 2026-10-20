// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Keeps the URL and the app state in step (SPEC §9.4): reads the hash on start and on
// Back/Forward or a pasted link, and rewrites it (without a new history entry) whenever the table
// state or the panel changes. Opening a sheet adds an entry (see actions.ts).

import { useEffect, useRef } from "react";
import type { Dataset } from "../data/load";
import type { TrendsFile } from "../data/types";
import { ARROW_LAYOUTS, currentHash, setGroup3, setLayout, urlWritesSuppressed } from "./actions";
import { type Overlay, type OverlayKind, parseHash, type Route } from "./route";
import { useSettings, useView } from "./store";

export function resolveOverlay(route: Route, trends: TrendsFile, layout: string): Overlay | null {
  const id = route.trend;
  if (!id) return null;
  const has: Record<OverlayKind, boolean> = {
    heat: trends.heatmaps.some((h) => h.id === id),
    map: trends.maps.some((m) => m.id === id),
    arrows: trends.arrows.some((a) => a.id === id) && ARROW_LAYOUTS.includes(layout as never),
  };
  if (route.view) return has[route.view] ? { kind: route.view, id } : null;
  const kind = (["heat", "map", "arrows"] as const).find((k) => has[k]);
  return kind ? { kind, id } : null;
}

function writeUrl(): void {
  if (urlWritesSuppressed()) return;
  const next = currentHash();
  if (next !== location.hash && !(next === "#/" && location.hash === "")) {
    history.replaceState(history.state, "", next);
  }
}

/** Before the first render: the layout in the URL decides which layout file is fetched first. */
export function applyInitialTableState(): void {
  const route = parseHash(location.hash);
  if (route.layout) useSettings.getState().set("layout", route.layout);
  if (route.group3) useSettings.getState().set("group3", route.group3);
}

export function applyRoute(route: Route, data: Dataset & { trends: TrendsFile }): void {
  if (route.layout) setLayout(route.layout);
  if (route.group3) setGroup3(route.group3);
  const layout = useSettings.getState().layout;
  const overlay = resolveOverlay(route, data.trends, layout);
  const known = route.element && data.index.elements.some((e) => e.symbol === route.element);
  const element = known ? route.element : null;
  const panel = element ? (route.panel ?? useSettings.getState().lastPanel) : null;
  // A panel opened from a link counts as the last one opened (SPEC §9.2).
  if (element && route.panel) useSettings.getState().set("lastPanel", route.panel);
  useView.setState({ overlay, element, panel });
  writeUrl();
}

/** Starts once the index and trends.json are in: a link's trend and element need both. */
export function useRouteSync(data: Dataset | null): void {
  const ready = data !== null && data.trends !== null;
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });
  useEffect(() => {
    const d = latest.current;
    if (!ready || !d?.trends) return;
    const full = { ...d, trends: d.trends };
    const apply = () => applyRoute(parseHash(location.hash), full);
    apply();
    window.addEventListener("popstate", apply);
    window.addEventListener("hashchange", apply);
    const unView = useView.subscribe((s, prev) => {
      if (s.overlay !== prev.overlay || s.panel !== prev.panel || s.element !== prev.element) writeUrl();
    });
    const unSettings = useSettings.subscribe((s, prev) => {
      if (s.layout !== prev.layout || s.group3 !== prev.group3) writeUrl();
    });
    return () => {
      window.removeEventListener("popstate", apply);
      window.removeEventListener("hashchange", apply);
      unView();
      unSettings();
    };
  }, [ready]);
}
