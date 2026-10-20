// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Turns a layout (data from public/data/layouts) into CSS grid tracks. It never decides where an
// element goes (SPEC §4.3.4); it only finds the bounding box and which tracks hold tiles.

import type { LayoutVariant } from "../data/types";

export type Track = "tile" | "label" | "gap";

export interface GridGeometry {
  colStart: number;
  rowStart: number;
  columns: Track[];
  rows: Track[];
  /** 1-based CSS grid line for a layout coordinate. */
  col: (layoutCol: number) => number;
  row: (layoutRow: number) => number;
}

export function gridGeometry(variant: LayoutVariant): GridGeometry {
  const cells = Object.values(variant.cells);
  const all = [
    ...cells.map((c) => ({ col: c.col, row: c.row, span: 1 })),
    ...variant.labels.map((l) => ({ col: l.col, row: l.row, span: l.span ?? 1 })),
  ];
  const colStart = Math.min(...all.map((c) => c.col));
  const colEnd = Math.max(...all.map((c) => c.col + c.span - 1));
  const rowStart = Math.min(...all.map((c) => c.row));
  const rowEnd = Math.max(...all.map((c) => c.row));
  const tileCols = new Set(cells.map((c) => c.col));
  const tileRows = new Set(cells.map((c) => c.row));
  const labelRows = new Set(variant.labels.map((l) => l.row));

  const columns: Track[] = [];
  for (let c = colStart; c <= colEnd; c++) columns.push(tileCols.has(c) ? "tile" : "label");
  const rows: Track[] = [];
  for (let r = rowStart; r <= rowEnd; r++) rows.push(tileRows.has(r) ? "tile" : labelRows.has(r) ? "label" : "gap");

  return {
    colStart,
    rowStart,
    columns,
    rows,
    col: (layoutCol) => layoutCol - colStart + 1,
    row: (layoutRow) => layoutRow - rowStart + 1,
  };
}
