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

/**
 * Slater's effective charge for one electron in subshell (n, l) of a neutral atom with atomic number
 * z and the given occupancies (keys "n,l", as madelung.parseConfiguration returns them).
 */
export function slaterZeff(z: number, occupancy: ReadonlyMap<string, number>, n: number, l: number): number {
  const own = group(n, l);
  let shielding = 0;
  for (const [key, count] of occupancy) {
    const [nn = 0, ll = 0] = key.split(",").map(Number);
    const g = group(nn, ll);
    const others = nn === n && ll === l ? count - 1 : count; // the electron does not shield itself
    if (others <= 0) continue;
    if (g === own) {
      shielding += others * (n === 1 ? 0.3 : 0.35);
    } else if (g > own) {
      continue; // electrons in groups to the right do not shield
    } else if (l <= 1) {
      // ns, np: the (n−1) shell shields 0.85 each, n−2 and lower 1.00 each.
      shielding += others * (nn === n - 1 ? 0.85 : nn < n - 1 ? 1 : 0);
    } else {
      shielding += others; // nd, nf: every group to the left shields fully
    }
  }
  return z - shielding;
}
