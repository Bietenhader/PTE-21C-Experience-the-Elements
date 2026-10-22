// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Radioactive decay (SPEC §11.5): λ = ln 2 / t½, N(t) = N₀ e^(−λt), and the survival probability of
// one nucleus, e^(−λt). Times in seconds; the caller converts.

/**
 * The year of the nuclear data: the mean tropical year, 365.242 198 78 d = 31 556 925.974 592 s, which
 * the IAEA LiveChart uses to give its half-lives in seconds (³H: 12.32 y = 388 781 328.007 s; NUBASE
 * rounds it to 365.2422 d). decay.test.ts checks it against the isotopes files, so a half-life in years
 * reads back exactly as IAEA gives it.
 */
export const SECONDS_PER_YEAR = 365.24219878 * 86400;

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
