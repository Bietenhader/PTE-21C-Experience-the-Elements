// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementDetailFile, ElementIndexEntry, IndexFile, IsotopesFile } from "../../data/types";
import {
  coolingLimitsFor,
  isotopeMassKg,
  precisionExtremes,
  precisionList,
  referenceIsotope,
  statisticsRows,
  tMin,
} from "./model";

const read = <T,>(path: string) => JSON.parse(readFileSync(new URL(`../../../public/data/${path}`, import.meta.url), "utf8")) as T;
const index = read<IndexFile>("index.json");
const el = (z: number) => index.elements[z - 1] as ElementIndexEntry;
const detail = (z: number) => read<ElementDetailFile>(`elements/${z}.json`);
const isotopes = (z: number) => read<IsotopesFile>(`isotopes/${z}.json`).isotopes;

describe("probability model (SPEC §10.3)", () => {
  it("rubidium: both natural isotopes are bosons, and both were condensed", () => {
    const rows = statisticsRows(el(37), isotopes(37), detail(37).amo.laserCooling);
    expect(rows.map((r) => [r.A, r.kind])).toEqual([
      [85, "boson"],
      [87, "boson"],
    ]);
    expect(rows.find((r) => r.A === 87)?.bec?.year).toBe(1995);
  });

  it("potassium-40 is a fermion: the first degenerate Fermi gas of atoms (1999)", () => {
    const k40 = statisticsRows(el(19), isotopes(19), detail(19).amo.laserCooling).find((r) => r.A === 40);
    expect(k40?.kind).toBe("fermion");
    expect(k40?.dfg?.year).toBe(1999);
  });

  it("helium-3 is not abundant enough to matter, but it is listed: natural, a fermion, degenerate in 2006", () => {
    const he3 = statisticsRows(el(2), isotopes(2), detail(2).amo.laserCooling).find((r) => r.A === 3);
    expect(he3?.kind).toBe("fermion");
    expect(he3?.dfg?.year).toBe(2006);
  });

  it("the reference isotope and its mass", () => {
    const ref = referenceIsotope(detail(55), isotopes(55));
    expect(ref?.A).toBe(133);
    expect(((ref ? isotopeMassKg(ref) : null) ?? 0) / 2.2069e-25).toBeCloseTo(1, 3);
  });

  it("the slider reaches below the recoil limit where an element is laser-cooled", () => {
    const iso = referenceIsotope(detail(37), isotopes(37));
    const lim = coolingLimitsFor(detail(37).amo.laserCooling, iso?.A ?? 0, iso ? isotopeMassKg(iso) : null);
    expect(lim?.line).toBe("780 nm");
    expect(lim?.doppler).toBeGreaterThan(1e-4);
    expect(tMin(lim)).toBeLessThanOrEqual(1e-7);
    expect(tMin(null)).toBe(1e-7);
  });

  it("most and least precisely known: the least is still larger than its uncertainty", () => {
    for (const z of [1, 26, 37, 55, 92]) {
      const { items } = precisionList(el(z), detail(z), z <= 92 ? isotopes(z) : []);
      const { most, least } = precisionExtremes(items);
      expect(most, `Z=${z}`).toBeDefined();
      expect(least?.relative ?? 0).toBeLessThan(1);
      expect(most?.relative ?? 1).toBeLessThanOrEqual(least?.relative ?? 0);
    }
  });

  it("caesium's defining frequency counts as exact, not as the most precise measurement", () => {
    const { exact } = precisionList(el(55), detail(55), isotopes(55));
    expect(exact.some((x) => x.label.includes("hyperfine splitting"))).toBe(true);
  });
});
