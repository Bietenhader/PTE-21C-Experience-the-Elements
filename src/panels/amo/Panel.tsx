// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M4 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "Hyperfine structure for every isotope with a nuclear spin",
  "Clock transitions from the BIPM list — caesium defines the SI second",
  "Laser cooling: transitions, Doppler and recoil limits, first BEC",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M4" planned={PLANNED} />;
}
