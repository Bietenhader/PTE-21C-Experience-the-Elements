// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LayoutFile } from "../data/types";
import { gridGeometry } from "./grid";

const load = (id: string) =>
  JSON.parse(readFileSync(new URL(`../../public/data/layouts/${id}.json`, import.meta.url), "utf8")) as LayoutFile;

describe("grid geometry for standard18", () => {
  const g = gridGeometry(load("standard18").variants.lu);

  it("has 18 tile columns plus the period-label column", () => {
    expect(g.columns.filter((t) => t === "tile")).toHaveLength(18);
    expect(g.columns[0]).toBe("label");
  });

  it("has the group-label row, 7 periods, a gap row and two f rows", () => {
    expect(g.rows).toEqual(["label", "tile", "tile", "tile", "tile", "tile", "tile", "tile", "gap", "tile", "tile"]);
  });

  it("maps layout coordinates to CSS grid lines", () => {
    expect(g.col(8)).toBe(2); // group 1
    expect(g.row(1)).toBe(2); // period 1, below the group labels
  });
});

describe("every layout yields a grid", () => {
  for (const id of ["standard18", "long32", "janet", "adomah"]) {
    it(id, () => {
      const g = gridGeometry(load(id).variants.lu);
      expect(g.columns.length).toBeGreaterThanOrEqual(18);
      expect(g.rows.includes("tile")).toBe(true);
    });
  }
});
