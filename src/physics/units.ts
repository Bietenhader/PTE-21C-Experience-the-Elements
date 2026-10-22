// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Display conversions (SPEC §5.2). Stored units never change; only these functions convert.

import { CODATA, EV_IN_KJ_PER_MOL } from "./constants";

/** 0 °C = 273.15 K by the definition of the degree Celsius (SI Brochure, 9th edition, §2.3.1). */
const CELSIUS_ZERO_IN_KELVIN = 273.15;

export const kjPerMolToEv = (kj: number): number => kj / EV_IN_KJ_PER_MOL;
export const evToKjPerMol = (ev: number): number => ev * EV_IN_KJ_PER_MOL;
export const kelvinToCelsius = (k: number): number => k - CELSIUS_ZERO_IN_KELVIN;
export const celsiusToKelvin = (c: number): number => c + CELSIUS_ZERO_IN_KELVIN;

export type EnergyUnit = "kJ/mol" | "eV";
export type TemperatureUnit = "K" | "°C";

/** An energy stored in `from` (kJ/mol or eV), expressed in `to`. */
export function convertEnergy(value: number, from: EnergyUnit, to: EnergyUnit): number {
  if (from === to) return value;
  return to === "eV" ? kjPerMolToEv(value) : evToKjPerMol(value);
}

/** A temperature stored in kelvin, expressed in `to`. */
export function convertTemperature(kelvin: number, to: TemperatureUnit): number {
  return to === "K" ? kelvin : kelvinToCelsius(kelvin);
}

/**
 * A static dipole polarizability in atomic units, as the polarizability volume in Å³: in Gaussian
 * units the atomic unit of polarizability is a₀³, so α′ = α(a.u.) · (a₀ / Å)³.
 */
export const polarizabilityAuToA3 = (au: number): number => au * (CODATA.a0.value * 1e10) ** 3;
