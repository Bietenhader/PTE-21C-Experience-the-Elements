// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "history",
  title: "History & naming",
  summary: "Who found it, when and where, and where the name comes from.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
