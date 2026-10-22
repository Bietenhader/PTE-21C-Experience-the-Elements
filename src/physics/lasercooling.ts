// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Laser-cooling limits (SPEC §11.3), all from CODATA constants. SI units throughout: wavelengths in
// metres, Γ in rad/s (Γ = 2π × the linewidth in Hz), masses in kg, temperatures in K.

import { CODATA } from "./constants";

const HBAR = CODATA.hbar.value;
const H = CODATA.h.value;
const C = CODATA.c.value;
const KB = CODATA.kB.value;

/** Γ in rad/s from the linewidth Γ/2π in MHz, as tables give it. */
export const gammaFromMHz = (linewidthMHz: number): number => 2 * Math.PI * linewidthMHz * 1e6;

/** Mass in kg from a mass in unified atomic mass units. */
export const kgFromU = (massU: number): number => massU * CODATA.u.value;

/** Doppler cooling limit T_D = ħΓ / (2 k_B). */
export function dopplerTemperature(gamma: number): number {
  return (HBAR * gamma) / (2 * KB);
}

/** Wavenumber k = 2π/λ of the cooling light. */
export const wavenumber = (wavelength: number): number => (2 * Math.PI) / wavelength;

/** Recoil temperature T_r = ħ²k² / (m k_B) (the convention of Steck's alkali data sheets). */
export function recoilTemperature(wavelength: number, mass: number): number {
  const k = wavenumber(wavelength);
  return (HBAR * HBAR * k * k) / (mass * KB);
}

/** Recoil velocity v_r = ħk / m: the kick from absorbing or emitting one photon. */
export function recoilVelocity(wavelength: number, mass: number): number {
  return (HBAR * wavenumber(wavelength)) / mass;
}

/**
 * Saturation intensity I_sat = πhcΓ / (3λ³), in W/m², for a closed two-level (cycling) transition
 * driven with the optimal polarization. Other polarizations or open transitions saturate later.
 */
export function saturationIntensity(wavelength: number, gamma: number): number {
  return (Math.PI * H * C * gamma) / (3 * wavelength ** 3);
}
