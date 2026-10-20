// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "orbitals",
  title: "Orbitals",
  summary: "What this atom's electrons are doing: one orbital per occupied subshell, the shell stack and the nodes.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
