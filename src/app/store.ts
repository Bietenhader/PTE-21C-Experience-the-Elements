// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// App state (Zustand). Two stores:
//   useSettings — the user's choices (SPEC §9.3), saved in localStorage;
//   useView     — what is on screen now (open sheet, overlay, search, zoom), mirrored in the URL
//                 where SPEC §9.4 says so, never saved.
//
// Every localStorage access is wrapped in try/catch: private windows and locked-down browsers
// throw on access, and a corrupt or outdated saved value must never stop the app from starting.

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { isPanelSlug, type PanelSlug } from "../panels/slugs";
import type { EnergyUnit, TemperatureUnit } from "../physics/units";
import { DEFAULT_GROUP3, DEFAULT_LAYOUT, type Group3, LAYOUT_IDS, type LayoutId, type Overlay } from "./route";

export type Palette = "campion" | "colour-safe";
export type Theme = "dark" | "light";
export type Motion = "system" | "reduce" | "full";
export type { EnergyUnit, TemperatureUnit };

export interface Settings {
  layout: LayoutId;
  group3: Group3;
  palette: Palette;
  theme: Theme;
  motion: Motion;
  energyUnit: EnergyUnit;
  temperatureUnit: TemperatureUnit;
  /** Single-key shortcuts (/, L, T). WCAG 2.1.4 requires a way to turn them off. */
  shortcuts: boolean;
  /** The panel the sheet opens on (SPEC §9.2: the last one opened). */
  lastPanel: PanelSlug;
  /** The "zoom in to see more" tip has done its job (dismissed, or the user has zoomed). */
  zoomHintSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  layout: DEFAULT_LAYOUT,
  group3: DEFAULT_GROUP3,
  palette: "campion",
  theme: "dark",
  motion: "system",
  energyUnit: "kJ/mol",
  temperatureUnit: "K",
  shortcuts: true,
  lastPanel: "orbitals",
  zoomHintSeen: false,
};

const CHOICES: { [K in keyof Settings]: (v: unknown) => v is Settings[K] } = {
  layout: (v): v is LayoutId => (LAYOUT_IDS as readonly unknown[]).includes(v),
  group3: (v): v is Group3 => v === "lu" || v === "la",
  palette: (v): v is Palette => v === "campion" || v === "colour-safe",
  theme: (v): v is Theme => v === "dark" || v === "light",
  motion: (v): v is Motion => v === "system" || v === "reduce" || v === "full",
  energyUnit: (v): v is EnergyUnit => v === "kJ/mol" || v === "eV",
  temperatureUnit: (v): v is TemperatureUnit => v === "K" || v === "°C",
  shortcuts: (v): v is boolean => typeof v === "boolean",
  lastPanel: (v): v is PanelSlug => typeof v === "string" && isPanelSlug(v),
  zoomHintSeen: (v): v is boolean => typeof v === "boolean",
};

/** Keeps only saved values that are still valid choices; everything else falls back to the default. */
export function sanitizeSettings(saved: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof saved !== "object" || saved === null) return out;
  const record = saved as Record<string, unknown>;
  for (const key of Object.keys(CHOICES) as Array<keyof Settings>) {
    const value = record[key];
    if (CHOICES[key](value)) (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}

export const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Storage full or forbidden: the setting still applies for this visit.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

interface SettingsActions {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: "pte-21c.settings",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) =>
        Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, s[k as keyof Settings]])) as unknown as Settings,
      merge: (saved, current) => ({ ...current, ...sanitizeSettings(saved) }),
    },
  ),
);

/** Tile width in CSS pixels, or "fit" to follow the width of the window. */
export type Zoom = { mode: "fit" } | { mode: "manual"; tileWidth: number };

export interface View {
  /** Symbol of the element whose sheet is open. */
  element: string | null;
  panel: PanelSlug | null;
  overlay: Overlay | null;
  query: string;
  zoom: Zoom;
  settingsOpen: boolean;
}

export const useView = create<View>()(() => ({
  element: null,
  panel: null,
  overlay: null,
  query: "",
  zoom: { mode: "fit" },
  settingsOpen: false,
}));
