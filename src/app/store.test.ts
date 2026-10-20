// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./store";

describe("sanitizeSettings", () => {
  it("falls back to the defaults for anything unusable", () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("dark")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ layout: "spiral", theme: 3, lastPanel: "gossip" })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid saved choices", () => {
    const saved = { ...DEFAULT_SETTINGS, layout: "janet", theme: "light", energyUnit: "eV", lastPanel: "amo", shortcuts: false };
    expect(sanitizeSettings(saved)).toEqual(saved);
  });

  it("ignores unknown keys", () => {
    expect(sanitizeSettings({ layout: "adomah", extra: true })).toEqual({ ...DEFAULT_SETTINGS, layout: "adomah" });
  });
});
