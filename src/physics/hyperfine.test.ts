// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementDetailFile } from "../data/types";
import { aFromSplittingHalf, fValues, hyperfineEnergy, hyperfineLevels, splittingHalf } from "./hyperfine";

const dir = new URL("../../public/data/elements/", import.meta.url);
const details = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as ElementDetailFile);

describe("hyperfine structure (SPEC §11.4)", () => {
  it("F runs from |I − J| to I + J", () => {
    expect(fValues(3.5, 0.5)).toEqual([3, 4]);
    expect(fValues(1.5, 1.5)).toEqual([0, 1, 2, 3]);
    expect(fValues(0, 0.5)).toEqual([]);
    expect(fValues(2.5, 0)).toEqual([]);
  });

  it("caesium-133: A(I + ½) with A = 2298.1579425 MHz gives the defining 9 192.631 770 MHz", () => {
    expect(splittingHalf(3.5, 2298.1579425)).toBeCloseTo(9192.63177, 6);
    const [lower, upper] = hyperfineLevels(3.5, 0.5, 2298.1579425);
    expect((upper?.energy ?? 0) - (lower?.energy ?? 0)).toBeCloseTo(9192.63177, 6);
    expect(aFromSplittingHalf(3.5, 9192.63177)).toBeCloseTo(2298.1579425, 6);
  });

  it("with B: rubidium-87 5P₃/₂ (A = 84.7185 MHz, B = 12.4965 MHz) has F′ = 3 − F′ = 2 = 266.650 MHz", () => {
    // Steck, Rubidium 87 D Line Data (rev. 2.2.1), Table 4 and Fig. 2.
    const d = hyperfineEnergy(3, 1.5, 1.5, 84.7185, 12.4965) - hyperfineEnergy(2, 1.5, 1.5, 84.7185, 12.4965);
    expect(Math.abs(d - 266.65)).toBeLessThan(0.01);
  });

  it("every curated J = ½ row with A agrees with its stored splitting", () => {
    let checked = 0;
    for (const d of details) {
      for (const row of d.amo.hyperfine) {
        if (row.J !== 0.5 || row.I === undefined || !row.A_MHz) continue;
        const computed = Math.abs(splittingHalf(row.I, row.A_MHz.value)) * 1e6;
        expect(Math.abs(computed / row.splitting.value - 1), `Z=${d.Z} A=${row.A}`).toBeLessThan(2e-6);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});
