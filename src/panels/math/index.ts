// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "math",
  title: "Mathematical & theoretical",
  summary: "Quantum numbers, Hund's rules, screening and relativity, with the arithmetic shown.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
