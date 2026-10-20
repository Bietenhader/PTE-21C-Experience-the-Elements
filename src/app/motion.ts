// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Reduced motion (SPEC §2.9, §9.3): follows the system setting unless the user chose otherwise.

import { useSyncExternalStore } from "react";
import { type Motion, useSettings } from "./store";

const QUERY = "(prefers-reduced-motion: reduce)";

function media(): MediaQueryList | null {
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const mq = media();
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
}

const systemReduces = () => media()?.matches ?? false;

export function resolveReducedMotion(setting: Motion, system: boolean): boolean {
  return setting === "reduce" || (setting === "system" && system);
}

/** For code outside React (the morph): the current effective preference. */
export function reducedMotionNow(): boolean {
  return resolveReducedMotion(useSettings.getState().motion, systemReduces());
}

export function useReducedMotion(): boolean {
  const setting = useSettings((s) => s.motion);
  const system = useSyncExternalStore(subscribe, systemReduces, () => false);
  return resolveReducedMotion(setting, system);
}
