// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { computeOrbital, PHASE_NEGATIVE, PHASE_POSITIVE } from "./field";

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
});
