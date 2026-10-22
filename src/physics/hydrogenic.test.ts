// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import {
  complexHarmonic,
  enclosedProbability,
  laguerre,
  legendre,
  meanRadius,
  mostProbableRadius,
  orbitalName,
  radial,
  radialNodeRadii,
  radialNodes,
  realHarmonic,
  realOrbital,
} from "./hydrogenic";

/** ∫₀^∞ f(r) dr by Simpson's rule on [0, rMax]. */
function integrate(f: (r: number) => number, rMax: number, steps = 20000): number {
  const h = rMax / steps;
  let sum = f(0) + f(rMax);
  for (let i = 1; i < steps; i++) sum += (i % 2 === 0 ? 2 : 4) * f(i * h);
  return (sum * h) / 3;
}

const SUBSHELLS: Array<[number, number]> = [];
for (let n = 1; n <= 7; n++) for (let l = 0; l < Math.min(n, 4); l++) SUBSHELLS.push([n, l]);

describe("radial functions (SPEC §11.1)", () => {
  it("Laguerre polynomials match their closed forms", () => {
    for (const x of [0, 0.5, 2, 7.3]) {
      expect(laguerre(0, 3, x)).toBe(1);
      expect(laguerre(1, 3, x)).toBeCloseTo(4 - x, 12);
      expect(laguerre(2, 1, x)).toBeCloseTo((x * x) / 2 - 3 * x + 3, 12);
    }
  });

  it("every orbital up to 7f is normalised: ∫ r² R² dr = 1 ± 10⁻⁴", () => {
    for (const [n, l] of SUBSHELLS) {
      for (const z of [1, 3.9, 25.4]) {
        const norm = integrate((r) => r * r * radial(n, l, z, r) ** 2, (8 * n * n + 20) / z);
        expect(Math.abs(norm - 1), `${n}${"spdf"[l]} Z=${z}`).toBeLessThan(1e-4);
      }
    }
  });

  it("⟨r⟩ = (a₀/2Z)[3n² − l(l+1)] agrees with the integral", () => {
    for (const [n, l] of SUBSHELLS) {
      const z = 2.7;
      const numeric = integrate((r) => r ** 3 * radial(n, l, z, r) ** 2, (8 * n * n + 20) / z);
      expect(numeric).toBeCloseTo(meanRadius(n, l, z), 4);
    }
  });

  it("hydrogen 1s: ⟨r⟩ = 1.5 a₀ and the most probable radius is 1 a₀ (SPEC §13.1)", () => {
    expect(meanRadius(1, 0, 1)).toBe(1.5);
    expect(mostProbableRadius(1, 0, 1)).toBe(1);
    expect(mostProbableRadius(3, 2, 2)).toBe(4.5); // nodeless: n²/Z
    expect(mostProbableRadius(2, 0, 1)).toBeCloseTo(3 + Math.sqrt(5), 6); // 2s: r = (3 + √5) a₀
  });

  it("counts n − l − 1 radial nodes and finds them where R changes sign", () => {
    expect(radialNodes(4, 1)).toBe(2);
    expect(radialNodeRadii(2, 0, 1)).toHaveLength(1);
    expect(radialNodeRadii(2, 0, 1)[0]).toBeCloseTo(2, 8); // 2s node of hydrogen at 2 a₀
    expect(radialNodeRadii(3, 0, 1)).toHaveLength(2);
    const [a, b] = radialNodeRadii(3, 0, 1);
    expect(a).toBeCloseTo((9 - 3 * Math.sqrt(3)) / 2, 6);
    expect(b).toBeCloseTo((9 + 3 * Math.sqrt(3)) / 2, 6);
    for (const [n, l] of SUBSHELLS) expect(radialNodeRadii(n, l, 1.3)).toHaveLength(n - l - 1);
  });

  it("the enclosed probability rises to 1", () => {
    expect(enclosedProbability(1, 0, 1, 1e-6)).toBeLessThan(1e-12);
    expect(enclosedProbability(1, 0, 1, 1)).toBeCloseTo(1 - 5 * Math.exp(-2), 6); // 1s within a₀
    expect(enclosedProbability(2, 1, 1, 60)).toBeCloseTo(1, 6);
  });

  it("rejects quantum numbers that do not exist", () => {
    expect(() => radial(2, 2, 1, 1)).toThrow(RangeError);
    expect(() => meanRadius(1, 0, 0)).toThrow(RangeError);
  });
});

describe("angular functions", () => {
  it("Legendre P_l^m without the Condon–Shortley phase", () => {
    const x = 0.3;
    const s = Math.sqrt(1 - x * x);
    expect(legendre(2, 0, x)).toBeCloseTo((3 * x * x - 1) / 2, 12);
    expect(legendre(2, 1, x)).toBeCloseTo(3 * x * s, 12);
    expect(legendre(3, 3, x)).toBeCloseTo(15 * s ** 3, 12);
  });

  it("real harmonics are normalised over the sphere and orthogonal within a subshell", () => {
    const N = 120;
    for (let l = 0; l <= 3; l++) {
      for (let m = -l; m <= l; m++) {
        let self = 0;
        let cross = 0;
        for (let i = 0; i < N; i++) {
          const theta = ((i + 0.5) / N) * Math.PI;
          for (let j = 0; j < 2 * N; j++) {
            const phi = ((j + 0.5) / (2 * N)) * 2 * Math.PI;
            const [x, y, z] = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
            const w = Math.sin(theta) * (Math.PI / N) * (Math.PI / N);
            const a = realHarmonic(l, m, x, y, z, 1);
            self += a * a * w;
            if (m < l) cross += a * realHarmonic(l, m + 1, x, y, z, 1) * w;
          }
        }
        expect(self, `l=${l} m=${m}`).toBeCloseTo(1, 3);
        expect(Math.abs(cross), `l=${l} m=${m}`).toBeLessThan(1e-3);
      }
    }
  });

  it("p_x, p_y, p_z point along x, y, z; d_xy changes sign with x", () => {
    expect(realHarmonic(1, 1, 1, 0, 0, 1)).toBeGreaterThan(0.48);
    expect(realHarmonic(1, -1, 0, 1, 0, 1)).toBeGreaterThan(0.48);
    expect(realHarmonic(1, 0, 0, 0, 1, 1)).toBeGreaterThan(0.48);
    expect(realHarmonic(1, 1, 0, 0, 1, 1)).toBeCloseTo(0, 12);
    const r = Math.SQRT2;
    expect(Math.sign(realHarmonic(2, -2, 1, 1, 0, r))).toBe(-Math.sign(realHarmonic(2, -2, -1, 1, 0, r)));
    expect(orbitalName(3, 2, 0, "real")).toBe("3d_z²");
    expect(orbitalName(2, 1, 1, "real")).toBe("2p_x");
    expect(orbitalName(4, 3, -2, "complex")).toBe("4f, m = −2");
  });

  it("|Y_l^m|² of the complex orbitals is independent of φ and equal for ±m", () => {
    const a = complexHarmonic(2, 1, 0.6, 0, 0.8, 1).magnitude;
    const b = complexHarmonic(2, 1, 0, 0.6, 0.8, 1).magnitude;
    const c = complexHarmonic(2, -1, -0.6, 0, 0.8, 1).magnitude;
    expect(a).toBeCloseTo(b, 12);
    expect(a).toBeCloseTo(c, 12);
    // the phase winds by m·φ: a quarter turn around z for m = 1
    const p0 = complexHarmonic(2, 2, 1, 0, 0.5, Math.hypot(1, 0.5)).phase;
    const p1 = complexHarmonic(2, 2, 0, 1, 0.5, Math.hypot(1, 0.5)).phase;
    expect(((p1 - p0 + 4 * Math.PI) % (2 * Math.PI))).toBeCloseTo(Math.PI, 9);
  });

  it("ψ of a real orbital vanishes on its nodal plane", () => {
    expect(realOrbital(2, 1, 0, 1, 1, 0.5, 0)).toBeCloseTo(0, 14); // 2p_z on the xy-plane
    expect(realOrbital(1, 0, 0, 1, 0, 0, 0)).toBeCloseTo(1 / Math.sqrt(Math.PI), 12); // 1s at the nucleus
  });
});
