// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Pure helpers for the spectrum panel (SPEC §10.8): NIST notation for configurations and terms, the
// Grotrian columns, matching a line's levels to the level list, the brightness of a line in the
// strip, and finding the level pair behind a laser-cooling wavelength or a clock frequency.

import type { EnergyLevel, LevelLabel, SpectralLine } from "../../data/types";
import { CODATA } from "../../physics/constants";

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (digits: string) => [...digits].map((d) => SUP[d] ?? d).join("");

/** NIST configuration text such as "3d6.(5D).4s.4p" as "3d⁶ (⁵D) 4s 4p". */
export function formatConfiguration(conf: string): string {
  return conf
    .split(".")
    .map((part) =>
      part
        .replace(/(\d[spdfghik])(\d+)/g, (_, sub: string, occ: string) => `${sub}${sup(occ)}`)
        .replace(/\((\d+)([A-Z])(\*?)\)/g, (_, m: string, l: string, odd: string) => `(${sup(m)}${l}${odd ? "°" : ""})`),
    )
    .join(" ");
}

export interface ParsedTerm {
  /** Spin multiplicity 2S + 1, for an LS term. */
  multiplicity: number;
  /** Orbital angular momentum letter S, P, D … */
  L: string;
  odd: boolean;
  /** NIST's letter in front ("a", "z") or seniority digit behind, kept for display. */
  prefix: string;
  suffix: string;
}

const L_ORDER = "SPDFGHIKLMNOQRTUV";

/** An LS term such as "a 5D", "3P*", "z 7D*" or "a 3P2"; null for jK, jj or empty terms. */
export function parseTerm(term: string): ParsedTerm | null {
  const m = /^(?:([a-z])\s+)?(\d+)([A-Z])(\d*)(\*?)$/.exec(term.trim());
  if (!m || !L_ORDER.includes(m[3] ?? "")) return null;
  return { prefix: m[1] ?? "", multiplicity: Number(m[2]), L: m[3] ?? "", suffix: m[4] ?? "", odd: m[5] === "*" };
}

/** A term for display: "a 5D" → "a ⁵D", "3P*" → "³P°"; other couplings keep NIST's text, with * as °. */
export function formatTerm(term: string | undefined): string {
  if (!term) return "";
  const t = parseTerm(term);
  if (!t) return term.replace(/\*$/, "°");
  return `${t.prefix ? `${t.prefix} ` : ""}${sup(String(t.multiplicity))}${t.L}${t.suffix}${t.odd ? "°" : ""}`;
}

/** "3d⁶ 4s² a ⁵D, J = 4" for a line's level or a level of the list. */
export function formatLevel(l: { conf?: string; configuration?: string; term?: string; J?: string }): string {
  const conf = formatConfiguration(l.conf ?? l.configuration ?? "");
  const term = formatTerm(l.term);
  const j = l.J ? `J = ${l.J}` : "";
  return [conf, [term, j].filter(Boolean).join(", ")].filter(Boolean).join(" ") || "unclassified level";
}

export interface Column {
  key: string;
  label: string;
  /** For sorting: LS terms by multiplicity, then L, then parity; other couplings last. */
  order: number;
}

/** The Grotrian column of a level: its LS term (multiplicity, L, parity), or "other coupling" / "no term" by parity. */
export function columnOf(level: Pick<EnergyLevel, "term" | "parity">): Column {
  const t = parseTerm(level.term);
  const odd = t ? t.odd : level.parity === "odd";
  if (t) {
    const label = `${sup(String(t.multiplicity))}${t.L}${odd ? "°" : ""}`;
    return { key: `ls:${t.multiplicity}${t.L}${odd ? "o" : "e"}`, label, order: t.multiplicity * 1000 + L_ORDER.indexOf(t.L) * 2 + (odd ? 1 : 0) };
  }
  if (!level.term || level.term === "*") {
    return { key: `none:${odd ? "o" : "e"}`, label: `no term${odd ? " °" : ""}`, order: 900_000 + (odd ? 1 : 0) };
  }
  return { key: `other:${odd ? "o" : "e"}`, label: `other coupling${odd ? " °" : ""}`, order: 800_000 + (odd ? 1 : 0) };
}

/** Columns in display order, for the levels given. */
export function columns(levels: ReadonlyArray<Pick<EnergyLevel, "term" | "parity">>): Column[] {
  const seen = new Map<string, Column>();
  for (const l of levels) {
    const c = columnOf(l);
    if (!seen.has(c.key)) seen.set(c.key, c);
  }
  return [...seen.values()].sort((a, b) => a.order - b.order);
}

/** The index of the level a line's lower or upper label refers to, within `tol` eV; prefers the same J and term. */
export function matchLevel(label: LevelLabel | undefined, levels: readonly EnergyLevel[], tol = 2e-4): number {
  if (!label || label.eV === undefined) return -1;
  let best = -1;
  let bestScore = Infinity;
  levels.forEach((l, i) => {
    const d = Math.abs(l.eV - (label.eV ?? 0));
    if (d > tol) return;
    const score =
      d +
      (label.J && label.J !== l.J ? tol : 0) +
      (label.term && label.term !== l.term ? tol / 2 : 0) +
      (label.conf && label.conf !== l.configuration ? tol / 2 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Photon energy in eV for a vacuum wavelength in nm: E = hc/λ (CODATA, exact constants). */
export function energyFromWavelength(nm: number): number {
  return (CODATA.h.value * CODATA.c.value) / (nm * 1e-9) / CODATA.e.value;
}

/** Photon energy in eV for a frequency in Hz: E = hν. */
export function energyFromFrequency(hz: number): number {
  return (CODATA.h.value * hz) / CODATA.e.value;
}

export interface Pair {
  lower: number;
  upper: number;
  /** |E_upper − E_lower − E| in eV. */
  error: number;
  /** The transition takes two photons of the stated energy (as the hydrogen 1S–2S clock does). */
  twoPhoton: boolean;
}

/**
 * The level pair whose energy difference matches `energy` (eV) within `tol`: from the ground level when
 * `fromGround` (and, failing that, from any level), otherwise between any two levels. Tries a single
 * photon first, then two photons. Returns null when nothing matches, or when the energy is far below
 * the tolerance (a hyperfine transition inside one level).
 */
export function findPair(levels: readonly EnergyLevel[], energy: number, fromGround: boolean, tol = 1e-3): Pair | null {
  // A transition much smaller than the tolerance (a hyperfine clock) lies inside one level.
  if (!(energy > 50 * tol)) return null;
  for (const twoPhoton of [false, true]) {
    const e = twoPhoton ? 2 * energy : energy;
    const search = (lowers: number[]) => {
      let best: Pair | null = null;
      for (const lo of lowers) {
        for (let hi = 0; hi < levels.length; hi++) {
          const d = Math.abs((levels[hi]?.eV ?? 0) - (levels[lo]?.eV ?? 0) - e);
          if (hi !== lo && d <= tol && (!best || d < best.error)) best = { lower: lo, upper: hi, error: d, twoPhoton };
        }
      }
      return best;
    };
    const ground = levels.findIndex((l) => l.eV === 0);
    const all = levels.map((_, i) => i);
    const found = fromGround && ground >= 0 ? (search([ground]) ?? search(all)) : search(all);
    if (found) return found;
  }
  return null;
}

/** Brightness of a line in the strip: √(I / I_max) with a floor, so faint lines stay visible. */
export const BRIGHTNESS_FLOOR = 0.12;
export function brightness(intensity: number | undefined, max: number): number {
  if (!intensity || !(max > 0)) return BRIGHTNESS_FLOOR;
  return Math.max(BRIGHTNESS_FLOOR, Math.sqrt(intensity / max));
}

/** The strongest lines of one species by NIST intensity; lines without an intensity follow, by A_ki. */
export function strongest(lines: readonly SpectralLine[], n: number): SpectralLine[] {
  return [...lines]
    .sort((a, b) => {
      const ia = a.intensity ?? -1;
      const ib = b.intensity ?? -1;
      if (ia !== ib) return ib - ia;
      return (b.Aki ?? 0) - (a.Aki ?? 0);
    })
    .slice(0, n);
}

/** Three significant figures, written 6.26 × 10⁶. */
export function sci3(x: number): string {
  if (x === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = x / 10 ** exp;
  const m = mant.toPrecision(3);
  if (m.startsWith("10")) return `${(mant / 10).toPrecision(3)} × 10${superscriptInt(exp + 1)}`;
  return exp === 0 ? m : `${m} × 10${superscriptInt(exp)}`;
}

function superscriptInt(n: number): string {
  return (n < 0 ? "⁻" : "") + sup(String(Math.abs(n)));
}
