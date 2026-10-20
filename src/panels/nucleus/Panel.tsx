// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Placeholder until milestone M3 builds this panel (SPEC §10, §18).
import { PanelPlaceholder } from "../PanelPlaceholder";
import type { PanelProps } from "../types";

const PLANNED = [
  "An isotope strip with half-lives on a log scale",
  "Decay modes, binding energy per nucleon and a survival curve",
  "Cosmic origin: which stars made this element (approximate)",
];

export default function Panel(props: PanelProps) {
  return <PanelPlaceholder {...props} milestone="M3" planned={PLANNED} />;
}
