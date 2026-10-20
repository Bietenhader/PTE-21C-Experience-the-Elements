// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The panel plugin contract (CLAUDE.md conventions, SPEC §10): each src/panels/<slug>/ exports
// { slug, title, summary, Component, needs }, registered with one line in registry.ts.

import type { ComponentType, LazyExoticComponent } from "react";
import type { ElementIndexEntry, SourcesFile } from "../data/types";
import type { PanelSlug } from "./slugs";

export interface PanelProps {
  element: ElementIndexEntry;
  sources: SourcesFile["sources"];
}

export interface PanelModule {
  slug: PanelSlug;
  title: string;
  /** One line, shown under the title. */
  summary: string;
  /** Lazily loaded, so each panel is its own chunk (SPEC §14). */
  Component: LazyExoticComponent<ComponentType<PanelProps>>;
  /** Data files the panel reads, loaded when it comes near (SPEC §14). */
  needs: Array<"elements" | "isotopes" | "spectra" | "levels">;
}
