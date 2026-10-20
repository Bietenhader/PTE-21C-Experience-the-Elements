// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M4 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "The valence electrons' quantum numbers and the ground term spelled out",
  "Hund's rules and Slater's rules, step by step",
  "Relativity: the 1s electron's speed and what it does to chemistry",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M4" planned={PLANNED} />;
}
