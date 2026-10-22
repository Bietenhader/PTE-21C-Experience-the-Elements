// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The physical panel's arithmetic (SPEC §10.4), kept apart from the drawing so that it can be tested:
// specific heat from the molar heat capacity, the five-year rule for prices, and how to read an
// aggregated GHS classification.

import { isInterval, isMissing } from "../../data/format";
import type { ElementIndexEntry, GhsHazards, Missing, Q } from "../../data/types";

/** Grams per mole of the element: the standard atomic weight, or IUPAC's conventional value for an interval. */
export function molarMass(e: ElementIndexEntry): number | null {
  const w: unknown = e.atomicWeight;
  if (isMissing(w)) return null;
  if (isInterval(w)) return (w as { conventional?: { value: number } }).conventional?.value ?? null;
  return (w as { value: number }).value;
}

export type SpecificHeat = { ok: true; value: number; molarMass: number; atoms: number } | { ok: false; why: Missing };

/**
 * c_p = C_p / (n·M): the molar heat capacity divided by the mass of one mole of the formula unit the CRC
 * table uses (n = 2 for H₂, N₂, O₂ and the halogens), in J/(g·K).
 */
export function specificHeat(cp: Q, atoms: number | undefined, e: ElementIndexEntry): SpecificHeat {
  if (isMissing(cp)) {
    return { ok: false, why: { missing: true, reason: cp.reason, note: "It needs the molar heat capacity, which is missing." } };
  }
  const m = molarMass(e);
  if (m === null) {
    return {
      ok: false,
      why: { missing: true, reason: "no_stable_isotope", note: "It needs a standard atomic weight, and this element has none." },
    };
  }
  const n = atoms ?? 1;
  return { ok: true, value: cp.value / (n * m), molarMass: m, atoms: n };
}

/** SPEC §10.4: a price is shown only with its year, and not at all once it is more than five years old. */
export const PRICE_MAX_AGE_YEARS = 5;
export function priceIsCurrent(priceYear: number, thisYear: number): boolean {
  return thisYear - priceYear <= PRICE_MAX_AGE_YEARS;
}

/** Whether most of the reports behind an ECHA aggregation say the substance meets no GHS hazard criterion. */
export function mostlyNotHazardous(h: GhsHazards): boolean {
  return (h.notMeetingCriteria?.share ?? 0) > 50;
}

/** SPEC §10.4 lists these; PTE-21C has not compiled them from a primary table yet. */
export const NOT_COMPILED: readonly string[] = [
  "Thermal conductivity",
  "Thermal expansion",
  "Young's, bulk and shear moduli",
  "Poisson's ratio",
  "Speed of sound",
  "Hardness (Mohs, Vickers, Brinell)",
];
