// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { aufbau, parseConfiguration } from "./madelung";
import { slaterNStar, slaterSteps, slaterZeff } from "./zeff";

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

  it("works the rules through step by step: nitrogen's 2p and zinc's 4s", () => {
    const n = slaterSteps(7, parseConfiguration("[He] 2s2 2p3"), 2, 1);
    expect(n.steps).toEqual([
      { label: "the other electrons in its own group (2s and 2p)", count: 4, each: 0.35, total: 4 * 0.35 },
      { label: "the n = 1 shell", count: 2, each: 0.85, total: 1.7 },
    ]);
    expect(n.zeff).toBeCloseTo(3.9, 10);
    const zn = slaterSteps(30, parseConfiguration("[Ar] 3d10 4s2"), 4, 0);
    expect(zn.steps.map((s) => [s.count, s.each])).toEqual([
      [1, 0.35],
      [18, 0.85],
      [10, 1],
    ]);
    expect(zn.zeff).toBeCloseTo(4.35, 10);
    expect(slaterSteps(30, parseConfiguration("[Ar] 3d10 4s2"), 3, 2).steps.map((s) => s.label)).toEqual([
      "the other electrons in its own group (3d)",
      "every group to its left",
    ]);
  });

  it("gives Slater's effective principal quantum numbers", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(slaterNStar)).toEqual([1, 2, 3, 3.7, 4.0, 4.2, null]);
  });
});
