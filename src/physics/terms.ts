// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Quantum numbers, Hund's rules and LS terms (SPEC §10.5). Pure functions.
// Hund's rules (F. Hund, 1925) for the ground term of an open subshell: (1) the largest total spin S;
// (2) for that S, the largest total orbital angular momentum L; (3) J = |L − S| if the subshell is less
// than half full, J = L + S if more than half full. With several open subshells the rules are only a
// guide: the spins and the orbital momenta are added, and the third rule is taken from the subshell
// that carries the largest L (the UI says so and compares with NIST).

import { capacity } from "./madelung";

export const L_SYMBOLS = "SPDFGHIKLMNOQRTUV"; // spectroscopic letters for L = 0, 1, 2, … (J is skipped)

export interface Electron {
  n: number;
  l: number;
  ml: number;
  /** +½ (spin up) or −½ (spin down). */
  ms: number;
}

export interface OpenSubshell {
  n: number;
  l: number;
  count: number;
  electrons: Electron[];
  S: number;
  L: number;
  /** How full it is, for Hund's third rule. */
  filling: "less than half" | "half" | "more than half";
}

export interface HundResult {
  /** Subshells neither empty nor full, in the order given. */
  open: OpenSubshell[];
  S: number;
  L: number;
  J: number;
  /** Which form of the third rule gave J. */
  rule3: string;
  parity: "even" | "odd";
}

/**
 * The electrons of one subshell placed by Hund's first two rules: one per orbital with spin up, from
 * m_l = +l down to −l, then spin down in the same order.
 */
export function fillSubshell(n: number, l: number, count: number): Electron[] {
  const out: Electron[] = [];
  const orbitals = 2 * l + 1;
  for (let i = 0; i < count; i++) {
    const up = i < orbitals;
    out.push({ n, l, ml: l - (i % orbitals), ms: up ? 0.5 : -0.5 });
  }
  return out;
}

/** Parity of a configuration: (−1)^Σl over all electrons. */
export function parity(occupancy: ReadonlyMap<string, number>): "even" | "odd" {
  let sum = 0;
  for (const [key, count] of occupancy) sum += (Number(key.split(",")[1]) || 0) * count;
  return sum % 2 === 0 ? "even" : "odd";
}

/** Hund's rules applied to the open subshells of a configuration (keys "n,l" → electrons). */
export function hund(occupancy: ReadonlyMap<string, number>): HundResult {
  const open: OpenSubshell[] = [];
  for (const [key, count] of occupancy) {
    const [n = 0, l = 0] = key.split(",").map(Number);
    if (count <= 0 || count >= capacity(l)) continue;
    const electrons = fillSubshell(n, l, count);
    const S = Math.abs(electrons.reduce((a, e) => a + e.ms, 0));
    const L = Math.abs(electrons.reduce((a, e) => a + e.ml, 0));
    const half = 2 * l + 1;
    open.push({ n, l, count, electrons, S, L, filling: count < half ? "less than half" : count === half ? "half" : "more than half" });
  }
  const S = open.reduce((a, o) => a + o.S, 0);
  const L = open.reduce((a, o) => a + o.L, 0);
  let J: number;
  let rule3: string;
  // The third rule comes from the subshell carrying the most orbital angular momentum (ties: larger l).
  const lead = [...open].sort((a, b) => b.L - a.L || b.l - a.l)[0];
  const several = open.length > 1 ? ` (several open subshells: the rule of ${lead ? `${lead.n}${"spdfghik"[lead.l]}` : ""}, taken as a guide)` : "";
  if (!lead) {
    J = 0;
    rule3 = "closed shells: J = 0";
  } else if (L === 0) {
    J = S;
    rule3 = `L = 0, so J = S${several}`;
  } else if (lead.filling === "less than half") {
    J = Math.abs(L - S);
    rule3 = `${lead.n}${"spdfghik"[lead.l]} is less than half full: J = |L − S|${several}`;
  } else {
    J = L + S;
    rule3 = `${lead.n}${"spdfghik"[lead.l]} is ${lead.filling === "half" ? "half" : "more than half"} full: J = L + S${several}`;
  }
  return { open, S, L, J, rule3, parity: parity(occupancy) };
}

/** "3/2" for 1.5, "4" for 4. */
export function half(x: number): string {
  return Number.isInteger(x) ? String(x) : `${Math.round(2 * x)}/2`;
}

/** The term symbol as text: ²S₁/₂ → { multiplicity: 2, letter: "S", J: "1/2", odd: false }. */
export function termParts(S: number, L: number, J: number, odd: boolean) {
  return { multiplicity: Math.round(2 * S + 1), letter: L_SYMBOLS[L] ?? `L=${L}`, J: half(J), odd };
}

/**
 * Landé g-factor in LS coupling: g_J = 1 + (g_S − 1)·[J(J+1) + S(S+1) − L(L+1)] / [2J(J+1)], with
 * g_L = 1 and g_S the electron's g-factor (|g_e| ≈ 2.002 319); null for J = 0, where it is undefined.
 */
export function landeLS(S: number, L: number, J: number, gS: number): number | null {
  if (J === 0) return null;
  return 1 + ((gS - 1) * (J * (J + 1) + S * (S + 1) - L * (L + 1))) / (2 * J * (J + 1));
}
