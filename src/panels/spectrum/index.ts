// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "spectrum",
  title: "Spectrum & energy levels",
  summary: "The visible spectrum of the neutral atom, its strongest lines and its energy levels.",
  Component: lazy(() => import("./Panel")),
  needs: ["spectra", "levels"],
};
