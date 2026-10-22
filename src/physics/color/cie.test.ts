// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ColourMatchingFile } from "../../data/types";
import { cmf, displayColour, encodeSRGB, mixtureColour, toHex, wavelengthColour, xyzToLinearSRGB } from "./cie";

const table = JSON.parse(
  readFileSync(new URL("../../../public/data/cie1931.json", import.meta.url), "utf8"),
) as ColourMatchingFile;

describe("colour from wavelength (SPEC §11.6)", () => {
  it("reads the CIE table: ȳ peaks at 1 at 555 nm, and interpolates between grid points", () => {
    expect(cmf(555, table)[1]).toBe(1);
    const [, y552] = cmf(552.5, table);
    expect(y552).toBeCloseTo(((table.y[34] ?? 0) + (table.y[35] ?? 0)) / 2, 12);
    expect(cmf(300, table)).toEqual([0, 0, 0]);
    expect(cmf(780, table)[0]).toBeGreaterThan(0);
  });

  it("maps D65 white (Y = 1) to linear sRGB (1, 1, 1)", () => {
    const w: [number, number, number] = [0.3127 / 0.329, 1, (1 - 0.3127 - 0.329) / 0.329];
    for (const c of xyzToLinearSRGB(w)) expect(c).toBeCloseTo(1, 6);
  });

  it("589 nm (the sodium D lines) is yellow-orange", () => {
    const [r, g, b] = wavelengthColour(589, table) ?? [0, 0, 0];
    expect(r).toBeCloseTo(1, 12);
    expect(g).toBeGreaterThan(0.5);
    expect(g).toBeLessThan(0.95);
    expect(b).toBeLessThan(g);
  });

  it("486 nm (hydrogen Hβ) is blue-cyan", () => {
    const [r, g, b] = wavelengthColour(486, table) ?? [0, 0, 0];
    expect(b).toBeGreaterThan(0.9);
    expect(g).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(g);
  });

  it("desaturates toward white instead of clipping to black, and is never black inside 380–780 nm", () => {
    for (let nm = 380; nm <= 780; nm += 5) {
      const c = wavelengthColour(nm, table);
      expect(c, `${nm} nm`).not.toBeNull();
      expect(Math.max(...(c ?? [0]))).toBeCloseTo(1, 12);
      for (const ch of c ?? []) expect(ch).toBeGreaterThanOrEqual(0);
    }
    expect(displayColour([0, 0, 0])).toBeNull();
  });

  it("mixes lines: sodium's doublet stays yellow, hydrogen's Balmer lines make magenta-pink", () => {
    const na = mixtureColour([{ nm: 589.0, weight: 2 }, { nm: 589.6, weight: 1 }], table) ?? [0, 0, 0];
    expect(na[0]).toBeCloseTo(1, 12);
    const h = mixtureColour(
      [
        { nm: 656.3, weight: 5 },
        { nm: 486.1, weight: 2 },
        { nm: 434.0, weight: 1 },
      ],
      table,
    ) ?? [0, 0, 0];
    // pink-violet: red and blue both strong, green the weakest channel
    expect(h[0]).toBeGreaterThan(0.7);
    expect(h[2]).toBeGreaterThan(0.7);
    expect(h[1]).toBeLessThan(Math.min(h[0], h[2]));
  });

  it("encodes with the sRGB transfer curve and writes hex", () => {
    expect(encodeSRGB(0)).toBe(0);
    expect(encodeSRGB(1)).toBeCloseTo(1, 12);
    expect(encodeSRGB(0.0031308)).toBeCloseTo(0.0404500, 6);
    expect(toHex([1, 0.5, 0])).toBe("#ff8000");
  });
});
