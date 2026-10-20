// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "probability",
  title: "Probability & statistics",
  summary: "Where the electron probably is, how the isotopes mix, and what quantum statistics this atom obeys.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements", "isotopes"],
};
