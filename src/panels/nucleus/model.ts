// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Pure helpers for the nucleus panel (SPEC §10.7): decay-mode names and families, the default
// isotope, half-lives in words, scientific notation and the thorium-229 isomer energy.

import { concise, isMissing, MINUS } from "../../data/format";
import type { Decay, Isotope, Missing, Quantity } from "../../data/types";
import { CODATA } from "../../physics/constants";
import { SECONDS_PER_YEAR } from "../../physics/decay";

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "⁺",
};

export const sup = (s: string | number): string =>
  String(s)
    .split("")
    .map((c) => SUP[c] ?? c)
    .join("");

/** ⁵⁶Fe */
export const isotopeLabel = (a: number, symbol: string): string => `${sup(a)}${symbol}`;

/** ENSDF's spin and parity with the parity raised: "(3/2+,5/2+)" → "(3/2⁺, 5/2⁺)". */
export const jpText = (jp: string): string => jp.replace(/[+-]/g, (c) => SUP[c] ?? c).replace(/,\s*/g, ", ");

/**
 * The same quantity without binary floating-point noise from unit conversion (an uncertainty of
 * 2.8699999999999996e-7 u is 0.287 μu), so that every digit shown is one the source gave.
 */
export function tidy<T extends Quantity>(q: T): T {
  const clean = (x: number) => Number(x.toPrecision(12));
  return { ...q, value: clean(q.value), ...(q.unc === undefined ? {} : { unc: clean(q.unc) }) };
}

// --- Decay modes (IAEA LiveChart codes) -----------------------------------------------------------

const NUMBER_WORDS = ["", "", "two-", "three-", "four-", "five-", "six-", "seven-"];

const EXACT: Record<string, string> = {
  "B-": "β⁻ decay",
  "2B-": "double β⁻ decay",
  "B+": "β⁺ decay",
  "2B+": "double β⁺ decay",
  EC: "electron capture",
  "2EC": "double electron capture",
  "EC+B+": "electron capture / β⁺ decay",
  A: "α decay",
  SF: "spontaneous fission",
  "SF+EC+B+": "spontaneous fission, electron capture or β⁺ decay",
  IT: "isomeric transition",
  P: "proton emission",
  "2P": "two-proton emission",
  N: "neutron emission",
  "2N": "two-neutron emission",
  ECP: "electron capture, then proton emission",
  EC2P: "electron capture, then two-proton emission",
  ECA: "electron capture, then α emission",
  ECSF: "electron capture, then fission",
  "B+P": "β⁺ decay, then proton emission",
  "B+2P": "β⁺ decay, then two-proton emission",
  "B+A": "β⁺ decay, then α emission",
  "B-A": "β⁻ decay, then α emission",
  "B-P": "β⁻ decay, then proton emission",
  "B-SF": "β⁻ decay, then fission",
};

const ELEMENTS_FOR_CLUSTERS: Record<string, string> = { C: "C", NE: "Ne", MG: "Mg", SI: "Si" };

/** The decay mode in words; IAEA's code is kept when it is not recognised. */
export function modeLabel(code: string): string {
  if (EXACT[code]) return EXACT[code];
  const delayedN = /^B-(\d)N$/.exec(code);
  if (delayedN) return `β⁻ decay, then ${NUMBER_WORDS[Number(delayedN[1])] ?? `${delayedN[1]}-`}neutron emission`;
  if (code === "B-N") return "β⁻ decay, then neutron emission";
  const cluster = /^\{\+(\d+)\}([A-Z][a-z]?)$/.exec(code) ?? /^(\d+)([A-Z]{1,2})$/.exec(code);
  if (cluster) {
    const sym = ELEMENTS_FOR_CLUSTERS[(cluster[2] ?? "").toUpperCase()] ?? cluster[2];
    return `cluster decay (emits ${sup(cluster[1] ?? "")}${sym})`;
  }
  if (/^[A-Z][a-z]?$/.test(code) && code !== "A" && code !== "P" && code !== "N") return `cluster decay (emits a ${code} nucleus)`;
  return code;
}

export type Family = "beta-minus" | "beta-plus" | "alpha" | "fission" | "particle" | "cluster" | "isomeric" | "stable" | "unknown";

/** Strip and legend group decays by what leaves the nucleus first. */
export function modeFamily(code: string): Family {
  if (code === "SF" || code === "SF+EC+B+") return "fission";
  if (code === "IT") return "isomeric";
  if (code === "A") return "alpha";
  if (code.startsWith("B-") || code === "2B-") return "beta-minus";
  if (code.startsWith("EC") || code.startsWith("B+") || code === "2B+" || code === "2EC") return "beta-plus";
  if (/^\d?[PN]$/.test(code)) return "particle";
  if (modeLabel(code).startsWith("cluster")) return "cluster";
  return "unknown";
}

export const FAMILIES: ReadonlyArray<{ id: Family; label: string; tone: number }> = [
  { id: "stable", label: "Stable", tone: 3 },
  { id: "beta-minus", label: "β⁻ decay", tone: 2 },
  { id: "beta-plus", label: "β⁺ decay or electron capture", tone: 6 },
  { id: "alpha", label: "α decay", tone: 1 },
  { id: "fission", label: "Spontaneous fission", tone: 7 },
  { id: "particle", label: "Proton or neutron emission", tone: 4 },
  { id: "cluster", label: "Cluster decay", tone: 5 },
  { id: "isomeric", label: "Isomeric transition", tone: 5 },
  { id: "unknown", label: "Decay mode not known", tone: 8 },
];

const branchValue = (d: Decay): number => (isMissing(d.branching) ? -1 : d.branching.value);

/** The decay with the largest branching ratio; IAEA's first listed when the ratios are unknown. */
export function dominantDecay(iso: Isotope): Decay | null {
  let best: Decay | null = null;
  for (const d of iso.decays) if (best === null || branchValue(d) > branchValue(best)) best = d;
  return best;
}

export function isotopeFamily(iso: Isotope): Family {
  if (iso.stable) return "stable";
  const d = dominantDecay(iso);
  return d ? modeFamily(d.mode) : "unknown";
}

// --- Half-lives ---------------------------------------------------------------------------------

export function halfLifeSeconds(iso: Isotope): number | null {
  const h = iso.halfLife;
  if (!h || isMissing(h)) return null;
  return h.value > 0 ? h.value : null;
}

const TEXT_UNITS: Record<string, string> = {
  Y: "years",
  y: "years",
  d: "days",
  h: "hours",
  m: "minutes",
  s: "s",
  ms: "ms",
  us: "μs",
  ns: "ns",
  ps: "ps",
  fs: "fs",
  as: "as",
  eV: "eV",
  keV: "keV",
  MeV: "MeV",
};

/** IAEA's half-life text in words: "1.40E10 Y" → "1.40 × 10¹⁰ years", "> 60 ns" → "more than 60 ns". */
export function halfLifeWords(text: string): string {
  const m = /^\s*([<>≥≤≈~]?)\s*([\d.]+)(?:E([+-]?\d+))?\s*([A-Za-zμ]+)\s*$/.exec(text);
  if (!m) return text;
  const [, op = "", num = "", exp, unit = ""] = m;
  const prefix = { "<": "less than ", ">": "more than ", "≥": "at least ", "≤": "at most ", "≈": "about ", "~": "about ", "": "" }[op] ?? "";
  const n = exp ? `${num} × 10${sup(String(Number(exp)))}` : num;
  const u = TEXT_UNITS[unit] ?? unit;
  const width = unit.endsWith("eV") ? "level width " : "";
  return `${prefix}${width}${n} ${u}`;
}

/** value (and uncertainty) in scientific notation: 1.1(4) × 10⁻⁹. Plain decimals between 10⁻³ and 10⁶. */
export function sci(value: number, unc?: number, digits = 3): string {
  if (value === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -3 && exp < 6) {
    if (unc !== undefined && unc > 0) return concise(value, Number(unc.toPrecision(2)));
    return Number(value.toPrecision(digits)).toString().replace("-", MINUS);
  }
  const m = value / 10 ** exp;
  const body = unc !== undefined && unc > 0 ? concise(m, Number((unc / 10 ** exp).toPrecision(2))) : Number(m.toPrecision(digits)).toString();
  return `${body.replace("-", MINUS)} × 10${sup(String(exp))}`;
}

// --- Time units for the survival readout -----------------------------------------------------------

export const TIME_UNITS = { s: { label: "seconds", seconds: 1 }, d: { label: "days", seconds: 86400 }, y: { label: "years", seconds: SECONDS_PER_YEAR } } as const;
export type TimeUnit = keyof typeof TIME_UNITS;

/** The unit a half-life reads best in: seconds below a day, days below a year, years above. */
export function naturalUnit(seconds: number): TimeUnit {
  if (seconds < 86400) return "s";
  if (seconds < SECONDS_PER_YEAR) return "d";
  return "y";
}

// --- Default isotope ----------------------------------------------------------------------------------

/** The isotope the panel opens on: the element's reference isotope, else the most abundant, else the longest-lived. */
export function defaultIsotope(isotopes: readonly Isotope[], referenceA?: number): Isotope {
  const ref = referenceA === undefined ? undefined : isotopes.find((i) => i.A === referenceA);
  if (ref) return ref;
  let best: Isotope | undefined;
  for (const i of isotopes) {
    if (isMissing(i.abundance)) continue;
    if (!best || i.abundance.value > (best.abundance as Quantity).value) best = i;
  }
  if (best) return best;
  let longest: Isotope | undefined;
  for (const i of isotopes) {
    const t = halfLifeSeconds(i);
    if (t !== null && (!longest || t > (halfLifeSeconds(longest) ?? -1))) longest = i;
  }
  return longest ?? (isotopes[0] as Isotope);
}

// --- Thorium-229 -------------------------------------------------------------------------------------

/** Photon energy E = hν in eV, with h and e exact (SI 2019): the isomer energy from its frequency. */
export function photonEnergyEv(frequencyHz: number): number {
  return (CODATA.h.value * frequencyHz) / CODATA.e.value;
}

/** A Missing for a stable isotope's decay data, said plainly. */
export const NOTHING_TO_DECAY: Missing = {
  missing: true,
  reason: "not_applicable",
  note: "The isotope is stable: no decay has ever been observed, so there is nothing to decay.",
};
