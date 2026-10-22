// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The mathematical panel's model (SPEC §10.5): everything here is computed from the configuration,
// the ground term and CODATA constants; nothing is stored. Pure; no React.

import type { ElementIndexEntry } from "../../data/types";
import { CODATA } from "../../physics/constants";
import { anomalyKind, type AnomalyKind, parseConfiguration } from "../../physics/madelung";
import { lorentzFactor, zAlpha } from "../../physics/relativity";
import { type Electron, fillSubshell, hund, type HundResult, landeLS } from "../../physics/terms";
import { slaterNStar, slaterSteps } from "../../physics/zeff";

/** One rydberg, the hydrogen-atom energy scale, in eV: half the Hartree energy (CODATA). */
export const RYDBERG_EV = CODATA.hartreeEV.value / 2;

/** |g_e|, the electron's g-factor (CODATA), for the Landé formula. */
export const G_S = Math.abs(CODATA.ge.value);

export interface ValenceSubshell {
  n: number;
  l: number;
  occupancy: number;
  electrons: Electron[];
  closed: boolean;
}

/** The valence subshells with every electron's quantum numbers, filled by Hund's first two rules. */
export function valenceElectrons(e: ElementIndexEntry): ValenceSubshell[] {
  return e.configuration.valenceSubshells.map((s) => ({
    n: s.n,
    l: s.l,
    occupancy: s.occupancy,
    electrons: fillSubshell(s.n, s.l, s.occupancy),
    closed: s.occupancy === 2 * (2 * s.l + 1),
  }));
}

export function hundFor(e: ElementIndexEntry): HundResult {
  return hund(parseConfiguration(e.configuration.measured));
}

/**
 * The electron the first ionization removes, as a rule of thumb: the one in the subshell with the
 * largest n (and, among those, the largest l). Right for the main groups and for the transition and
 * inner-transition metals, whose outer s electron leaves first.
 */
export function outermost(e: ElementIndexEntry): { n: number; l: number } {
  const occ = parseConfiguration(e.configuration.measured);
  let best = { n: 0, l: 0 };
  for (const [key, count] of occ) {
    if (count <= 0) continue;
    const [n = 0, l = 0] = key.split(",").map(Number);
    if (n > best.n || (n === best.n && l > best.l)) best = { n, l };
  }
  return best;
}

export function slaterFor(e: ElementIndexEntry) {
  const { n, l } = outermost(e);
  return { n, l, ...slaterSteps(e.Z, parseConfiguration(e.configuration.measured), n, l) };
}

/** The hydrogenic estimate of the binding energy, R·Z_eff²/n², in eV. */
export const hydrogenicEnergy = (zeff: number, n: number): number => (RYDBERG_EV * zeff * zeff) / (n * n);

export { slaterNStar };

export interface Relativity {
  beta: number;
  gamma: number;
  /** The 1s radius relative to its non-relativistic value in the Bohr model, √(1 − β²) = 1/γ. */
  contraction: number;
}

export function relativityFor(z: number): Relativity {
  const beta = zAlpha(z);
  const gamma = lorentzFactor(beta);
  return { beta, gamma, contraction: 1 / gamma };
}

/** Z at which Zα = 1, where the point-nucleus Dirac 1s state ceases to exist: 1/α from CODATA. */
export const POINT_NUCLEUS_LIMIT = 1 / CODATA.alpha.value;

export function landeFor(S: number, L: number, J: number): number | null {
  return landeLS(S, L, J, G_S);
}

export function anomalyFor(e: ElementIndexEntry): AnomalyKind | null {
  return anomalyKind(e.Z, e.configuration.measured);
}

/** The explanations of SPEC §10.5, one per kind of anomaly: an explanation, not a derivation. */
export const ANOMALY_TEXT: Record<AnomalyKind, string> = {
  "half-or-filled":
    "An s electron has moved into the d subshell and left it exactly half full or full. Half-filled and filled d shells gain extra exchange energy (electrons with parallel spins avoid each other), enough here to outweigh the cost of promoting the electron.",
  "d-s":
    "An s electron has moved into the d subshell. The (n−1)d and ns orbitals have nearly the same energy in these atoms, so small differences in the electron–electron repulsion decide which arrangement is lowest.",
  "f-to-d":
    "An electron the Madelung rule puts in the f subshell sits in d instead. Early in the lanthanides and actinides the (n−2)f and (n−1)d orbitals are close in energy; the f orbitals only drop clearly below d as the nuclear charge grows.",
  relativistic:
    "An electron the Madelung rule puts in 6d sits in 7p instead. In an atom this heavy, relativity pulls the s and p₁/₂ orbitals in and lowers their energy, enough to bring 7p₁/₂ below 6d.",
};
