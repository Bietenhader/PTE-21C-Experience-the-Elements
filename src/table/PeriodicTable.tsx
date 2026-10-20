// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The table grid: tiles placed on a CSS grid from layout data (SPEC §4.3.4, §7.2). DOM order
// follows Z, so Tab order follows Z (SPEC §9.5) whatever the layout; arrow keys move in the layout.

import { type CSSProperties, type KeyboardEvent, type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "../app/motion";
import type { Group3 } from "../app/route";
import type { ElementIndexEntry, LayoutFile, SourcesFile } from "../data/types";
import type { EnergyUnit } from "../physics/units";
import type { Faces } from "./face";
import { gridGeometry } from "./grid";
import { playMorph } from "./morph";
import { KEY_DIRECTION, neighbour } from "./neighbours";
import styles from "./PeriodicTable.module.css";
import { Tile } from "./Tile";
import { tileAspect } from "./zoom";

interface Props {
  elements: ElementIndexEntry[];
  layout: LayoutFile;
  group3: Group3;
  sources: SourcesFile["sources"];
  tileWidth: number;
  energyUnit: EnergyUnit;
  faces: Faces | null;
  /** Search matches; null when no search is active. */
  matches: ReadonlySet<number> | null;
  /** Extra room around the grid for trend arrows. */
  arrows: boolean;
  ghosts: RefObject<HTMLDivElement | null>;
  hintId: string;
}

export function PeriodicTable(props: Props) {
  const { elements, layout, group3, sources, tileWidth, energyUnit, faces, matches, arrows, ghosts, hintId } = props;
  const variant = layout.variants[group3];
  const g = useMemo(() => gridGeometry(variant), [variant]);
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // FLIP: React has just placed the tiles in the new layout; animate from where they were.
  useLayoutEffect(() => {
    if (gridRef.current) playMorph(gridRef.current, ghosts.current, reduced);
  }, [layout.id, group3, ghosts, reduced]);

  const gridStyle = {
    "--tile-w": `${tileWidth}px`,
    "--tile-aspect": tileAspect(tileWidth),
    gridTemplateColumns: g.columns.map((t) => (t === "tile" ? "var(--tile-w)" : "var(--label-track)")).join(" "),
    gridTemplateRows: g.rows
      .map((t) => (t === "tile" ? "var(--tile-h)" : t === "gap" ? "calc(var(--tile-h) * 0.3)" : "auto"))
      .join(" "),
  } as CSSProperties;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = KEY_DIRECTION[e.key];
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-z]");
    if (!dir || !from || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const next = neighbour(variant.cells, Number(from.dataset.z), dir);
    e.preventDefault();
    if (next !== null) gridRef.current?.querySelector<HTMLElement>(`[data-z="${next}"]`)?.focus();
  };

  return (
    // The arrow-key handler only adds navigation between the buttons inside; it is not a widget.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={gridRef}
      className={styles.grid}
      style={gridStyle}
      data-table-grid=""
      data-layout={layout.id}
      data-arrows={arrows || undefined}
      role="group"
      aria-label={`${layout.title}: ${elements.length} elements`}
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
    >
      {variant.labels.map((label) => (
        <span
          key={`${label.kind}-${label.col}-${label.row}`}
          className={styles.label}
          data-kind={label.kind}
          data-label=""
          title={label.title}
          aria-hidden="true"
          style={{ gridColumn: `${g.col(label.col)} / span ${label.span ?? 1}`, gridRow: g.row(label.row) }}
        >
          {label.text}
        </span>
      ))}
      {elements.map((e) => {
        const cell = variant.cells[String(e.Z)];
        if (!cell) return null;
        return (
          <Tile
            key={e.Z}
            element={e}
            sources={sources}
            energyUnit={energyUnit}
            face={faces?.get(e.Z)}
            match={matches ? matches.has(e.Z) : undefined}
            style={cellStyle(g.col(cell.col), g.row(cell.row))}
          />
        );
      })}
    </div>
  );
}

// Stable style objects per cell keep the memoised tiles from re-rendering on zoom.
const styleCache = new Map<string, CSSProperties>();
function cellStyle(col: number, row: number): CSSProperties {
  const key = `${col}/${row}`;
  let s = styleCache.get(key);
  if (!s) {
    s = { gridColumn: col, gridRow: row };
    styleCache.set(key, s);
  }
  return s;
}
