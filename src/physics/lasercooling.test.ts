// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IsotopesFile } from "../data/types";
import {
  dopplerTemperature,
  gammaFromMHz,
  kgFromU,
  recoilTemperature,
  recoilVelocity,
  saturationIntensity,
} from "./lasercooling";

const rb = JSON.parse(readFileSync(new URL("../../public/data/isotopes/37.json", import.meta.url), "utf8")) as IsotopesFile;
const rb87 = rb.isotopes.find((i) => i.A === 87);
const massU = rb87 && "value" in rb87.mass ? rb87.mass.value : Number.NaN;

describe("laser-cooling limits (SPEC §11.3)", () => {
  // Golden values: Steck, Rubidium 87 D Line Data (rev. 2.2.1): λ = 780.241 nm, Γ/2π = 6.0666 MHz.
  const lambda = 780.241e-9;
  const gamma = gammaFromMHz(6.0666);
  const m = kgFromU(massU);
  const close = (got: number, want: number) => expect(Math.abs(got / want - 1)).toBeLessThan(0.005);

  it("rubidium-87 D2: Doppler limit ≈ 145.6 μK", () => close(dopplerTemperature(gamma), 145.6e-6));
  it("rubidium-87 D2: recoil temperature ≈ 362 nK", () => close(recoilTemperature(lambda, m), 362e-9));
  it("rubidium-87 D2: recoil velocity ≈ 5.88 mm/s", () => close(recoilVelocity(lambda, m), 5.88e-3));
  it("rubidium-87 D2: saturation intensity of the cycling transition ≈ 1.669 mW/cm²", () =>
    close(saturationIntensity(lambda, gamma), 16.69));
  it("the mass comes from the isotope data", () => expect(massU).toBeCloseTo(86.909, 3));
});
