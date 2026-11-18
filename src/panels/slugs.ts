// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The eleven panel slugs in the order the sheet shows them: history, chemistry and biology first (Fin's
// choice, 2026-11-18), then the rest in the order of SPEC §10. Used by the router, the settings store
// and the panel registry, so it lives apart from the panels themselves.

export const PANEL_SLUGS = [
  "history",
  "chemistry",
  "biology",
  "orbitals",
  "em",
  "probability",
  "physical",
  "math",
  "amo",
  "nucleus",
  "spectrum",
] as const;

export type PanelSlug = (typeof PANEL_SLUGS)[number];

export function isPanelSlug(s: string): s is PanelSlug {
  return (PANEL_SLUGS as readonly string[]).includes(s);
}
