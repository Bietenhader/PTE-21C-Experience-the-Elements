// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import type { ElementIndexEntry, GhsHazards } from "../../data/types";
import { molarMass, mostlyNotHazardous, priceIsCurrent, specificHeat } from "./model";

const element = (atomicWeight: unknown) => ({ Z: 1, atomicWeight }) as unknown as ElementIndexEntry;
const cp = (value: number) => ({ value, unit: "J/(mol·K)", source: "crc_handbook" }) as const;

describe("physical model", () => {
  it("molar mass: the standard atomic weight, the conventional value of an interval, none without", () => {
    expect(molarMass(element({ value: 55.845, unc: 0.002, unit: "u", source: "nist_awic" }))).toBe(55.845);
    const interval = { low: 1.00784, high: 1.00811, unit: "u", source: "nist_awic", conventional: { value: 1.008, unit: "u", source: "ciaaw" } };
    expect(molarMass(element(interval))).toBe(1.008);
    expect(molarMass(element({ missing: true, reason: "no_stable_isotope" }))).toBeNull();
  });

  it("specific heat: iron 25.10 J/(mol·K) / 55.845 g/mol ≈ 0.449 J/(g·K)", () => {
    const r = specificHeat(cp(25.1), undefined, element({ value: 55.845, unit: "u", source: "nist_awic" }));
    expect(r.ok && r.value).toBeCloseTo(0.4495, 4);
  });

  it("specific heat of a diatomic: H₂ 28.836 J/(mol·K) per 2 × 1.008 g", () => {
    const interval = { low: 1.00784, high: 1.00811, unit: "u", source: "nist_awic", conventional: { value: 1.008, unit: "u", source: "ciaaw" } };
    const r = specificHeat(cp(28.836), 2, element(interval));
    expect(r.ok && r.value).toBeCloseTo(14.30, 2);
  });

  it("specific heat is missing, with a reason, without a heat capacity or an atomic weight", () => {
    const none = specificHeat({ missing: true, reason: "not_measured" }, undefined, element({ value: 1, unit: "u", source: "x" }));
    expect(none.ok).toBe(false);
    const radon = specificHeat(cp(20.786), undefined, element({ missing: true, reason: "no_stable_isotope" }));
    expect(!radon.ok && radon.why.reason).toBe("no_stable_isotope");
  });

  it("prices more than five years old are not shown", () => {
    expect(priceIsCurrent(2025, 2026)).toBe(true);
    expect(priceIsCurrent(2021, 2026)).toBe(true);
    expect(priceIsCurrent(2020, 2026)).toBe(false);
  });

  it("an ECHA aggregation is mostly 'not hazardous' when more than half the reports say so", () => {
    const h = (share?: number) => ({ notMeetingCriteria: share === undefined ? undefined : { share, reports: 1, of: 2 } }) as GhsHazards;
    expect(mostlyNotHazardous(h(74.1))).toBe(true);
    expect(mostlyNotHazardous(h(40.2))).toBe(false);
    expect(mostlyNotHazardous(h())).toBe(false);
  });
});
