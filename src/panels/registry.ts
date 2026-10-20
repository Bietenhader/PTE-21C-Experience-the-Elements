// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The eleven panels in the order of SPEC §10 (LOCKED). One line per panel.

import { panel as amo } from "./amo";
import { panel as biology } from "./biology";
import { panel as chemistry } from "./chemistry";
import { panel as em } from "./em";
import { panel as history } from "./history";
import { panel as math } from "./math";
import { panel as nucleus } from "./nucleus";
import { panel as orbitals } from "./orbitals";
import { panel as physical } from "./physical";
import { panel as probability } from "./probability";
import { PANEL_SLUGS } from "./slugs";
import { panel as spectrum } from "./spectrum";
import type { PanelModule } from "./types";

export const PANELS: readonly PanelModule[] = [
  orbitals,
  em,
  probability,
  physical,
  math,
  amo,
  nucleus,
  spectrum,
  chemistry,
  biology,
  history,
];

if (PANELS.map((p) => p.slug).join() !== PANEL_SLUGS.join()) {
  throw new Error("panels are registered out of the order of SPEC §10");
}
