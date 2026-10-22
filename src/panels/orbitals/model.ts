// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The orbitals panel's model (SPEC §10.1): the occupied subshells of the ground configuration, each
// with its effective charge (Clementi–Raimondi where the table has it, otherwise Slater's rules), its
// NIST SRD 141 orbital energy, and the hydrogenic radii and node counts. Pure; no React.

import type { ElementDetailFile, ElementIndexEntry } from "../../data/types";
import { CODATA } from "../../physics/constants";
import {
  L_LETTER,
  meanRadius,
  mostProbableRadius,
  radialNodes,
  radiusSpread,
} from "../../physics/hydrogenic";
import { parseConfiguration } from "../../physics/madelung";
import { slaterZeff } from "../../physics/zeff";

/** One Bohr radius in picometres, from CODATA (src/physics/constants.ts). */
export const A0_PM = CODATA.a0.value * 1e12;

export interface SubshellInfo {
  n: number;
  l: number;
  label: string;
  occupancy: number;
  zeff: { value: number; method: "clementi" | "slater"; source: string };
  /** NIST SRD 141 LDA eigenvalue, eV (null when SRD 141 does not cover the element). */
  energy: { eV: number; method: string; source: string } | null;
  meanPm: number;
  mostProbablePm: number;
  spreadPm: number;
  radialNodes: number;
  angularNodes: number;
  valence: boolean;
}

/** The method used for the energies shown and for ordering the gallery. */
export const ENERGY_METHOD = "LDA";

export function subshells(e: ElementIndexEntry, d: ElementDetailFile): SubshellInfo[] {
  const occupancy = parseConfiguration(e.configuration.measured);
  const valence = new Set(e.configuration.valenceSubshells.map((s) => `${s.n},${s.l}`));
  const out: SubshellInfo[] = [];
  for (const [key, count] of occupancy) {
    if (count <= 0) continue;
    const [n = 0, l = 0] = key.split(",").map(Number);
    const table = d.orbitals.zeff.find((z) => z.n === n && z.l === l);
    const zeff = table
      ? { value: table.value, method: "clementi" as const, source: table.source }
      : { value: slaterZeff(e.Z, occupancy, n, l), method: "slater" as const, source: "slater1930" };
    const eig = d.orbitals.eigenvalues.find((x) => x.n === n && x.l === l && x.method === ENERGY_METHOD);
    out.push({
      n,
      l,
      label: `${n}${L_LETTER[l]}`,
      occupancy: count,
      zeff,
      energy: eig ? { eV: eig.eV, method: eig.method, source: eig.source } : null,
      meanPm: meanRadius(n, l, zeff.value) * A0_PM,
      mostProbablePm: mostProbableRadius(n, l, zeff.value) * A0_PM,
      spreadPm: radiusSpread(n, l, zeff.value) * A0_PM,
      radialNodes: radialNodes(n, l),
      angularNodes: l,
      valence: valence.has(key),
    });
  }
  // Ordered by orbital energy where SRD 141 gives it, else by the Madelung order (n + l, then n).
  const allEnergies = out.every((s) => s.energy);
  out.sort((a, b) =>
    allEnergies ? (a.energy?.eV ?? 0) - (b.energy?.eV ?? 0) : a.n + a.l - (b.n + b.l) || a.n - b.n,
  );
  return out;
}

export const orderedByEnergy = (list: SubshellInfo[]) => list.every((s) => s.energy);
