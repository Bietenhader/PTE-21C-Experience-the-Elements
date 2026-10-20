// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Display conversions (SPEC §5.2). Stored units never change; only these functions convert.

import { EV_IN_KJ_PER_MOL } from "./constants";

/** 0 °C = 273.15 K by the definition of the degree Celsius (SI Brochure, 9th edition, §2.3.1). */
const CELSIUS_ZERO_IN_KELVIN = 273.15;

export const kjPerMolToEv = (kj: number): number => kj / EV_IN_KJ_PER_MOL;
export const evToKjPerMol = (ev: number): number => ev * EV_IN_KJ_PER_MOL;
export const kelvinToCelsius = (k: number): number => k - CELSIUS_ZERO_IN_KELVIN;
export const celsiusToKelvin = (c: number): number => c + CELSIUS_ZERO_IN_KELVIN;
