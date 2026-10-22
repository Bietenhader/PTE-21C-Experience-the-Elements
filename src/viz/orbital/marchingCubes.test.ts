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
    const { positions, normals } = marchingCubes(grid, level);
    expect(positions.length).toBeGreaterThan(900);
    expect(positions.length % 9).toBe(0);
    for (let p = 0; p < positions.length; p += 3) {
      const [x, y, z] = [positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0];
      const r = Math.hypot(x, y, z);
      expect(Math.abs(r - 1)).toBeLessThan(0.03);
      const dot = (x * (normals[p] ?? 0) + y * (normals[p + 1] ?? 0) + z * (normals[p + 2] ?? 0)) / r;
      expect(dot).toBeGreaterThan(0.95);
    }
  });

  it("returns nothing when the level is outside the field", () => {
    const grid = sphereGrid(16, 3);
    expect(marchingCubes(grid, 2).positions.length).toBe(0);
  });
});
