// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The AMO panel's model (SPEC §10.6): hyperfine rows with their F levels, nuclear moments, laser-
// cooling limits computed from the stored line data, and the timeline of the second. Pure; no React.

import { isInterval, isMissing } from "../../data/format";
import type {
  ElementDetailFile,
  ElementIndexEntry,
  HyperfineRecord,
  Isotope,
  LaserCooling,
  MetrologyFile,
  Missing,
  Quantity,
} from "../../data/types";
import { aFromSplittingHalf, hyperfineLevels } from "../../physics/hyperfine";
import {
  dopplerTemperature,
  gammaFromMHz,
  kgFromU,
  recoilTemperature,
  recoilVelocity,
  saturationIntensity,
} from "../../physics/lasercooling";
import { isotopeLabel, sup } from "../nucleus/model";

/** ¹³³Cs, ⁸⁸Sr⁺, "Sr (natural mixture)", or just the symbol when no isotope is named. */
export function speciesLabel(symbol: string, a: number | "natural" | null, charge: number): string {
  const ion = charge === 0 ? "" : charge === 1 ? "⁺" : `${sup(charge)}⁺`;
  if (a === null) return `${symbol}${ion}`;
  if (a === "natural") return `${symbol}${ion} (natural mixture)`;
  return `${isotopeLabel(a, symbol)}${ion}`;
}

export interface HyperfineView {
  row: HyperfineRecord;
  label: string;
  I: number | null;
  J: number | null;
  /** A in MHz: the stored constant, or one derived from a J = ½ splitting (then `aDerived`). */
  aMHz: number | null;
  aDerived: boolean;
  bMHz: number | null;
  /** The F levels in MHz relative to the level's centre of gravity, lowest F first. */
  levels: Array<{ F: number; energy: number }>;
  headline: boolean;
}

const spinOf = (iso: Isotope | undefined): number | null => (iso && typeof iso.I === "number" ? iso.I : null);

/**
 * Every curated hyperfine row, the headline isotope first, with I and J completed from the isotope
 * data (I) and the ground term (J, for neutral atoms) where the row itself does not give them.
 */
export function hyperfineViews(e: ElementIndexEntry, d: ElementDetailFile, isotopes: readonly Isotope[]): HyperfineView[] {
  const headline = isMissing(e.hyperfineHeadline) ? null : e.hyperfineHeadline.isotope;
  const groundJ = isMissing(e.groundTerm) ? null : e.groundTerm.J;
  const views = d.amo.hyperfine.map((row): HyperfineView => {
    const I = row.I ?? spinOf(isotopes.find((i) => i.A === row.A));
    const J = row.J ?? (row.charge === 0 ? groundJ : null);
    let aMHz = row.A_MHz?.value ?? null;
    let aDerived = false;
    if (aMHz === null && I !== null && J === 0.5) {
      aMHz = aFromSplittingHalf(I, row.splitting.value / 1e6);
      aDerived = true;
    }
    const bMHz = row.B_MHz?.value ?? null;
    const levels = I !== null && J !== null && aMHz !== null ? hyperfineLevels(I, J, aMHz, bMHz ?? 0) : [];
    return {
      row,
      label: speciesLabel(e.symbol, row.A, row.charge),
      I,
      J,
      aMHz,
      aDerived,
      bMHz,
      levels,
      headline: row.A === headline && row.charge === 0,
    };
  });
  return views.sort((x, y) => Number(y.headline) - Number(x.headline) || x.row.charge - y.row.charge || x.row.A - y.row.A);
}

/**
 * Natural isotopes with a nuclear spin whose ground-state splitting is not (yet) in the curated
 * table. None when the ground level has J = 0: then no isotope has ground-state hyperfine structure.
 */
export function unlistedSpins(e: ElementIndexEntry, isotopes: readonly Isotope[], rows: readonly HyperfineRecord[]): Isotope[] {
  if (isMissing(e.groundTerm) || e.groundTerm.J === 0) return [];
  return isotopes.filter(
    (i) => !isMissing(i.abundance) && typeof i.I === "number" && i.I > 0 && !rows.some((r) => r.A === i.A && r.charge === 0),
  );
}

/** Isotopes with a measured magnetic dipole or electric quadrupole moment. */
export function momentRows(isotopes: readonly Isotope[]): Isotope[] {
  return isotopes.filter((i) => !isMissing(i.mu) || !isMissing(i.Q));
}

/** Relative standard uncertainty unc/|value|; 0 for exact values, null when the source gives none. */
export function relativeUncertainty(q: Quantity): number | null {
  if (q.unc === undefined) return null;
  if (q.unc === 0) return 0;
  return q.value === 0 ? null : q.unc / Math.abs(q.value);
}

export interface CoolingMass {
  kg: number;
  /** What the mass is: the isotope's atomic mass, or the standard atomic weight for a natural mixture. */
  basis: "isotope" | "atomic weight";
  source: string;
}

/** The mass the recoil limits are computed with. */
export function coolingMass(row: LaserCooling, e: ElementIndexEntry, isotopes: readonly Isotope[]): CoolingMass | null {
  if (row.A !== "natural") {
    const iso = isotopes.find((i) => i.A === row.A);
    if (iso && !isMissing(iso.mass)) return { kg: kgFromU(iso.mass.value), basis: "isotope", source: iso.mass.source };
    return null;
  }
  const w = e.atomicWeight;
  if (isMissing(w)) return null;
  if (isInterval(w)) return w.conventional ? { kg: kgFromU(w.conventional.value), basis: "atomic weight", source: w.conventional.source } : null;
  return { kg: kgFromU(w.value), basis: "atomic weight", source: w.source };
}

export interface CoolingLimits {
  /** Doppler limit, K. */
  doppler: number | null;
  /** Recoil temperature, K. */
  recoil: number | null;
  /** Recoil velocity, m/s. */
  recoilVelocity: number | null;
  /** Saturation intensity of the cycling transition, W/m². */
  saturation: number | null;
}

/** The limits computed from the line's wavelength, linewidth and the atom's mass (SPEC §11.3). */
export function coolingLimits(row: LaserCooling, mass: CoolingMass | null): CoolingLimits {
  const lambda = row.wavelength.value * 1e-9;
  const gamma = isMissing(row.gamma) ? null : gammaFromMHz(row.gamma.value);
  return {
    doppler: gamma === null ? null : dopplerTemperature(gamma),
    recoil: mass ? recoilTemperature(lambda, mass.kg) : null,
    recoilVelocity: mass ? recoilVelocity(lambda, mass.kg) : null,
    saturation: gamma === null ? null : saturationIntensity(lambda, gamma),
  };
}

/** How the species is cooled: as a neutral atom in its ground state, in a metastable state, or as an ion. */
export function coolingKind(row: LaserCooling): "neutral" | "metastable" | "ion" {
  if (row.charge !== 0) return "ion";
  return row.state === "metastable" ? "metastable" : "neutral";
}

/**
 * A value with an SI prefix chosen so the number lies in [1, 1000): 1.456e-4 K → "145.6 μK".
 * For computed values, shown to `digits` significant figures.
 */
export function withPrefix(value: number, unit: string, digits = 4): string {
  if (value === 0 || !Number.isFinite(value)) return `${value} ${unit}`;
  const prefixes: Array<[number, string]> = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "μ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ];
  const abs = Math.abs(value);
  const [factor, prefix] = prefixes.find(([f]) => abs >= f) ?? prefixes[prefixes.length - 1] ?? [1, ""];
  return `${Number((value / factor).toPrecision(digits))} ${prefix}${unit}`;
}

/** The elements's name in lower case and its usual alternative spellings, for matching timeline text. */
function names(e: ElementIndexEntry): string[] {
  const n = e.name.toLowerCase();
  const extra: Record<string, string[]> = { caesium: ["cesium"], aluminium: ["aluminum"], sulfur: ["sulphur"] };
  return [n, ...(extra[n] ?? [])];
}

/** The shared timeline of the second, with the entries that concern this element marked. */
export function secondTimeline(m: MetrologyFile, e: ElementIndexEntry, d: ElementDetailFile) {
  const own = names(e);
  const definesSecond = d.amo.clocks.some((c) => c.definesSecond);
  return m.timeline.map((t) => {
    const text = t.text.toLowerCase();
    const mentions = own.some((n) => text.includes(n));
    // The 1967 definition and the 2018 revision both rest on caesium's frequency.
    const viaDefinition = definesSecond && (t.year === 1967 || t.year === 2018);
    return { ...t, mine: mentions || viaDefinition };
  });
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const map = (text: string, table: Record<string, string>) => [...text].map((c) => table[c] ?? c).join("");

const J = String.raw`(\d+\/\d+|\d+)`;
const LS_WITH_J = new RegExp(String.raw`^(\d+)([SPDFGHIK])(\*?)${J}$`);
const JK = new RegExp(String.raw`^(\d+)\[([^\]]+)\]${J}$`);
const JJ = new RegExp(String.raw`^\(([^)]*)\)${J}$`);
const PARENT = new RegExp(String.raw`\((\d+)([SPDFGHIK])(\*?)${J}?\)`, "g");
// An occupation number: digits after an orbital, unless the next orbital ("3s3p") or a j ("5d3/2") follows.
const OCCUPATION = /(\d[spdfghik])(\d+)(?![\d/spdfghik])/g;

/**
 * NIST's plain level labels as printed: "6s 2S1/2" → "6s ²S₁/₂", "2p5(2P3/2)3p 2[5/2]3" → "2p⁵(²P₃/₂)3p ²[5/2]₃",
 * "4f11(4I15/2)6s6p(1P1) (15/2,1)17/2" → "4f¹¹(⁴I₁₅/₂)6s6p(¹P₁) (15/2,1)₁₇/₂". A bare term only counts when it
 * carries its J, so "6S" (a 6s level in the BIPM list) stays as written.
 */
export function levelText(s: string): string {
  return s
    .split(" ")
    .map((token) => {
      const ls = LS_WITH_J.exec(token);
      if (ls) return `${map(ls[1] ?? "", SUP)}${ls[2] ?? ""}${ls[3] ? "°" : ""}${map(ls[4] ?? "", SUB)}`;
      const jk = JK.exec(token);
      if (jk) return `${map(jk[1] ?? "", SUP)}[${jk[2] ?? ""}]${map(jk[3] ?? "", SUB)}`;
      const jj = JJ.exec(token);
      if (jj) return `(${jj[1] ?? ""})${map(jj[2] ?? "", SUB)}`;
      return token
        .replace(OCCUPATION, (_, orbital: string, n: string) => `${orbital}${map(n, SUP)}`)
        .replace(PARENT, (_, m: string, l: string, odd: string, j?: string) => `(${map(m, SUP)}${l}${odd ? "°" : ""}${map(j ?? "", SUB)})`);
    })
    .join(" ");
}

/** The BIPM list's TeX-like transition labels as printed: "5s^2 ^1S_0 - 5s5p ^3P_0" → "5s² ¹S₀ – 5s5p ³P₀". */
export function transitionText(s: string): string {
  return levelText(s)
    .replace(/\^\{([^}]*)\}/g, (_, x: string) => map(x, SUP))
    .replace(/\^([0-9+-]+)/g, (_, x: string) => map(x, SUP))
    .replace(/_\{([^}]*)\}/g, (_, x: string) => map(x, SUB))
    .replace(/_(\d+)/g, (_, x: string) => map(x, SUB))
    .replace(/ - /g, " – ");
}

/** Why the element has no hyperfine row: the index's reason when it has one, otherwise "not yet compiled". */
export function noHyperfine(e: ElementIndexEntry): Missing {
  if (isMissing(e.hyperfineHeadline)) return e.hyperfineHeadline;
  return { missing: true, reason: "not_measured", note: "Not yet in PTE-21C's curated hyperfine table." };
}
