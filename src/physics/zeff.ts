// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Effective nuclear charge (SPEC §11.1). The orbitals panel uses the Clementi–Raimondi values from
// zeff.toml where they exist (He–Rn); Slater's rules (J. C. Slater, Phys. Rev. 36, 57, 1930) are
// the fallback: for hydrogen (where they give the exact Z = 1), beyond radon, and for any subshell
// the table lacks.

import { L_LETTER } from "./hydrogenic";

/** Slater's groups, in his order: (1s)(2s,2p)(3s,3p)(3d)(4s,4p)(4d)(4f)(5s,5p)(5d)(5f)(6s,6p)(6d)(7s,7p)… */
const GROUPS: readonly string[] = (() => {
  const out: string[] = [];
  for (let n = 1; n <= 8; n++) {
    out.push(`${n}sp`);
    if (n >= 3) out.push(`${n}d`);
    if (n >= 4) out.push(`${n}f`);
  }
  return out;
})();

function group(n: number, l: number): number {
  const name = l <= 1 ? `${n}sp` : `${n}${L_LETTER[l]}`;
  const i = GROUPS.indexOf(name);
  if (i < 0) throw new RangeError(`no Slater group for n = ${n}, l = ${l}`);
  return i;
}

export interface SlaterStep {
  /** Which electrons: "the other 2s and 2p electrons", "the n = 1 shell", … */
  label: string;
  count: number;
  /** Shielding per electron: 0.30, 0.35, 0.85 or 1.00. */
  each: number;
  total: number;
}

/** "2s and 2p", "3d", "1s": the electrons of Slater group g. */
function groupLabel(g: number): string {
  const name = GROUPS[g] ?? "";
  if (!name.endsWith("sp")) return name;
  const n = name.slice(0, -2);
  return n === "1" ? "1s" : `${n}s and ${n}p`;
}

/**
 * Slater's rules worked through for one electron in subshell (n, l) of a neutral atom with atomic
 * number z and the given occupancies (keys "n,l", as madelung.parseConfiguration returns them): the
 * shielding of each kind of electron, and Z_eff = Z − Σ shielding.
 */
export function slaterSteps(
  z: number,
  occupancy: ReadonlyMap<string, number>,
  n: number,
  l: number,
): { steps: SlaterStep[]; shielding: number; zeff: number } {
  const own = group(n, l);
  const tally = new Map<string, { label: string; count: number; each: number; order: number }>();
  const add = (k: string, label: string, count: number, each: number, order: number) => {
    const t = tally.get(k) ?? { label, count: 0, each, order };
    t.count += count;
    tally.set(k, t);
  };
  for (const [key, count] of occupancy) {
    const [nn = 0, ll = 0] = key.split(",").map(Number);
    const g = group(nn, ll);
    const others = nn === n && ll === l ? count - 1 : count; // the electron does not shield itself
    if (others <= 0 || g > own) continue; // electrons in groups to the right do not shield
    if (g === own) {
      add("same", `the other electrons in its own group (${groupLabel(own)})`, others, n === 1 ? 0.3 : 0.35, 0);
    } else if (l <= 1) {
      // ns, np: the (n−1) shell shields 0.85 each, n−2 and lower 1.00 each.
      if (nn === n - 1) add("n-1", `the n = ${n - 1} shell`, others, 0.85, 1);
      else add("inner", `the shells n ≤ ${n - 2}`, others, 1, 2);
    } else {
      add("left", "every group to its left", others, 1, 1); // nd, nf: every group to the left shields fully
    }
  }
  const steps = [...tally.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ label, count, each }) => ({ label, count, each, total: count * each }));
  const shielding = steps.reduce((acc, s) => acc + s.total, 0);
  return { steps, shielding, zeff: z - shielding };
}

/**
 * Slater's effective charge for one electron in subshell (n, l) of a neutral atom with atomic number
 * z and the given occupancies (keys "n,l", as madelung.parseConfiguration returns them).
 */
export function slaterZeff(z: number, occupancy: ReadonlyMap<string, number>, n: number, l: number): number {
  return slaterSteps(z, occupancy, n, l).zeff;
}

/** Slater's effective principal quantum number n* (1930): n up to 3, then 3.7, 4.0, 4.2; none beyond 6. */
export function slaterNStar(n: number): number | null {
  return n <= 3 ? n : ({ 4: 3.7, 5: 4.0, 6: 4.2 } as Record<number, number>)[n] ?? null;
}
