// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The controls above the table: layout (SPEC §7.2), group 3, trend overlay (§8) and search (§7.4).

import { type KeyboardEvent, type RefObject, useId } from "react";
import type { TrendsFile } from "../data/types";
import { ARROW_LAYOUTS, openElement, setGroup3, setLayout, setOverlay, setQuery } from "./actions";
import { type LayoutId, LAYOUT_IDS, type OverlayKind } from "./route";
import { useSettings, useView } from "./store";
import styles from "./Toolbar.module.css";

export const LAYOUT_LABEL: Record<LayoutId, string> = {
  standard18: "Standard",
  long32: "Long form",
  janet: "Janet",
  adomah: "ADOMAH",
};

interface Props {
  trends: TrendsFile;
  /** Symbol for each Z, to open the first search match. */
  symbols: string[];
  search: { matches: number[]; message: string };
  searchRef: RefObject<HTMLInputElement | null>;
  trendRef: RefObject<HTMLSelectElement | null>;
}

export function Toolbar({ trends, symbols, search, searchRef, trendRef }: Props) {
  const layout = useSettings((s) => s.layout);
  const group3 = useSettings((s) => s.group3);
  const shortcuts = useSettings((s) => s.shortcuts);
  const overlay = useView((s) => s.overlay);
  const query = useView((s) => s.query);
  const name = useId();
  const g3Name = useId();
  const trendNote = useId();
  const searchNote = useId();
  const arrowsAllowed = ARROW_LAYOUTS.includes(layout);
  const g3Applies = ARROW_LAYOUTS.includes(layout);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const z = search.matches[0];
      const symbol = z === undefined ? undefined : symbols[z - 1];
      if (symbol) {
        e.preventDefault();
        openElement(symbol);
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  };

  return (
    <div className={styles.toolbar}>
      <fieldset className={styles.group}>
        <legend>
          Layout{shortcuts && <kbd className={styles.kbd} aria-hidden="true">L</kbd>}
        </legend>
        <div className={styles.segmented}>
          {LAYOUT_IDS.map((id) => (
            <label key={id}>
              <input type="radio" name={name} value={id} checked={layout === id} onChange={() => setLayout(id)} />
              <span>{LAYOUT_LABEL[id]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={!g3Applies} aria-describedby={g3Applies ? undefined : `${g3Name}-note`}>
        <legend>Group 3</legend>
        <div className={styles.segmented}>
          {(
            [
              ["lu", "Lu · Lr"],
              ["la", "La · Ac"],
            ] as const
          ).map(([v, label]) => (
            <label key={v}>
              <input type="radio" name={g3Name} value={v} checked={group3 === v} onChange={() => setGroup3(v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {!g3Applies && (
          <span id={`${g3Name}-note`} className="visually-hidden">
            Janet's and the ADOMAH tables always put lutetium and lawrencium in group 3.
          </span>
        )}
      </fieldset>

      <div className={styles.group}>
        <label htmlFor={`${name}-trend`} className={styles.label}>
          Trend{shortcuts && <kbd className={styles.kbd} aria-hidden="true">T</kbd>}
        </label>
        <select
          id={`${name}-trend`}
          ref={trendRef}
          className={styles.select}
          value={overlay ? `${overlay.kind}:${overlay.id}` : ""}
          aria-describedby={arrowsAllowed ? undefined : trendNote}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":") as [OverlayKind, string];
            setOverlay(e.target.value ? { kind, id } : null);
          }}
        >
          <option value="">None — category colours</option>
          <optgroup label={arrowsAllowed ? "Arrows: how a property changes" : "Arrows (standard and long form only)"}>
            {trends.arrows.map((a) => (
              <option key={a.id} value={`arrows:${a.id}`} disabled={!arrowsAllowed}>
                {a.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Heatmaps: measured values">
            {trends.heatmaps.map((h) => (
              <option key={h.id} value={`heat:${h.id}`}>
                {h.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Maps: groups of elements">
            {trends.maps.map((m) => (
              <option key={m.id} value={`map:${m.id}`}>
                {m.label}
              </option>
            ))}
          </optgroup>
        </select>
        {!arrowsAllowed && (
          <p id={trendNote} className={styles.note}>
            Arrow trends need groups and periods, so they are offered in the standard and long forms only.
          </p>
        )}
      </div>

      <div className={`${styles.group} ${styles.searchGroup}`}>
        <label htmlFor={`${name}-search`} className={styles.label}>
          Search{shortcuts && <kbd className={styles.kbd} aria-hidden="true">/</kbd>}
        </label>
        <input
          id={`${name}-search`}
          ref={searchRef}
          type="search"
          className={styles.search}
          value={query}
          placeholder="Name, symbol, Z, “ionization > 1000”…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={searchNote}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
        />
        <p id={searchNote} className={styles.note} aria-live="polite" data-testid="search-status">
          {search.message}
        </p>
      </div>
    </div>
  );
}
