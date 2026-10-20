// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "em",
  title: "Electromagnetic & ionization",
  summary: "The ionization ladder from the first electron to the last, electron affinity, electronegativity and electrical properties.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
