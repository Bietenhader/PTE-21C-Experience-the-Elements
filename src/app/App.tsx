// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// App shell for M0: header, the standard 18-column table, legend, footer. Interaction (hover card,
// layouts, trends, search, sheet) arrives in M1–M3.

import { useId, useState } from "react";
import { useDataset } from "../data/load";
import { Legend } from "../table/Legend";
import { PeriodicTable, type TileSize } from "../table/PeriodicTable";
import styles from "./App.module.css";

const REPO = "https://github.com/Bietenhader/PTE-21C-Experience-the-Elements";

export function App() {
  const state = useDataset("standard18");
  const [size, setSize] = useState<TileSize>("fit");
  const sizeName = useId();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>
            PTE-21C <span className={styles.titleRest}>Experience the Elements</span>
          </h1>
          <p className={styles.subtitle}>A fresh perspective on the Periodic Table of the Elements</p>
        </div>
        <fieldset className={styles.controls}>
          <legend className={styles.controlsLegend}>Tile size</legend>
          {(
            [
              ["fit", "Compact"],
              ["full", "Full-size tiles"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.option}>
              <input
                type="radio"
                name={sizeName}
                value={value}
                checked={size === value}
                onChange={() => setSize(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </header>

      <main className={styles.main}>
        <p className={styles.preview} role="note">
          Early preview (milestone M0): the table and its data. Hover cards, layouts, trends and the element sheets
          arrive in the next milestones.
        </p>
        {state.status === "loading" && <p className={styles.status}>Loading the elements…</p>}
        {state.status === "error" && (
          <p className={styles.status} role="alert">
            The data could not be loaded ({state.message}). Reload the page; if it persists, please open an issue.
          </p>
        )}
        {state.status === "ready" && (
          <>
            <PeriodicTable
              elements={state.data.index.elements}
              layout={state.data.layout}
              group3="lu"
              sources={state.data.sources.sources}
              size={size}
            />
            <Legend
              elements={state.data.index.elements}
              variant={state.data.layout.variants.lu}
              sources={state.data.sources.sources}
            />
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          Every number has a source: PubChem, the NIST Atomic Spectra Database, NIST Atomic Weights and Isotopic
          Compositions, IUPAC CIAAW, the IAEA LiveChart of Nuclides and CODATA 2022. See{" "}
          <a href={`${REPO}/blob/main/PROVENANCE.md`}>PROVENANCE.md</a> for versions, licences and retrieval dates.
        </p>
        <p>
          Privacy: no cookies, no analytics, and no requests to any other site — everything this page shows is
          served with it.
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
