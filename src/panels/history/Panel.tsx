// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M4 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "Discovery year, discoverers and place",
  "The origin of the name and the symbol, in our own words",
  "A timeline placing this element among all discoveries",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M4" planned={PLANNED} />;
}
