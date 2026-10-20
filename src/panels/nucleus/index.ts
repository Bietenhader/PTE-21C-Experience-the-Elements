// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "nucleus",
  title: "Nucleus & isotopes",
  summary: "Every known isotope, how the radioactive ones decay, and where the element was made.",
  Component: lazy(() => import("./Panel")),
  needs: ["isotopes"],
};
