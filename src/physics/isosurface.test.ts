// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { enclosedLevel } from "./isosurface";

function bySorting(values: number[], fraction: number): number {
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const v of sorted) {
    acc += v;
    if (acc >= fraction * total) return v;
  }
  return sorted[sorted.length - 1] ?? 0;
}

describe("the 90 % enclosed-probability level (SPEC §11.1)", () => {
  it("equals sorting and accumulating, for a spread of densities", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const values = Array.from({ length: 50000 }, () => Math.exp(-12 * rand()) * rand());
    for (const f of [0.5, 0.9, 0.99]) expect(enclosedLevel(values, f)).toBe(bySorting(values, f));
  });
  it("encloses 90 % of a Gaussian blob's mass", () => {
    const values: number[] = [];
    for (let i = -20; i <= 20; i++)
      for (let j = -20; j <= 20; j++) for (let k = -20; k <= 20; k++) values.push(Math.exp(-(i * i + j * j + k * k) / 50));
    const level = enclosedLevel(values, 0.9);
    const total = values.reduce((a, b) => a + b, 0);
    const inside = values.filter((v) => v >= level).reduce((a, b) => a + b, 0);
    expect(inside / total).toBeGreaterThanOrEqual(0.9);
    expect(inside / total).toBeLessThan(0.905);
  });
  it("rejects fractions outside (0, 1) and survives an empty field", () => {
    expect(() => enclosedLevel([1, 2], 1)).toThrow(RangeError);
    expect(enclosedLevel([0, 0, 0], 0.9)).toBe(0);
  });
});
