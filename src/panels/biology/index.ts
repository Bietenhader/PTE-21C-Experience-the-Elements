// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { lazy } from "react";
import type { PanelModule } from "../types";

export const panel: PanelModule = {
  slug: "biology",
  title: "Biology & ecology",
  summary: "Whether life needs this element, how much, and how it can harm.",
  Component: lazy(() => import("./Panel")),
  needs: ["elements"],
};
