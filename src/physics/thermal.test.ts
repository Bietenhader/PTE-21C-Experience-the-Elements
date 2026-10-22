// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { kgFromU } from "./lasercooling";
import {
  condensationDensity,
  maxwellBoltzmann,
  meanSpeed,
  mostProbableSpeed,
  rmsSpeed,
  thermalWavelength,
  ZETA_3_2,
} from "./thermal";

describe("thermal statistics (SPEC §11.3)", () => {
  it("ζ(3/2) to 12 digits: the partial sum plus the Euler–Maclaurin tail", () => {
    const n = 200_000;
    let sum = 0;
    for (let k = 1; k <= n; k++) sum += k ** -1.5;
    const tail = 2 / Math.sqrt(n) - 0.5 * n ** -1.5 + (1 / 8) * n ** -2.5;
    expect(Math.abs(sum + tail - ZETA_3_2)).toBeLessThan(1e-12);
  });

  const m = kgFromU(86.909180531); // rubidium-87
  const t = 300;

  it("the Maxwell–Boltzmann density is normalized and peaks at √(2kT/m)", () => {
    const vp = mostProbableSpeed(m, t);
    let total = 0;
    let first = 0;
    let second = 0;
    const dv = vp / 2000;
    for (let v = dv / 2; v < 12 * vp; v += dv) {
      const f = maxwellBoltzmann(v, m, t) * dv;
      total += f;
      first += v * f;
      second += v * v * f;
    }
    expect(total).toBeCloseTo(1, 6);
    expect(first / meanSpeed(m, t)).toBeCloseTo(1, 6);
    expect(Math.sqrt(second) / rmsSpeed(m, t)).toBeCloseTo(1, 6);
    expect(maxwellBoltzmann(vp, m, t)).toBeGreaterThan(maxwellBoltzmann(vp * 1.01, m, t));
    expect(maxwellBoltzmann(vp, m, t)).toBeGreaterThan(maxwellBoltzmann(vp * 0.99, m, t));
  });

  it("rubidium-87 at 1 μK: λ_dB ≈ 0.187 μm, and n·λ³ = ζ(3/2) at the condensation density", () => {
    const lambda = thermalWavelength(m, 1e-6);
    expect(lambda / 1.873e-7).toBeCloseTo(1, 3);
    expect(condensationDensity(m, 1e-6) * lambda ** 3).toBeCloseTo(ZETA_3_2, 12);
  });

  it("colder means a longer wavelength: λ_dB ∝ T^(−1/2)", () => {
    expect(thermalWavelength(m, 1) / thermalWavelength(m, 4)).toBeCloseTo(2, 12);
  });
});
