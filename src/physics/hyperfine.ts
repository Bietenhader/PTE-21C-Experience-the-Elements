// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Hyperfine structure of one fine-structure level (SPEC §11.4): the magnetic-dipole constant A and
// the electric-quadrupole constant B split a level of electronic angular momentum J into levels of
// total angular momentum F = |I − J| … I + J. Energies come out in the unit of A and B.

/** K = F(F+1) − I(I+1) − J(J+1). */
export function hyperfineK(f: number, i: number, j: number): number {
  return f * (f + 1) - i * (i + 1) - j * (j + 1);
}

/**
 * E_F = (A/2)K + B·[(3/2)K(K+1) − 2I(I+1)J(J+1)] / [4I(2I−1)J(2J−1)]. The quadrupole term exists
 * only for I ≥ 1 and J ≥ 1 (its denominator vanishes otherwise), so it is left out there.
 */
export function hyperfineEnergy(f: number, i: number, j: number, a: number, b = 0): number {
  const k = hyperfineK(f, i, j);
  const dipole = (a / 2) * k;
  if (b === 0 || i < 1 || j < 1) return dipole;
  const quadrupole = (b * (1.5 * k * (k + 1) - 2 * i * (i + 1) * j * (j + 1))) / (4 * i * (2 * i - 1) * j * (2 * j - 1));
  return dipole + quadrupole;
}

/** The allowed F values, |I − J| … I + J in steps of one; none if I or J is zero. */
export function fValues(i: number, j: number): number[] {
  if (i === 0 || j === 0) return [];
  const out: number[] = [];
  for (let f = Math.abs(i - j); f <= i + j + 1e-9; f += 1) out.push(Math.round(f * 2) / 2);
  return out;
}

/** Every F level with its energy (in the unit of A), lowest F first. */
export function hyperfineLevels(i: number, j: number, a: number, b = 0): Array<{ F: number; energy: number }> {
  return fValues(i, j).map((f) => ({ F: f, energy: hyperfineEnergy(f, i, j, a, b) }));
}

/** For J = ½ there are two levels, F = I ± ½, split by A(I + ½); the sign of A says which is higher. */
export function splittingHalf(i: number, a: number): number {
  return a * (i + 0.5);
}

/** The A constant that gives this J = ½ splitting (its sign is not fixed by the splitting alone). */
export function aFromSplittingHalf(i: number, splitting: number): number {
  return splitting / (i + 0.5);
}
