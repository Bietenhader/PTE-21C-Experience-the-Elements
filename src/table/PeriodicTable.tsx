// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The table: tiles placed on a CSS grid from layout data (SPEC §4.3.4, §7.2). DOM order follows Z,
// so Tab order follows Z (SPEC §9.5) whatever the layout.

import { type CSSProperties, useMemo } from "react";
import type { ElementIndexEntry, LayoutFile, SourcesFile } from "../data/types";
import { gridGeometry } from "./grid";
import styles from "./PeriodicTable.module.css";
import { Tile } from "./Tile";

export type TileSize = "fit" | "full";

interface Props {
  elements: ElementIndexEntry[];
  layout: LayoutFile;
  group3: "lu" | "la";
  sources: SourcesFile["sources"];
  size: TileSize;
}

export function PeriodicTable({ elements, layout, group3, sources, size }: Props) {
  const variant = layout.variants[group3];
  const g = useMemo(() => gridGeometry(variant), [variant]);
  const tileCols = g.columns.filter((t) => t === "tile").length;
  const gridStyle = {
    "--tile-cols": tileCols,
    "--label-cols": g.columns.length - tileCols,
    gridTemplateColumns: g.columns.map((t) => (t === "tile" ? "var(--tile-w)" : "var(--label-track)")).join(" "),
    gridTemplateRows: g.rows
      .map((t) => (t === "tile" ? "var(--tile-h)" : t === "gap" ? "calc(var(--tile-h) * 0.3)" : "auto"))
      .join(" "),
  } as CSSProperties;

  return (
    <figure className={styles.figure}>
      <div className={styles.scroller} data-size={size}>
        <div className={styles.grid} style={gridStyle} role="group" aria-label={`${layout.title}: ${elements.length} elements`}>
          {variant.labels.map((label) => (
            <span
              key={`${label.kind}-${label.col}-${label.row}`}
              className={styles.label}
              data-kind={label.kind}
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
                style={{ gridColumn: g.col(cell.col), gridRow: g.row(cell.row) }}
              />
            );
          })}
        </div>
      </div>
      <figcaption className={styles.caption}>
        <strong>{layout.title}.</strong> {layout.caption}
      </figcaption>
    </figure>
  );
}
