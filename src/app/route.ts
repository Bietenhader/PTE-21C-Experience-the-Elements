// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Hash routes (SPEC §9.4). Pure parse/format so they can be unit-tested; useRouteSync.ts wires
// them to the browser history.
//
//   #/                                   the table
//   #/?layout=janet&g3=la&trend=ie1&view=heat   table state
//   #/Cs                                 Caesium's sheet at the remembered panel
//   #/Cs/amo                             Caesium's sheet on the AMO panel
//
// Table state may follow any route (#/Cs/amo?layout=janet), so a shared link reproduces the table
// behind the sheet too. Only values that differ from the defaults are written.

import { isPanelSlug, type PanelSlug } from "../panels/slugs";

export const LAYOUT_IDS = ["standard18", "long32", "janet", "adomah"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export type Group3 = "lu" | "la";
export type OverlayKind = "arrows" | "heat" | "map";

export interface Overlay {
  kind: OverlayKind;
  id: string;
}

export interface Route {
  /** Element symbol with canonical capitalisation ("Cs"), or null for the table. */
  element: string | null;
  panel: PanelSlug | null;
  /** null: not given in the URL (the app falls back to the saved setting). */
  layout: LayoutId | null;
  group3: Group3 | null;
  /** Trend id; `view` may be absent when the id names only one kind of overlay. */
  trend: string | null;
  view: OverlayKind | null;
}

export const DEFAULT_LAYOUT: LayoutId = "standard18";
export const DEFAULT_GROUP3: Group3 = "lu";

const SYMBOL = /^[A-Za-z]{1,3}$/;
const TREND_ID = /^[a-z0-9-]{1,40}$/;
const VIEWS: Record<string, OverlayKind> = { arrows: "arrows", heat: "heat", map: "map" };

export const EMPTY_ROUTE: Route = { element: null, panel: null, layout: null, group3: null, trend: null, view: null };

function canonicalSymbol(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Never throws: anything it does not understand is dropped, so a mistyped link still opens the table. */
export function parseHash(hash: string): Route {
  const body = hash.replace(/^#/, "");
  const [rawPath = "", rawQuery = ""] = body.split("?", 2);
  const parts = rawPath.split("/").filter(Boolean).map(safeDecode);
  const route: Route = { ...EMPTY_ROUTE };

  const [symbol, panel] = parts;
  if (symbol && SYMBOL.test(symbol)) {
    route.element = canonicalSymbol(symbol);
    if (panel && isPanelSlug(panel.toLowerCase())) route.panel = panel.toLowerCase() as PanelSlug;
  }

  const q = new URLSearchParams(rawQuery);
  const layout = q.get("layout");
  if (layout && (LAYOUT_IDS as readonly string[]).includes(layout)) route.layout = layout as LayoutId;
  const g3 = q.get("g3");
  if (g3 === "lu" || g3 === "la") route.group3 = g3;
  const trend = q.get("trend");
  if (trend && TREND_ID.test(trend)) {
    route.trend = trend;
    route.view = VIEWS[q.get("view") ?? ""] ?? null;
  }
  return route;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

export interface TableState {
  layout: LayoutId;
  group3: Group3;
  overlay: Overlay | null;
}

/** The canonical hash for a sheet (or the table, when `element` is null) over the given table state. */
export function formatHash(element: string | null, panel: PanelSlug | null, table: TableState): string {
  let path = "#/";
  if (element) path += panel ? `${element}/${panel}` : element;
  const q = new URLSearchParams();
  if (table.layout !== DEFAULT_LAYOUT) q.set("layout", table.layout);
  if (table.group3 !== DEFAULT_GROUP3) q.set("g3", table.group3);
  if (table.overlay) {
    q.set("trend", table.overlay.id);
    q.set("view", table.overlay.kind);
  }
  const query = q.toString();
  return query ? `${path}?${query}` : path;
}
