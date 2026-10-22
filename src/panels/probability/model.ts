// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The probability panel's model (SPEC §10.3): quantum statistics per isotope, the reference isotope
// for the thermal readouts, the temperature scale of the slider, and the element's most and least
// precisely known quantities. Pure; no React.

import { isMissing } from "../../data/format";
import type { Citation, ElementDetailFile, ElementIndexEntry, Isotope, LaserCooling, Quantity } from "../../data/types";
import { gammaFromMHz, dopplerTemperature, kgFromU, recoilTemperature } from "../../physics/lasercooling";
import { statistics } from "../../physics/nuclear";
import { isotopeLabel } from "../nucleus/model";

export interface StatisticsRow {
  A: number;
  label: string;
  kind: "boson" | "fermion";
  natural: boolean;
  /** The first Bose–Einstein condensate or degenerate Fermi gas of this isotope, where one exists. */
  bec?: Citation;
  dfg?: Citation;
}

/**
 * Every natural isotope, and every other isotope that has been brought to quantum degeneracy, as a
 * neutral atom: Z electrons plus A nucleons, a boson when their number is even.
 */
export function statisticsRows(e: ElementIndexEntry, isotopes: readonly Isotope[], cooling: readonly LaserCooling[]): StatisticsRow[] {
  const degenerate = (a: number, key: "BEC" | "DFG") => cooling.find((c) => c.A === a && c.charge === 0 && c[key])?.[key];
  const wanted = isotopes.filter((i) => !isMissing(i.abundance) || degenerate(i.A, "BEC") || degenerate(i.A, "DFG"));
  return wanted.map((i) => {
    const row: StatisticsRow = { A: i.A, label: isotopeLabel(i.A, e.symbol), kind: statistics(i.A, e.Z), natural: !isMissing(i.abundance) };
    const bec = degenerate(i.A, "BEC");
    const dfg = degenerate(i.A, "DFG");
    if (bec) row.bec = bec;
    if (dfg) row.dfg = dfg;
    return row;
  });
}

/** The isotope the thermal readouts use: the detail file's reference isotope, else the most abundant. */
export function referenceIsotope(d: ElementDetailFile, isotopes: readonly Isotope[]): Isotope | null {
  const ref = d.probability.referenceIsotope;
  const byRef = ref === undefined ? undefined : isotopes.find((i) => i.A === ref);
  if (byRef) return byRef;
  const natural = isotopes.filter((i) => !isMissing(i.abundance));
  const abundance = (i: Isotope) => (isMissing(i.abundance) ? 0 : i.abundance.value);
  return natural.sort((a, b) => abundance(b) - abundance(a))[0] ?? null;
}

/** The mass of an isotope in kg, from its stored atomic mass. */
export const isotopeMassKg = (iso: Isotope): number | null => (isMissing(iso.mass) ? null : kgFromU(iso.mass.value));

export interface Limits {
  doppler: number | null;
  recoil: number | null;
  /** The cooling line the limits come from, e.g. "461 nm". */
  line: string;
}

/** The laser-cooling limits for the reference isotope (or the element's natural-mixture line). */
export function coolingLimitsFor(cooling: readonly LaserCooling[], a: number, massKg: number | null): Limits | null {
  const row = cooling.find((c) => c.A === a && c.charge === 0) ?? cooling.find((c) => c.A === "natural" && c.charge === 0);
  if (!row) return null;
  const lambda = row.wavelength.value * 1e-9;
  return {
    doppler: isMissing(row.gamma) ? null : dopplerTemperature(gammaFromMHz(row.gamma.value)),
    recoil: massKg === null ? null : recoilTemperature(lambda, massKg),
    line: `${Math.round(row.wavelength.value)} nm`,
  };
}

/** The slider runs on log₁₀ T, from 1000 K down to 100 nK (or below the recoil limit, if lower). */
export const T_MAX = 1000;
export function tMin(limits: Limits | null): number {
  const recoil = limits?.recoil ?? null;
  return recoil !== null && recoil < 1e-7 ? recoil / 2 : 1e-7;
}

export interface Precise {
  label: string;
  q: Quantity;
  relative: number;
}

/**
 * Every stored value of this element that comes with an uncertainty, with its relative uncertainty.
 * Exact values (uncertainty 0, fixed by definition) are counted apart.
 */
export function precisionList(e: ElementIndexEntry, d: ElementDetailFile, isotopes: readonly Isotope[]): { items: Precise[]; exact: Precise[] } {
  const items: Precise[] = [];
  const exact: Precise[] = [];
  const add = (label: string, q: unknown) => {
    if (!q || typeof q !== "object" || isMissing(q) || !("value" in q) || !("unit" in q)) return;
    const quantity = q as Quantity;
    if (quantity.unc === undefined || quantity.value === 0) return;
    if (quantity.unc === 0) exact.push({ label, q: quantity, relative: 0 });
    else items.push({ label, q: quantity, relative: quantity.unc / Math.abs(quantity.value) });
  };
  add("standard atomic weight", e.atomicWeight);
  add("first ionization energy", e.ie1);
  add("electron affinity", e.electronAffinity);
  add("melting point", e.meltingPoint);
  add("boiling point", e.boilingPoint);
  add("density", e.density);
  add("covalent radius", e.radiusCovalent);
  const src = d.em.ionizationEnergies.source;
  for (const s of d.em.ionizationEnergies.stages) {
    if (s.stage === 1) continue; // the same value as the index's IE₁
    add(`ionization energy of stage ${s.stage}`, { value: s.eV, unit: "eV", source: src, ...(s.unc === undefined ? {} : { unc: s.unc }) });
  }
  for (const h of d.amo.hyperfine) add(`hyperfine splitting of ${isotopeLabel(h.A, e.symbol)}${h.charge ? "⁺" : ""}`, h.splitting);
  for (const c of d.amo.clocks) add(`clock frequency of ${c.species}`, c.frequency);
  for (const i of isotopes) {
    const name = isotopeLabel(i.A, e.symbol);
    add(`atomic mass of ${name}`, i.mass);
    add(`natural abundance of ${name}`, i.abundance);
    if (i.halfLife) add(`half-life of ${name}`, i.halfLife);
    add(`magnetic moment of ${name}`, i.mu);
    add(`quadrupole moment of ${name}`, i.Q);
    if (i.chargeRadius) add(`charge radius of ${name}`, i.chargeRadius);
  }
  items.sort((a, b) => a.relative - b.relative);
  return { items, exact };
}

/**
 * The most and least precisely known of those values. "Least" is taken among values resolved from
 * zero (uncertainty below the value itself): a moment of −0.01(11) b says only that it is small.
 */
export function precisionExtremes(items: readonly Precise[]): { most: Precise | undefined; least: Precise | undefined } {
  const resolved = items.filter((p) => p.relative < 1);
  return { most: items[0], least: resolved[resolved.length - 1] };
}
