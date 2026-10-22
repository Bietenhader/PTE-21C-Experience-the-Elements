// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { marchingCubes } from "./marchingCubes";

function sphereGrid(n: number, half: number) {
  const step = (2 * half) / (n - 1);
  const values = new Float32Array(n * n * n);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const [x, y, z] = [-half + i * step, -half + j * step, -half + k * step];
        values[i + n * (j + n * k)] = Math.exp(-(x * x + y * y + z * z));
      }
  return { n, origin: -half, step, values };
}

describe("marching cubes", () => {
  it("puts every vertex of a level set of exp(−r²) on the right sphere, normals outward", () => {
    const grid = sphereGrid(48, 3);
    const level = Math.exp(-1); // the sphere r = 1
    const { positions, normals, indices } = marchingCubes(grid, level);
    expect(positions.length).toBeGreaterThan(900);
    expect(indices.length % 3).toBe(0);
    expect(Math.max(...indices)).toBe(positions.length / 3 - 1);
    for (let p = 0; p < positions.length; p += 3) {
      const [x, y, z] = [positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0];
      const r = Math.hypot(x, y, z);
      expect(Math.abs(r - 1)).toBeLessThan(0.03);
      const dot = (x * (normals[p] ?? 0) + y * (normals[p + 1] ?? 0) + z * (normals[p + 2] ?? 0)) / r;
      expect(dot).toBeGreaterThan(0.95);
    }
  });

  it("shares each vertex between the cells around its edge: a closed surface, every edge in two triangles", () => {
    const { indices } = marchingCubes(sphereGrid(24, 3), Math.exp(-1));
    const edges = new Map<string, number>();
    for (let t = 0; t < indices.length; t += 3) {
      const v = [indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0];
      for (let e = 0; e < 3; e++) {
        const a = v[e] ?? 0;
        const b = v[(e + 1) % 3] ?? 0;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((c) => c === 2)).toBe(true);
  });

  it("returns nothing when the level is outside the field", () => {
    const grid = sphereGrid(16, 3);
    expect(marchingCubes(grid, 2).positions.length).toBe(0);
  });
});
