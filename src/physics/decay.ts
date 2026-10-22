// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Radioactive decay (SPEC §11.5): λ = ln 2 / t½, N(t) = N₀ e^(−λt), and the survival probability of
// one nucleus, e^(−λt). Times in seconds; the caller converts.

export const SECONDS_PER_YEAR = 365.25 * 86400; // Julian year, the IAU and IUPAC convention for half-lives

export function decayConstant(halfLifeSeconds: number): number {
  if (!(halfLifeSeconds > 0)) throw new RangeError(`half-life must be positive, got ${halfLifeSeconds}`);
  return Math.LN2 / halfLifeSeconds;
}

/** Fraction of nuclei left after time t, which is also the chance that one given nucleus survives. */
export function survivingFraction(tSeconds: number, halfLifeSeconds: number): number {
  return Math.exp(-decayConstant(halfLifeSeconds) * tSeconds);
}

/** Mean lifetime τ = 1/λ = t½ / ln 2. */
export function meanLifetime(halfLifeSeconds: number): number {
  return 1 / decayConstant(halfLifeSeconds);
}
