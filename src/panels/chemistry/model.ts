// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Pure helpers of the chemistry panel (SPEC §10.9): formulas with subscripts, ion labels, Shannon's
// coordination numbers, and the one ionic radius per ion that the size ladder draws.

import { superscriptDigits } from "../../data/format";
import type { ChemistryBonding, ChemistryIonicRadius } from "../../data/types";

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";

/** "Fe2(SO4)3" → "Fe₂(SO₄)₃". Coefficients ("CuSO4·5H2O" keeps its 5) and charges (NpO2⁺) stay as written. */
export function formulaText(formula: string): string {
  let out = "";
  let prev = "";
  for (const ch of formula) {
    const next = /\d/.test(ch) && /[A-Za-z)\]₀-₉]/.test(prev) ? (SUBSCRIPT[Number(ch)] ?? ch) : ch;
    out += next;
    prev = next;
  }
  return out;
}

/** Fe, 3 → "Fe³⁺"; O, −2 → "O²⁻"; Na, 1 → "Na⁺". */
export function ionLabel(symbol: string, charge: number): string {
  if (charge === 0) return symbol;
  const n = Math.abs(charge);
  return `${symbol}${n === 1 ? "" : superscriptDigits(n)}${charge > 0 ? "⁺" : "⁻"}`;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };

/** Shannon writes coordination as a Roman numeral, with SQ (square planar) or PY (pyramidal) after it. */
export function coordination(text: string): { n: number; geometry?: string } {
  const m = /^([IVX]+)(SQ|PY)?$/.exec(text);
  if (!m?.[1]) return { n: Number.NaN };
  const letters = m[1];
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const v = ROMAN[letters[i] ?? ""] ?? 0;
    const after = ROMAN[letters[i + 1] ?? ""] ?? 0;
    n += after > v ? -v : v;
  }
  if (m[2] === "SQ") return { n, geometry: "square planar" };
  if (m[2] === "PY") return { n, geometry: "pyramidal" };
  return { n };
}

export function coordinationText(text: string): string {
  const c = coordination(text);
  return c.geometry ? `${c.n} (${c.geometry})` : String(c.n);
}

export const SPIN_TEXT = { HS: "high spin", LS: "low spin" } as const;

/** One radius per ion (charge and spin) for the ladder: six-coordinate where Shannon lists it — the
 *  usual way to compare ions — else the row Shannon marks most reliable, else the first. */
export function ladderRadii(radii: ChemistryIonicRadius[]): ChemistryIonicRadius[] {
  const groups = new Map<string, ChemistryIonicRadius[]>();
  for (const r of radii) {
    const key = `${r.charge}|${r.spin ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map(
    (rows) => rows.find((r) => r.coordination === "VI") ?? rows.find((r) => r.mostReliable) ?? (rows[0] as ChemistryIonicRadius),
  );
}

/** Each ion with the coordination numbers Shannon lists for it, in order. */
export function coordinationByIon(radii: ChemistryIonicRadius[]): Array<{ key: string; charge: number; spin?: "HS" | "LS"; rows: ChemistryIonicRadius[] }> {
  const out: Array<{ key: string; charge: number; spin?: "HS" | "LS"; rows: ChemistryIonicRadius[] }> = [];
  for (const r of radii) {
    const key = `${r.charge}|${r.spin ?? ""}`;
    let group = out.find((g) => g.key === key);
    if (!group) {
      group = { key, charge: r.charge, rows: [], ...(r.spin ? { spin: r.spin } : {}) };
      out.push(group);
    }
    group.rows.push(r);
  }
  return out;
}

export const BONDING_TEXT: Record<ChemistryBonding["type"], string> = {
  metallic: "Metallic bonding: a lattice of ions held together by shared, freely moving electrons.",
  "covalent network": "A covalent network: every atom bonded to its neighbours in one giant structure.",
  "covalent layers": "Covalent layers: atoms bonded into sheets, stacked and held together more weakly.",
  "covalent chains": "Covalent chains: atoms bonded into long chains or rings, packed side by side.",
  molecular: "Molecules: small groups of covalently bonded atoms, held to each other only by weak forces.",
  monatomic: "Single atoms, held to each other only by weak forces.",
};
