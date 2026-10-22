// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { complexHarmonic, radial, realOrbital } from "../../physics/hydrogenic";
import { computeOrbital, PHASE_NEGATIVE, PHASE_POSITIVE, reflectionSigns, sampleField } from "./field";

describe("orbital pictures (SPEC §11.1)", () => {
  it("2p_z of hydrogen: the surface encloses 90 % of the grid's probability, lobes along ±z with opposite signs", () => {
    const o = computeOrbital({ n: 2, l: 1, m: 0, z: 1, kind: "real", grid: 48, nodal: true, slice: 32 });
    expect(o.enclosed).toBeGreaterThanOrEqual(0.9);
    expect(o.enclosed).toBeLessThan(0.92);
    expect(o.positions.length).toBeGreaterThan(900);
    let up = 0;
    let down = 0;
    for (let p = 0; p < o.positions.length; p += 3) {
      const zz = o.positions[p + 2] ?? 0;
      const isPos = Math.abs((o.colors[p] ?? 0) - PHASE_POSITIVE[0]) < 1e-6; // Float32 storage
      if (zz > 0.5) {
        expect(isPos).toBe(true);
        up++;
      } else if (zz < -0.5) {
        expect(o.colors[p]).toBeCloseTo(PHASE_NEGATIVE[0], 6);
        down++;
      }
    }
    expect(up).toBeGreaterThan(100);
    expect(down).toBeGreaterThan(100);
    // the nodal surface of 2p_z is the plane z = 0
    const nodal = o.nodal?.positions ?? new Float32Array();
    expect(nodal.length).toBeGreaterThan(0);
    for (let p = 2; p < nodal.length; p += 3) expect(Math.abs(nodal[p] ?? 1)).toBeLessThan(0.2);
    expect(o.sliceImage?.length).toBe(32 * 32 * 4);
  });

  it("1s has a sphere for its surface and no nodal surface", () => {
    const o = computeOrbital({ n: 1, l: 0, m: 0, z: 1, kind: "real", grid: 40, nodal: true });
    const radii: number[] = [];
    for (let p = 0; p < o.positions.length; p += 3)
      radii.push(Math.hypot(o.positions[p] ?? 0, o.positions[p + 1] ?? 0, o.positions[p + 2] ?? 0));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    for (const r of radii) expect(Math.abs(r - mean) / mean).toBeLessThan(0.05);
    expect(o.nodal?.positions.length ?? 0).toBe(0);
  });

  it("complex orbitals colour by phase and keep the 90 % criterion", () => {
    const o = computeOrbital({ n: 3, l: 2, m: 1, z: 2, kind: "complex", grid: 40 });
    expect(o.enclosed).toBeGreaterThanOrEqual(0.9);
    const distinct = new Set<string>();
    for (let p = 0; p < o.colors.length; p += 3) distinct.add(`${(o.colors[p] ?? 0).toFixed(1)},${(o.colors[p + 1] ?? 0).toFixed(1)}`);
    expect(distinct.size).toBeGreaterThan(4);
  });

  it("the mirrored octant gives the same ψ and |ψ|² as evaluating every point, for every l ≤ 3 and m", () => {
    const G = 12;
    for (let l = 0; l <= 3; l++) {
      for (let m = -l; m <= l; m++) {
        for (const kind of ["real", "complex"] as const) {
          const n = l + 2;
          const f = sampleField({ n, l, m, z: 1.7, kind, grid: G });
          // Errors relative to the orbital's largest value on the grid (ψ itself vanishes on the nodes).
          const peak = Math.sqrt(f.density.reduce((a, d) => Math.max(a, d), 0));
          for (let idx = 0; idx < G * G * G; idx += 7) {
            const i = idx % G;
            const j = Math.floor(idx / G) % G;
            const k = Math.floor(idx / (G * G));
            const x = -f.half + i * f.step;
            const y = -f.half + j * f.step;
            const zz = -f.half + k * f.step;
            const r = Math.sqrt(x * x + y * y + zz * zz);
            const psi =
              kind === "real" ? realOrbital(n, l, m, 1.7, x, y, zz) : radial(n, l, 1.7, r) * complexHarmonic(l, m, x, y, zz, r).magnitude;
            const scale = Math.max(peak * 1e-3, Math.abs(psi));
            expect(Math.abs((f.density[idx] ?? 0) - psi * psi) / (scale * scale), `l=${l} m=${m} ${kind} at ${i},${j},${k}`).toBeLessThan(1e-4);
            if (kind === "real") expect(Math.abs((f.psi?.[idx] ?? 0) - psi) / scale, `ψ l=${l} m=${m} at ${i},${j},${k}`).toBeLessThan(1e-4);
          }
        }
      }
    }
  });

  it("reflection signs of the named real orbitals", () => {
    expect(reflectionSigns(1, 1)).toEqual([-1, 1, 1]); // p_x
    expect(reflectionSigns(1, -1)).toEqual([1, -1, 1]); // p_y
    expect(reflectionSigns(1, 0)).toEqual([1, 1, -1]); // p_z
    expect(reflectionSigns(2, -2)).toEqual([-1, -1, 1]); // d_xy
    expect(reflectionSigns(2, 1)).toEqual([-1, 1, -1]); // d_xz
    expect(reflectionSigns(3, -2)).toEqual([-1, -1, -1]); // f_xyz
  });

  it("limiting marching cubes to the surface's box changes nothing", async () => {
    const { marchingCubes } = await import("./marchingCubes");
    for (const [n, l, m] of [
      [1, 0, 0],
      [3, 2, 0],
      [4, 3, 3],
    ] as const) {
      const o = computeOrbital({ n, l, m, z: 2, kind: "real", grid: 40 });
      const f = sampleField({ n, l, m, z: 2, kind: "real", grid: 40 });
      const full = marchingCubes({ n: 40, origin: -f.half, step: f.step, values: f.density }, o.level);
      expect(o.positions.length).toBe(full.positions.length);
      expect(Array.from(o.positions.slice(0, 30))).toEqual(Array.from(full.positions.slice(0, 30)));
    }
  });
});
