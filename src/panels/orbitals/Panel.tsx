// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M3 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "A 3D orbital gallery, one shape per occupied subshell (hydrogenic, with Clementi–Raimondi effective charges)",
  "The shell stack: every radial distribution on one axis, to true scale",
  "A table of nodes, occupancies and orbital energies",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M3" planned={PLANNED} />;
}
