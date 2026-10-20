// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "chemistry",
  title: "Chemistry & bonding",
  summary: "Oxidation states with example compounds, sizes, bonding and reactivity.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
