// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M4 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "Melting and boiling points, heat capacity, conductivity, moduli and hardness",
  "A rotatable crystal unit cell",
  "Abundance in the crust, the ocean, the Sun and the human body",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M4" planned={PLANNED} />;
}
