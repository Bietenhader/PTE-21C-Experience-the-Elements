// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { lorentzFactor, zAlpha } from "./relativity";

describe("hydrogenic 1s speed", () => {
  it("is α for hydrogen and about 0.58 c for gold", () => {
    expect(zAlpha(1)).toBeCloseTo(1 / 137.035999, 9);
    expect(zAlpha(79)).toBeCloseTo(0.5765, 4);
  });

  it("gives the textbook Lorentz factor for gold (about 1.22)", () => {
    expect(lorentzFactor(zAlpha(79))).toBeCloseTo(1.223, 3);
    expect(lorentzFactor(0)).toBe(1);
    expect(lorentzFactor(1)).toBe(Infinity);
  });
});
