// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Relativity estimates (SPEC §11.5). Hydrogenic, so an approximation that the UI must name.

import { CODATA } from "./constants";

/** Speed of a 1s electron as a fraction of c in the hydrogenic (Bohr) model: v/c = Zα. */
export function zAlpha(z: number): number {
  return z * CODATA.alpha.value;
}

/** Lorentz factor γ = 1/√(1 − (v/c)²) for that speed; Infinity once Zα ≥ 1 (the model breaks down). */
export function lorentzFactor(betaValue: number): number {
  return betaValue >= 1 ? Infinity : 1 / Math.sqrt(1 - betaValue * betaValue);
}
