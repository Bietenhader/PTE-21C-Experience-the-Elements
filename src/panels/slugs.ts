// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The eleven panel slugs in the order of SPEC §10 (LOCKED). Used by the router, the settings store
// and the panel registry, so it lives apart from the panels themselves.

export const PANEL_SLUGS = [
  "orbitals",
  "em",
  "probability",
  "physical",
  "math",
  "amo",
  "nucleus",
  "spectrum",
  "chemistry",
  "biology",
  "history",
] as const;

export type PanelSlug = (typeof PANEL_SLUGS)[number];

export function isPanelSlug(s: string): s is PanelSlug {
  return (PANEL_SLUGS as readonly string[]).includes(s);
}
