// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "physical",
  title: "Physical & engineering",
  summary: "Phase, density, thermal and mechanical properties, crystal structure and abundance.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
