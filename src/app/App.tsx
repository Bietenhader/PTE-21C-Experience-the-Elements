// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// App shell: header, controls, the table in its zoom viewport, the trend legend, the legend,
// footer, the element sheet and the settings dialog.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDataset } from "../data/load";
import type { TrendsFile } from "../data/types";
import { search } from "../search/query";
import { ElementSheet } from "../sheet/ElementSheet";
import { Legend } from "../table/Legend";
import { TableView } from "../table/TableView";
import { TrendLegend } from "../trends/TrendLegend";
import { useOverlay } from "../trends/useOverlay";
import styles from "./App.module.css";
import { useReducedMotion } from "./motion";
import { SettingsDialog } from "./SettingsDialog";
import { useSettings, useView } from "./store";
import { Toolbar } from "./Toolbar";
import { useRouteSync } from "./useRouteSync";
import { useShortcuts } from "./useShortcuts";

const REPO = "https://github.com/Bietenhader/PTE-21C-Experience-the-Elements";

export function App() {
  const state = useDataset();
  const data = state.status === "ready" ? state.data : null;
  useRouteSync(data);
  useDocumentSettings();

  const layoutId = useSettings((s) => s.layout);
  const group3 = useSettings((s) => s.group3);
  const energy = useSettings((s) => s.energyUnit);
  const temperature = useSettings((s) => s.temperatureUnit);
  const overlay = useView((s) => s.overlay);
  const query = useView((s) => s.query);
  const sheetOpen = useView((s) => s.element !== null);
  const units = useMemo(() => ({ energy, temperature }), [energy, temperature]);

  const searchRef = useRef<HTMLInputElement>(null);
  const trendRef = useRef<HTMLSelectElement>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  const openTrends = useCallback(() => {
    const select = trendRef.current;
    if (!select) return;
    select.focus();
    try {
      select.showPicker();
    } catch {
      // showPicker is not available everywhere; focus alone lets arrow keys choose a trend.
    }
  }, []);
  useShortcuts({ focusSearch, openTrends });

  const elements = data?.index.elements;
  const result = useMemo(
    () => (elements ? search(elements, query, units) : { matches: [], message: "" }),
    [elements, query, units],
  );
  const matches = useMemo(() => (query.trim() ? new Set(result.matches) : null), [query, result]);
  const active = useOverlay(overlay, data?.trends ?? EMPTY_TRENDS, elements ?? [], units);
  const symbols = useMemo(() => (elements ?? []).map((e) => e.symbol), [elements]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>
            PTE-21C <span className={styles.titleRest}>Experience the Elements</span>
          </h1>
          <p className={styles.subtitle}>A fresh perspective on the Periodic Table of the Elements</p>
        </div>
        <button type="button" className={styles.settings} onClick={() => useView.setState({ settingsOpen: true })}>
          Settings
        </button>
      </header>

      {data && (
        <Toolbar trends={data.trends} symbols={symbols} search={result} searchRef={searchRef} trendRef={trendRef} />
      )}

      <main className={styles.main}>
        <p className={styles.preview} role="note">
          Preview (milestone M1): layouts, trends, search, hover cards and the element sheet's frame work. Photographs,
          the panels' contents and the remaining data arrive in milestones M2–M4.
        </p>
        {state.status === "loading" && <p className={styles.status}>Loading the elements…</p>}
        {state.status === "error" && (
          <p className={styles.status} role="alert">
            The data could not be loaded ({state.message}). Reload the page; if it persists, please open an issue.
          </p>
        )}
        {data && elements && (
          <>
            <TableView
              elements={elements}
              layout={data.layouts[layoutId]}
              group3={data.layouts[layoutId].group3Sensitive ? group3 : "lu"}
              sources={data.sources.sources}
              energyUnit={energy}
              faces={active && active.kind !== "arrows" ? active.faces : null}
              matches={matches}
              overlay={overlay}
              arrowTrend={active?.kind === "arrows" ? active.trend : null}
              sheetOpen={sheetOpen}
            />
            {active && <TrendLegend active={active} elements={elements} sources={data.sources.sources} units={units} />}
            <Legend
              elements={elements}
              variant={data.layouts[layoutId].variants[data.layouts[layoutId].group3Sensitive ? group3 : "lu"]}
              sources={data.sources.sources}
              energyUnit={energy}
            />
            <ElementSheet elements={elements} sources={data.sources.sources} />
          </>
        )}
        <SettingsDialog />
      </main>

      <footer className={styles.footer}>
        <p>
          Every number has a source: PubChem, the NIST Atomic Spectra Database, NIST Atomic Weights and Isotopic
          Compositions, IUPAC CIAAW, the IAEA LiveChart of Nuclides and CODATA 2022. See{" "}
          <a href={`${REPO}/blob/main/PROVENANCE.md`}>PROVENANCE.md</a> for versions, licences and retrieval dates.
        </p>
        <p>
          Privacy: no cookies, no analytics, and no requests to any other site — everything this page shows is
          served with it. Your settings stay in this browser.
        </p>
        <p>
          PTE-21C by Bietenhader (Fin) is licensed under{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>: free for non-commercial use
          and redistribution, including modified versions, under the same licence. <a href={REPO}>Source code</a>.
        </p>
      </footer>
    </div>
  );
}

const EMPTY_TRENDS: TrendsFile = { schemaVersion: 1, arrows: [], heatmaps: [], maps: [] };

/** Theme, palette and the effective motion preference live on <html> for the CSS. */
function useDocumentSettings() {
  const theme = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.palette = palette;
    root.dataset.motion = reduced ? "reduce" : "full";
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme);
  }, [theme, palette, reduced]);
}
