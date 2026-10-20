// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Entry point. The prerendered table in index.html (tools/prerender.mjs) stays on screen until the
// core data has arrived. With the default table settings React hydrates it in place (nothing is
// redrawn); otherwise it replaces it in a single commit with the live table.
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./app/tokens.css";
import "./app/global.css";
import { App, type Boot } from "./app/App";
import { useSettings } from "./app/store";
import { applyInitialTableState } from "./app/useRouteSync";
import { loadCore } from "./data/load";

applyInitialTableState();

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

/** The prerendered page shows the default table; hydrating it is safe only when that is what we draw. */
function matchesPrerender(): boolean {
  const s = useSettings.getState();
  const hash = location.hash.replace(/^#\/?/, "");
  return (
    root?.dataset.prerendered !== undefined &&
    s.layout === "standard18" &&
    s.group3 === "lu" &&
    s.energyUnit === "kJ/mol" &&
    s.shortcuts &&
    !hash.includes("?")
  );
}

const render = (boot: Boot) => {
  const app = (
    <StrictMode>
      <App boot={boot} />
    </StrictMode>
  );
  if ("data" in boot && matchesPrerender()) hydrateRoot(root, app);
  else createRoot(root).render(app);
};

loadCore(useSettings.getState().layout).then(
  (data) => render({ data }),
  (err: unknown) => render({ error: err instanceof Error ? err.message : String(err) }),
);
