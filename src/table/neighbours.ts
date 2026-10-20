// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Arrow-key grid navigation (SPEC §9.5): which tile is "to the right of" or "below" another in the
// active layout. Works on layout cells only, so it holds for all four layouts and both group-3
// variants without knowing what the rows mean.

import type { LayoutCell } from "../data/types";

export type Direction = "left" | "right" | "up" | "down" | "home" | "end";

export const KEY_DIRECTION: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "home",
  End: "end",
};

/**
 * Atomic number of the neighbouring tile, or null at an edge.
 * left/right: nearest tile in the same row. up/down: the nearest row above/below that holds any
 * tile, then the tile closest in column (the left one on a tie). home/end: ends of the row.
 */
export function neighbour(cells: Record<string, LayoutCell>, z: number, dir: Direction): number | null {
  const here = cells[String(z)];
  if (!here) return null;
  const all = Object.entries(cells).map(([k, c]) => ({ z: Number(k), ...c }));
  const sameRow = all.filter((c) => c.row === here.row);

  const pick = (list: typeof all, score: (c: (typeof all)[number]) => number) =>
    list.length ? list.reduce((best, c) => (score(c) < score(best) ? c : best)).z : null;

  switch (dir) {
    case "left":
      return pick(
        sameRow.filter((c) => c.col < here.col),
        (c) => here.col - c.col,
      );
    case "right":
      return pick(
        sameRow.filter((c) => c.col > here.col),
        (c) => c.col - here.col,
      );
    case "home":
      return pick(sameRow, (c) => c.col);
    case "end":
      return pick(sameRow, (c) => -c.col);
    case "up":
    case "down": {
      const beyond = all.filter((c) => (dir === "up" ? c.row < here.row : c.row > here.row));
      if (!beyond.length) return null;
      const rowDistance = Math.min(...beyond.map((c) => Math.abs(c.row - here.row)));
      const row = beyond.filter((c) => Math.abs(c.row - here.row) === rowDistance);
      // Column distance first; on a tie the smaller column wins (× 2 + side keeps it one number).
      return pick(row, (c) => Math.abs(c.col - here.col) * 2 + (c.col > here.col ? 1 : 0));
    }
  }
}
