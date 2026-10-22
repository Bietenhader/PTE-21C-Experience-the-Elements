// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The Madelung (Aufbau) generator, SPEC §11.2. Pure functions; mirrors tools/madelung.py.

export interface Subshell {
  readonly n: number;
  readonly l: number;
  readonly occupancy: number;
}

export const L_LETTERS = "spdfghik";
const NOBLE_GASES: ReadonlyArray<readonly [number, string]> = [
  [2, "He"],
  [10, "Ne"],
  [18, "Ar"],
  [36, "Kr"],
  [54, "Xe"],
  [86, "Rn"],
  [118, "Og"],
];

export const capacity = (l: number): number => 2 * (2 * l + 1);

/** Subshells in Madelung order: increasing n + l, then increasing n. */
export function madelungOrder(maxN = 9): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let n = 1; n <= maxN; n++) for (let l = 0; l < Math.min(n, 5); l++) out.push([n, l]);
  return out.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
}

const ORDER = madelungOrder();
const key = (n: number, l: number) => `${n},${l}`;

/** Occupancies predicted by the Madelung rule for a neutral atom of atomic number z. */
export function aufbau(z: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = z;
  for (const [n, l] of ORDER) {
    if (left === 0) break;
    const k = Math.min(left, capacity(l));
    out.set(key(n, l), k);
    left -= k;
  }
  return out;
}

/** Parse noble-gas notation such as "[Xe] 4f14 5d9 6s1". */
export function parseConfiguration(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const token of text.trim().split(/\s+/)) {
    const core = /^\[([A-Z][a-z]?)\]$/.exec(token);
    if (core) {
      const gas = NOBLE_GASES.find(([, sym]) => sym === core[1]);
      if (!gas) throw new Error(`unknown core ${token}`);
      for (const [k, v] of aufbau(gas[0])) out.set(k, (out.get(k) ?? 0) + v);
      continue;
    }
    const m = /^(\d+)([spdfghik])(\d+)$/.exec(token);
    if (!m) throw new Error(`cannot parse ${token} in ${text}`);
    const k = key(Number(m[1]), L_LETTERS.indexOf(m[2] ?? ""));
    out.set(k, (out.get(k) ?? 0) + Number(m[3]));
  }
  return out;
}

function electrons(cfg: Map<string, number>): number {
  let s = 0;
  for (const v of cfg.values()) s += v;
  return s;
}

function nobleCore(cfg: Map<string, number>): readonly [number, string] | undefined {
  const total = electrons(cfg);
  let best: readonly [number, string] | undefined;
  for (const gas of NOBLE_GASES) {
    if (gas[0] >= total) continue;
    const contained = [...aufbau(gas[0])].every(([k, v]) => cfg.get(k) === v);
    if (contained) best = gas;
  }
  return best;
}

/** Subshells outside the noble-gas core, ordered by n then l. */
export function valence(cfg: Map<string, number>): Subshell[] {
  const core = nobleCore(cfg);
  const coreCfg = core ? aufbau(core[0]) : new Map<string, number>();
  const out: Subshell[] = [];
  for (const [k, occ] of cfg) {
    const [n = 0, l = 0] = k.split(",").map(Number);
    const rest = occ - (coreCfg.get(k) ?? 0);
    if (rest > 0) out.push({ n, l, occupancy: rest });
  }
  return out.sort((a, b) => a.n - b.n || a.l - b.l);
}

/** Noble-gas notation, subshells ordered by n then l: "[Xe] 4f14 5d9 6s1". */
export function notation(cfg: Map<string, number>): string {
  const core = nobleCore(cfg);
  const parts = core ? [`[${core[1]}]`] : [];
  for (const s of valence(cfg)) parts.push(`${s.n}${L_LETTERS[s.l]}${s.occupancy}`);
  return parts.join(" ");
}

export function aufbauConfiguration(z: number): string {
  return notation(aufbau(z));
}

/** True when a measured configuration differs from the Madelung prediction. */
export function isAnomalous(z: number, measured: string): boolean {
  const a = aufbau(z);
  const m = parseConfiguration(measured);
  if (a.size !== m.size) return true;
  for (const [k, v] of a) if (m.get(k) !== v) return true;
  return false;
}

/** The noble-gas core of a configuration string, e.g. "[Xe]" → "Xe"; undefined if none. */
export function coreSymbol(configuration: string): string | undefined {
  return /^\[([A-Z][a-z]?)\]/.exec(configuration)?.[1];
}

/**
 * Why a measured configuration departs from the Madelung prediction, chosen from SPEC §10.5's small
 * set by what moved where. This classifies; it does not derive (the UI says so):
 * - "f-to-d": an f electron sits in d instead (La, Ce, Gd, Ac, Th, Pa, U, Np, Cm): (n−2)f and (n−1)d
 *   are nearly degenerate.
 * - "half-or-filled": s electrons moved into d and left it exactly half full or full (Cr, Cu, Mo, Pd,
 *   Ag, Au): the extra exchange stabilization of a half-filled or filled d shell.
 * - "d-s": s electrons moved into d without reaching half or full (Nb, Ru, Rh, Pt): (n−1)d and ns are
 *   nearly degenerate.
 * - "relativistic": a d electron moved to p (Lr: 7p instead of 6d): relativistic stabilization of
 *   the s and p₁/₂ orbitals.
 * null when the configuration follows the Madelung rule.
 */
export type AnomalyKind = "f-to-d" | "half-or-filled" | "d-s" | "relativistic";

export function anomalyKind(z: number, measured: string): AnomalyKind | null {
  if (!isAnomalous(z, measured)) return null;
  const a = aufbau(z);
  const m = parseConfiguration(measured);
  const delta = new Map<string, number>();
  for (const k of new Set([...a.keys(), ...m.keys()])) delta.set(k, (m.get(k) ?? 0) - (a.get(k) ?? 0));
  const changed = (l: number, sign: 1 | -1) =>
    [...delta].filter(([k, d]) => Number(k.split(",")[1]) === l && Math.sign(d) === sign).map(([k]) => k);
  const fLost = changed(3, -1);
  const dGained = changed(2, 1);
  const dLost = changed(2, -1);
  const sLost = changed(0, -1);
  const pGained = changed(1, 1);
  if (fLost.length && dGained.length) return "f-to-d";
  if (dLost.length && pGained.length) return "relativistic";
  if (sLost.length && dGained.length) {
    const d = m.get(dGained[0] ?? "") ?? 0;
    return d === 5 || d === 10 ? "half-or-filled" : "d-s";
  }
  return null;
}
