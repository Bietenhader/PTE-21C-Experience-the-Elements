// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M4 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "The probability of finding the valence electron within a radius",
  "Boson or fermion, isotope by isotope",
  "Thermal speed distributions down to the laser-cooling limits",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M4" planned={PLANNED} />;
}
