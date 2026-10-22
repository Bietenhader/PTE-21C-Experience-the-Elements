// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LevelsFile, MetrologyFile, SpectraFile } from "../../data/types";
import {
  brightness,
  BRIGHTNESS_FLOOR,
  columnOf,
  columns,
  energyFromFrequency,
  energyFromWavelength,
  findPair,
  formatConfiguration,
  formatTerm,
  matchLevel,
  parseTerm,
  sci3,
  strongest,
} from "./model";

const data = (path: string) => JSON.parse(readFileSync(new URL(`../../../public/data/${path}`, import.meta.url), "utf8"));
const levels = (z: number) => data(`levels/${z}.json`) as LevelsFile;
const spectra = (z: number) => data(`spectra/${z}.json`) as SpectraFile;

describe("NIST notation", () => {
  it("parses LS terms with NIST's prefix letters, seniority digits and parity marks", () => {
    expect(parseTerm("a 5D")).toMatchObject({ prefix: "a", multiplicity: 5, L: "D", odd: false });
    expect(parseTerm("z 7D*")).toMatchObject({ prefix: "z", multiplicity: 7, L: "D", odd: true });
    expect(parseTerm("3P*")).toMatchObject({ multiplicity: 3, L: "P", odd: true });
    expect(parseTerm("a 3P2")).toMatchObject({ multiplicity: 3, L: "P", suffix: "2" });
    expect(parseTerm("2[3/2]*")).toBeNull(); // jK coupling
    expect(parseTerm("(1/2,3/2)")).toBeNull(); // jj coupling
    expect(parseTerm("")).toBeNull();
  });

  it("writes terms and configurations with superscripts", () => {
    expect(formatTerm("a 5D")).toBe("a ⁵D");
    expect(formatTerm("3P*")).toBe("³P°");
    expect(formatTerm("2[3/2]*")).toBe("2[3/2]°");
    expect(formatConfiguration("2p6.3s")).toBe("2p⁶ 3s");
    expect(formatConfiguration("3d6.(5D).4s.4p.(3P*)")).toBe("3d⁶ (⁵D) 4s 4p (³P°)");
  });

  it("writes three significant figures in powers of ten", () => {
    expect(sci3(6260000)).toBe("6.26 × 10⁶");
    expect(sci3(44101000)).toBe("4.41 × 10⁷");
    expect(sci3(9.996e5)).toBe("1.00 × 10⁶");
    expect(sci3(3.5)).toBe("3.50");
  });
});

describe("Grotrian columns", () => {
  it("groups levels by multiplicity, L and parity, other couplings last", () => {
    expect(columnOf({ term: "a 5D", parity: "even" }).label).toBe("⁵D");
    expect(columnOf({ term: "z 7D*", parity: "odd" }).label).toBe("⁷D°");
    expect(columnOf({ term: "2[3/2]*", parity: "odd" }).key).toBe("other:o");
    expect(columnOf({ term: "", parity: "even" }).key).toBe("none:e");
    const cols = columns([
      { term: "3P*", parity: "odd" },
      { term: "1S", parity: "even" },
      { term: "1P*", parity: "odd" },
      { term: "3S", parity: "even" },
      { term: "2[1/2]", parity: "even" },
    ]).map((c) => c.label);
    expect(cols).toEqual(["¹S", "¹P°", "³S", "³P°", "other coupling"]);
  });
});

describe("matching lines to levels", () => {
  it("finds the sodium D lines' levels in the level list", () => {
    const na = levels(11).levels;
    const d2 = spectra(11).lines.find((l) => l.charge === 0 && Math.abs(l.nm - 588.995) < 0.01);
    expect(d2).toBeDefined();
    expect(na[matchLevel(d2?.lower, na)]?.configuration).toBe("2p6.3s");
    const up = na[matchLevel(d2?.upper, na)];
    expect(up?.term).toBe("2P*");
    expect(up?.J).toBe("3/2");
  });

  it("matches hydrogen's Balmer lines to the n-averaged levels NIST lists", () => {
    const h = levels(1).levels;
    const alpha = spectra(1).lines.find((l) => Math.abs(l.nm - 656.279) < 0.01 && l.lower?.conf === "2");
    expect(h[matchLevel(alpha?.lower, h)]?.configuration).toBe("2");
    expect(h[matchLevel(alpha?.upper, h)]?.configuration).toBe("3");
  });

  it("finds nothing outside the tolerance", () => {
    expect(matchLevel({ eV: 99 }, levels(11).levels)).toBe(-1);
    expect(matchLevel(undefined, levels(11).levels)).toBe(-1);
  });
});

describe("cooling and clock transitions", () => {
  it("E = hc/λ: rubidium's D2 line at 780.241 nm (vacuum) is 1.589 eV and ends on 5p ²P₃/₂", () => {
    expect(energyFromWavelength(780.2414)).toBeCloseTo(1.58905, 4);
    const rb = levels(37).levels;
    const pair = findPair(rb, energyFromWavelength(780.2414), true);
    expect(pair).not.toBeNull();
    expect(rb[pair?.lower ?? -1]?.eV).toBe(0);
    expect(rb[pair?.upper ?? -1]?.J).toBe("3/2");
  });

  it("picks D2, not D1, for sodium although they are only 2 meV apart", () => {
    const na = levels(11).levels;
    const pair = findPair(na, energyFromWavelength(589.1583), true);
    expect(na[pair?.upper ?? -1]?.J).toBe("3/2");
  });

  it("E = hν: the strontium clock (429 THz) ends on 5s5p ³P₀; hydrogen 1S–2S takes two photons", () => {
    const metrology = data("metrology.json") as MetrologyFile;
    const sr = metrology.clocks.find((c) => c.Z === 38 && c.A === 88);
    const srLevels = levels(38).levels;
    const pair = findPair(srLevels, energyFromFrequency(sr?.frequency.value ?? 0), true);
    expect(srLevels[pair?.upper ?? -1]).toMatchObject({ term: "3P*", J: "0" });
    const hClock = metrology.clocks.find((c) => c.Z === 1);
    const hp = findPair(levels(1).levels, energyFromFrequency(hClock?.frequency.value ?? 0), true);
    expect(hp?.twoPhoton).toBe(true);
    expect(levels(1).levels[hp?.upper ?? -1]?.configuration).toBe("2s");
  });

  it("finds no pair for a hyperfine clock inside one level", () => {
    expect(findPair(levels(55).levels, energyFromFrequency(9_192_631_770), true)).toBeNull();
  });
});

describe("the strip", () => {
  it("scales brightness as √(I / I_max) with a floor", () => {
    expect(brightness(100, 100)).toBe(1);
    expect(brightness(25, 100)).toBeCloseTo(0.5, 12);
    expect(brightness(0.0001, 100)).toBe(BRIGHTNESS_FLOOR);
    expect(brightness(undefined, 100)).toBe(BRIGHTNESS_FLOOR);
  });

  it("ranks by intensity, then lines without one by A_ki", () => {
    const top = strongest(
      [
        { nm: 1, charge: 0, Aki: 5 },
        { nm: 2, charge: 0, intensity: 10 },
        { nm: 3, charge: 0, intensity: 30 },
        { nm: 4, charge: 0, Aki: 9 },
      ],
      3,
    ).map((l) => l.nm);
    expect(top).toEqual([3, 2, 4]);
  });

  it("every spectra file has neutral-atom lines: the strip renders for ≥ 90 elements (M3)", () => {
    const index = data("index.json") as { elements: Array<{ Z: number }> };
    let withNeutral = 0;
    for (const e of index.elements) {
      const detail = data(`elements/${e.Z}.json`) as { files: { spectra: boolean } };
      if (detail.files.spectra && spectra(e.Z).lines.some((l) => l.charge === 0)) withNeutral++;
    }
    expect(withNeutral).toBeGreaterThanOrEqual(90);
  });
});
