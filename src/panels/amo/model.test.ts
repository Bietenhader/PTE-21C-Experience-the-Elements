// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementDetailFile, ElementIndexEntry, IndexFile, IsotopesFile, MetrologyFile } from "../../data/types";
import {
  coolingLimits,
  coolingMass,
  hyperfineViews,
  noHyperfine,
  secondTimeline,
  speciesLabel,
  levelText,
  transitionText,
  unlistedSpins,
  withPrefix,
} from "./model";

const read = <T,>(path: string) => JSON.parse(readFileSync(new URL(`../../../public/data/${path}`, import.meta.url), "utf8")) as T;
const index = read<IndexFile>("index.json");
const el = (z: number) => index.elements[z - 1] as ElementIndexEntry;
const detail = (z: number) => read<ElementDetailFile>(`elements/${z}.json`);
const isotopes = (z: number) => read<IsotopesFile>(`isotopes/${z}.json`).isotopes;
const metrology = read<MetrologyFile>("metrology.json");

describe("AMO model (SPEC §10.6)", () => {
  it("labels species: isotopes, ions, natural mixtures", () => {
    expect(speciesLabel("Cs", 133, 0)).toBe("¹³³Cs");
    expect(speciesLabel("Sr", 88, 1)).toBe("⁸⁸Sr⁺");
    expect(speciesLabel("Sr", "natural", 1)).toBe("Sr⁺ (natural mixture)");
    expect(speciesLabel("H", null, 0)).toBe("H");
  });

  it("caesium-133: the headline row first, F = 3 and 4 split by the defining frequency", () => {
    const [v] = hyperfineViews(el(55), detail(55), isotopes(55));
    expect(v?.headline).toBe(true);
    expect(v?.I).toBe(3.5);
    expect(v?.J).toBe(0.5);
    expect(v?.levels.map((l) => l.F)).toEqual([3, 4]);
    const [lo, hi] = v?.levels ?? [];
    expect((hi?.energy ?? 0) - (lo?.energy ?? 0)).toBeCloseTo(9192.63177, 5);
  });

  it("rubidium-87's row gives only the splitting: I comes from the isotope data, J from the ground term, A is derived", () => {
    const v = hyperfineViews(el(37), detail(37), isotopes(37)).find((x) => x.row.A === 87);
    expect(v?.I).toBe(1.5);
    expect(v?.J).toBe(0.5);
    expect(v?.aDerived).toBe(true);
    expect(v?.aMHz).toBeCloseTo(6834.68261 / 2, 4);
  });

  it("no 'other isotopes with a spin' when the ground level has J = 0 (helium, strontium)", () => {
    expect(unlistedSpins(el(2), isotopes(2), detail(2).amo.hyperfine)).toEqual([]);
    expect(unlistedSpins(el(38), isotopes(38), detail(38).amo.hyperfine)).toEqual([]);
    // Oxygen's ground level ³P₂ has J = 2, and ¹⁷O (I = 5/2) is natural but not yet in the table.
    expect(unlistedSpins(el(8), isotopes(8), detail(8).amo.hyperfine).map((i) => i.A)).toEqual([17]);
  });

  it("helium has no ground-state hyperfine structure: not applicable, J = 0", () => {
    const m = noHyperfine(el(2));
    expect(m.reason).toBe("not_applicable");
    expect(m.note).toMatch(/J = 0/);
  });

  it("caesium D2: the limits from the stored line match Steck's data sheet to 0.5 %", () => {
    const row = detail(55).amo.laserCooling[0];
    if (!row) throw new Error("no Cs cooling row");
    const lim = coolingLimits(row, coolingMass(row, el(55), isotopes(55)));
    // Steck, Cesium D Line Data (rev. 2.3.3): T_D = 125.61 μK (with Γ/2π = 5.2227 MHz), T_r = 198.34 nK,
    // v_r = 3.5225 mm/s, I_sat = 1.1023 mW/cm² (cycling transition). NIST's A_ki gives Γ/2π = 5.2187 MHz.
    expect(Math.abs((lim.doppler ?? 0) / 125.61e-6 - 1)).toBeLessThan(0.005);
    expect(Math.abs((lim.recoil ?? 0) / 198.34e-9 - 1)).toBeLessThan(0.005);
    expect(Math.abs((lim.recoilVelocity ?? 0) / 3.5225e-3 - 1)).toBeLessThan(0.005);
    expect(Math.abs((lim.saturation ?? 0) / 11.023 - 1)).toBeLessThan(0.005);
  });

  it("a natural-mixture line uses the standard atomic weight", () => {
    const row = detail(2).amo.laserCooling.find((r) => r.A === "natural");
    if (!row) throw new Error("no natural He row");
    expect(coolingMass(row, el(2), isotopes(2))?.basis).toBe("atomic weight");
  });

  it("writes the BIPM list's transition labels as printed", () => {
    expect(transitionText("5s^2 ^1S_0 - 5s5p ^3P_0")).toBe("5s² ¹S₀ – 5s5p ³P₀");
    expect(transitionText("5s ^2S_{1/2} - 4d ^2D_{5/2}")).toBe("5s ²S₁/₂ – 4d ²D₅/₂");
    expect(transitionText("6s 2S1/2 (F=3) – 6s 2S1/2 (F=4)")).toBe("6s ²S₁/₂ (F=3) – 6s ²S₁/₂ (F=4)");
    expect(transitionText("6S ^2S_{1/2} (F=0) - 4f^{13}6s^2 ^2F_{7/2} (F=3)")).toBe("6S ²S₁/₂ (F=0) – 4f¹³6s² ²F₇/₂ (F=3)");
    expect(transitionText("5S_{1/2} (Fg=3) - 5D_{5/2} (Fe=5)")).toBe("5S₁/₂ (Fg=3) – 5D₅/₂ (Fe=5)");
    expect(transitionText("229Th nucleus, ground state 5/2+ – isomer 3/2+ (in a CaF2 crystal)")).toBe(
      "229Th nucleus, ground state 5/2+ – isomer 3/2+ (in a CaF2 crystal)",
    );
  });

  it("prints NIST's plain level labels with superscripts and subscripts", () => {
    expect(levelText("6s 2S1/2")).toBe("6s ²S₁/₂");
    expect(levelText("3s3p 1P1")).toBe("3s3p ¹P₁");
    expect(levelText("4f10 6s2 5I8")).toBe("4f¹⁰ 6s² ⁵I₈");
    expect(levelText("2p5(2P3/2)3p 2[5/2]3")).toBe("2p⁵(²P₃/₂)3p ²[5/2]₃");
    expect(levelText("4f11(4I15/2)6s6p(1P1) (15/2,1)17/2")).toBe("4f¹¹(⁴I₁₅/₂)6s6p(¹P₁) (15/2,1)₁₇/₂");
    expect(levelText("4f12(3H5)5d3/2 6s2 (5,3/2)9/2")).toBe("4f¹²(³H₅)5d3/2 6s² (5,3/2)₉/₂");
    expect(levelText("4f12(3H)6s6p J=7")).toBe("4f¹²(³H)6s6p J=7");
  });

  it("puts computed values in readable units", () => {
    expect(withPrefix(1.456e-4, "K")).toBe("145.6 μK");
    expect(withPrefix(3.5226e-3, "m/s")).toBe("3.523 mm/s");
    expect(withPrefix(9.19263177e9, "Hz", 4)).toBe("9.193 GHz");
  });

  it("marks the timeline of the second for caesium (1967, 2018) and thorium (its three entries)", () => {
    const cs = secondTimeline(metrology, el(55), detail(55)).filter((t) => t.mine).map((t) => t.year);
    expect(cs).toEqual([1967, 2018]);
    const th = secondTimeline(metrology, el(90), detail(90)).filter((t) => t.mine);
    expect(th.length).toBe(3);
    expect(secondTimeline(metrology, el(2), detail(2)).some((t) => t.mine)).toBe(false);
  });
});
