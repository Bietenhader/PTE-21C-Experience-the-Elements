// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Everything that changes what the table shows goes through these functions, so the layout morph
// is captured before the change and the URL follows (SPEC §7.2, §9.4).

import type { PanelSlug } from "../panels/slugs";
import { captureMorph } from "../table/morph";
import { formatHash, type Group3, LAYOUT_IDS, type LayoutId, type Overlay } from "./route";
import { useSettings, useView } from "./store";

/** Arrow trends presuppose groups and periods (SPEC §8): only the two standard forms have them. */
export const ARROW_LAYOUTS: readonly LayoutId[] = ["standard18", "long32"];

export function setLayout(id: LayoutId): void {
  if (useSettings.getState().layout === id) return;
  captureMorph();
  const { overlay } = useView.getState();
  if (overlay?.kind === "arrows" && !ARROW_LAYOUTS.includes(id)) useView.setState({ overlay: null });
  useSettings.getState().set("layout", id);
}

export function cycleLayout(step: 1 | -1): void {
  const i = LAYOUT_IDS.indexOf(useSettings.getState().layout);
  const next = LAYOUT_IDS[(i + step + LAYOUT_IDS.length) % LAYOUT_IDS.length];
  if (next) setLayout(next);
}

export function setGroup3(v: Group3): void {
  if (useSettings.getState().group3 === v) return;
  captureMorph();
  useSettings.getState().set("group3", v);
}

export function setOverlay(overlay: Overlay | null): void {
  if (overlay?.kind === "arrows" && !ARROW_LAYOUTS.includes(useSettings.getState().layout)) return;
  useView.setState({ overlay });
}

export function setQuery(query: string): void {
  useView.setState({ query });
}

// --- The sheet and the browser history ---------------------------------------------------------

let suppressUrlWrite = false;
export const urlWritesSuppressed = () => suppressUrlWrite;

export function currentHash(element = useView.getState().element, panel = useView.getState().panel): string {
  const { layout, group3 } = useSettings.getState();
  return formatHash(element, panel, { layout, group3, overlay: useView.getState().overlay });
}

/** Opens an element's sheet on the remembered panel, as a new history entry (Back closes it). */
export function openElement(symbol: string, panel?: PanelSlug): void {
  const p = panel ?? useSettings.getState().lastPanel;
  history.pushState({ pteSheet: true }, "", currentHash(symbol, p));
  useView.setState({ element: symbol, panel: p });
}

export function setPanel(panel: PanelSlug): void {
  useSettings.getState().set("lastPanel", panel);
  useView.setState({ panel });
}

/** Closes the sheet: steps back if we opened it, otherwise rewrites the URL to the table. */
export function closeSheet(): void {
  if (!useView.getState().element) return;
  const pushed = (history.state as { pteSheet?: boolean } | null)?.pteSheet === true;
  suppressUrlWrite = pushed;
  useView.setState({ element: null, panel: null });
  suppressUrlWrite = false;
  if (pushed) history.back();
}
