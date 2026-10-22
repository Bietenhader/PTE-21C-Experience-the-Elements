// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Nuclear shell closures. The magic numbers of the nuclear shell model (M. Goeppert Mayer,
// Phys. Rev. 75, 1969, 1949; O. Haxel, J. H. D. Jensen and H. E. Suess, Phys. Rev. 75, 1766, 1949):
// a nucleus with this many protons or neutrons is unusually tightly bound.

export const MAGIC_NUMBERS: readonly number[] = [2, 8, 20, 28, 50, 82, 126];

export const isMagic = (count: number): boolean => MAGIC_NUMBERS.includes(count);

/** "doubly magic" when both Z and N are magic, as for ²⁰⁸Pb or ⁴⁸Ca. */
export function magicKind(z: number, n: number): "doubly" | "protons" | "neutrons" | null {
  if (isMagic(z) && isMagic(n)) return "doubly";
  if (isMagic(z)) return "protons";
  if (isMagic(n)) return "neutrons";
  return null;
}

/** Boson (integer total spin) or fermion (half-integer): set by the number of nucleons plus electrons. */
export function statistics(a: number, electrons: number): "boson" | "fermion" {
  return (a + electrons) % 2 === 0 ? "boson" : "fermion";
}
