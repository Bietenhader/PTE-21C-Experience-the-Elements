// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M3 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "Every ionization energy, first to last, on a log axis — the staircase that is shell structure",
  "Electron affinity and electronegativity on three scales",
  "Polarizability, magnetism, resistivity and more where measured",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M3" planned={PLANNED} />;
}
