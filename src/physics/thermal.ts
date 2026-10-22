// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Thermal statistics of an ideal gas of atoms (SPEC §11.3): the Maxwell–Boltzmann speed
// distribution, the thermal de Broglie wavelength and the density at which a Bose gas condenses.
// SI units: masses in kg, temperatures in K, speeds in m/s, densities in m⁻³.

import { CODATA } from "./constants";

const H = CODATA.h.value;
const KB = CODATA.kB.value;

/**
 * ζ(3/2), the Riemann zeta function at 3/2: a Bose gas condenses when n·λ_dB³ reaches it
 * (Einstein 1925). A mathematical constant, not a measurement; thermal.test.ts checks the digits.
 */
export const ZETA_3_2 = 2.612375348685488;

/** Maxwell–Boltzmann speed density f(v) = 4π (m/2πk_BT)^{3/2} v² e^{−mv²/2k_BT}, in s/m. */
export function maxwellBoltzmann(v: number, mass: number, temperature: number): number {
  const a = mass / (2 * KB * temperature);
  return 4 * Math.PI * (a / Math.PI) ** 1.5 * v * v * Math.exp(-a * v * v);
}

/** The most probable speed √(2k_BT/m): the peak of the distribution. */
export const mostProbableSpeed = (mass: number, temperature: number): number => Math.sqrt((2 * KB * temperature) / mass);

/** The mean speed √(8k_BT/πm). */
export const meanSpeed = (mass: number, temperature: number): number => Math.sqrt((8 * KB * temperature) / (Math.PI * mass));

/** The root-mean-square speed √(3k_BT/m). */
export const rmsSpeed = (mass: number, temperature: number): number => Math.sqrt((3 * KB * temperature) / mass);

/** Thermal de Broglie wavelength λ_dB = h / √(2π m k_B T), in m. */
export function thermalWavelength(mass: number, temperature: number): number {
  return H / Math.sqrt(2 * Math.PI * mass * KB * temperature);
}

/** The density n = ζ(3/2) / λ_dB³ at which an ideal Bose gas at this temperature condenses, in m⁻³. */
export function condensationDensity(mass: number, temperature: number): number {
  return ZETA_3_2 / thermalWavelength(mass, temperature) ** 3;
}
