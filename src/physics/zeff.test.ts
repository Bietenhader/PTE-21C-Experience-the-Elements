// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { aufbau, parseConfiguration } from "./madelung";
import { slaterZeff } from "./zeff";

describe("Slater's rules (SPEC §11.1 textbook examples)", () => {
  it("valence electron of nitrogen → 3.90", () => {
    expect(slaterZeff(7, parseConfiguration("1s2 2s2 2p3"), 2, 1)).toBeCloseTo(3.9, 10);
  });
  it("4s of zinc → 4.35 and 3d of zinc → 8.85", () => {
    const zn = parseConfiguration("[Ar] 3d10 4s2");
    expect(slaterZeff(30, zn, 4, 0)).toBeCloseTo(4.35, 10);
    expect(slaterZeff(30, zn, 3, 2)).toBeCloseTo(8.85, 10);
  });
  it("hydrogen's lone electron feels the full nucleus; helium's 1s feels 1.70", () => {
    expect(slaterZeff(1, parseConfiguration("1s1"), 1, 0)).toBe(1);
    expect(slaterZeff(2, parseConfiguration("1s2"), 1, 0)).toBeCloseTo(1.7, 10);
  });
  it("gives every occupied subshell of oganesson a positive charge below Z", () => {
    const og = aufbau(118);
    for (const key of og.keys()) {
      const [n = 0, l = 0] = key.split(",").map(Number);
      const z = slaterZeff(118, og, n, l);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(118);
    }
  });
});
