// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decayConstant, meanLifetime, SECONDS_PER_YEAR, survivingFraction } from "./decay";
import { isMagic, magicKind, statistics } from "./nuclear";

describe("decay (SPEC §11.5)", () => {
  it("half the nuclei survive one half-life and a quarter two", () => {
    expect(survivingFraction(10, 10)).toBeCloseTo(0.5, 14);
    expect(survivingFraction(20, 10)).toBeCloseTo(0.25, 14);
    expect(decayConstant(Math.LN2)).toBeCloseTo(1, 14);
    expect(meanLifetime(10)).toBeCloseTo(10 / Math.LN2, 12);
  });
  it("uranium-238: about 99.98 % of a sample survives a million years", () => {
    const t = 4.468e9 * SECONDS_PER_YEAR;
    expect(survivingFraction(1e6 * SECONDS_PER_YEAR, t)).toBeCloseTo(0.999845, 5);
  });
  it("the year is the IAEA's: every half-life IAEA gives in years converts back exactly", () => {
    let checked = 0;
    for (const z of [1, 6, 19, 38, 55, 90, 92, 94]) {
      const file = JSON.parse(readFileSync(new URL(`../../public/data/isotopes/${z}.json`, import.meta.url), "utf8")) as {
        isotopes: Array<{ halfLife: { value?: number }; halfLifeText?: string }>;
      };
      for (const iso of file.isotopes) {
        const m = /^([\d.]+(?:E[+-]?\d+)?) Y$/.exec(iso.halfLifeText ?? "");
        if (!m || iso.halfLife.value === undefined) continue;
        expect(iso.halfLife.value / SECONDS_PER_YEAR / Number(m[1])).toBeCloseTo(1, 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
  it("rejects a non-positive half-life", () => {
    expect(() => decayConstant(0)).toThrow(RangeError);
  });
});

describe("nuclear shells", () => {
  it("knows the magic numbers and doubly magic lead-208", () => {
    expect(isMagic(82)).toBe(true);
    expect(isMagic(40)).toBe(false);
    expect(magicKind(82, 126)).toBe("doubly");
    expect(magicKind(20, 28)).toBe("doubly");
    expect(magicKind(50, 70)).toBe("protons");
    expect(magicKind(26, 30)).toBeNull();
  });
  it("rubidium-87 atoms are bosons, potassium-40 and lithium-6 atoms fermions", () => {
    expect(statistics(87, 37)).toBe("boson");
    expect(statistics(40, 19)).toBe("fermion");
    expect(statistics(6, 3)).toBe("fermion");
  });
});
