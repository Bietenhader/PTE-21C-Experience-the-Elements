// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LayoutFile } from "../data/types";
import { neighbour } from "./neighbours";

const load = (id: string) =>
  JSON.parse(readFileSync(new URL(`../../public/data/layouts/${id}.json`, import.meta.url), "utf8")) as LayoutFile;

describe("arrow keys in standard18 (Lu/Lr in group 3)", () => {
  const cells = load("standard18").variants.lu.cells;
  const go = (z: number, d: Parameters<typeof neighbour>[2]) => neighbour(cells, z, d);

  it("moves along a period", () => {
    expect(go(1, "right")).toBe(2); // H → He across the gap
    expect(go(2, "left")).toBe(1);
    expect(go(26, "right")).toBe(27);
    expect(go(26, "left")).toBe(25);
    expect(go(3, "left")).toBeNull();
    expect(go(10, "right")).toBeNull();
  });

  it("moves down and up a group", () => {
    expect(go(1, "down")).toBe(3);
    expect(go(3, "up")).toBe(1);
    expect(go(2, "down")).toBe(10);
    expect(go(26, "down")).toBe(44);
    expect(go(26, "up")).toBe(13); // nothing above Fe in period 3: aluminium is the nearest tile
  });

  it("goes from the main body into the detached f-block rows and back", () => {
    expect(go(103, "down")).toBe(57); // Lr → La (first cell of the lanthanide row)
    expect(go(57, "down")).toBe(89);
    expect(go(57, "up")).toBe(103);
    expect(go(89, "down")).toBeNull();
  });

  it("jumps to the ends of the row", () => {
    expect(go(26, "home")).toBe(19);
    expect(go(26, "end")).toBe(36);
  });
});

describe("arrow keys follow the screen in adomah (n = 1 at the bottom)", () => {
  const cells = load("adomah").variants.lu.cells;
  it("up from H reaches n = 2", () => {
    expect(neighbour(cells, 1, "up")).toBe(3);
    expect(neighbour(cells, 3, "down")).toBe(1);
  });
});

describe("every tile is reachable from hydrogen in every layout", () => {
  for (const id of ["standard18", "long32", "janet", "adomah"] as const) {
    for (const variant of ["lu", "la"] as const) {
      it(`${id}/${variant}`, () => {
        const cells = load(id).variants[variant].cells;
        const seen = new Set([1]);
        const queue = [1];
        while (queue.length) {
          const z = queue.shift() as number;
          for (const d of ["left", "right", "up", "down"] as const) {
            const n = neighbour(cells, z, d);
            if (n !== null && !seen.has(n)) {
              seen.add(n);
              queue.push(n);
            }
          }
        }
        expect(seen.size).toBe(118);
      });
    }
  }
});
