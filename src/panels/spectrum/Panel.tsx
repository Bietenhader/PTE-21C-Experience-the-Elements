// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M3 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "The visible emission spectrum drawn from NIST's line list",
  "The strongest lines, and the flame-test colour where documented",
  "A Grotrian diagram of the lowest energy levels",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M3" planned={PLANNED} />;
}
