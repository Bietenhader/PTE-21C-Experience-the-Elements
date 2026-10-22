// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IsotopesFile } from "../../data/types";
import {
  defaultIsotope,
  dominantDecay,
  halfLifeWords,
  isotopeFamily,
  isotopeLabel,
  jpText,
  modeFamily,
  modeLabel,
  naturalUnit,
  photonEnergyEv,
  sci,
  tidy,
} from "./model";

const iso = (z: number) =>
  JSON.parse(readFileSync(new URL(`../../../public/data/isotopes/${z}.json`, import.meta.url), "utf8")) as IsotopesFile;

describe("decay modes", () => {
  it("names IAEA's codes in words and falls back to the code", () => {
    expect(modeLabel("B-")).toBe("β⁻ decay");
    expect(modeLabel("EC+B+")).toBe("electron capture / β⁺ decay");
    expect(modeLabel("A")).toBe("α decay");
    expect(modeLabel("SF")).toBe("spontaneous fission");
    expect(modeLabel("IT")).toBe("isomeric transition");
    expect(modeLabel("P")).toBe("proton emission");
    expect(modeLabel("N")).toBe("neutron emission");
    expect(modeLabel("B-2N")).toBe("β⁻ decay, then two-neutron emission");
    expect(modeLabel("14C")).toBe("cluster decay (emits ¹⁴C)");
    expect(modeLabel("24NE")).toBe("cluster decay (emits ²⁴Ne)");
    expect(modeLabel("{+34}Si")).toBe("cluster decay (emits ³⁴Si)");
    expect(modeLabel("XYZ")).toBe("XYZ");
  });

  it("groups modes into families", () => {
    expect(modeFamily("B-N")).toBe("beta-minus");
    expect(modeFamily("ECP")).toBe("beta-plus");
    expect(modeFamily("2P")).toBe("particle");
    expect(modeFamily("24NE")).toBe("cluster");
    expect(modeFamily("SF")).toBe("fission");
  });

  it("picks the dominant decay by branching ratio", () => {
    const th232 = iso(90).isotopes.find((i) => i.A === 232);
    expect(th232 && dominantDecay(th232)?.mode).toBe("A");
    const fe56 = iso(26).isotopes.find((i) => i.A === 56);
    expect(fe56 && isotopeFamily(fe56)).toBe("stable");
  });
});

describe("the default isotope", () => {
  it("is the reference isotope, else the most abundant, else the longest-lived", () => {
    expect(defaultIsotope(iso(26).isotopes).A).toBe(56); // iron-56, 91.8 %
    expect(defaultIsotope(iso(26).isotopes, 57).A).toBe(57);
    expect(defaultIsotope(iso(92).isotopes).A).toBe(238);
    expect(defaultIsotope(iso(43).isotopes).A).toBe(97); // technetium: none natural, longest-lived
  });
});

describe("words and numbers", () => {
  it("writes IAEA half-life texts in words", () => {
    expect(halfLifeWords("1.40E10 Y")).toBe("1.40 × 10¹⁰ years");
    expect(halfLifeWords("> 60 ns")).toBe("more than 60 ns");
    expect(halfLifeWords("≈ 5 ms")).toBe("about 5 ms");
    expect(halfLifeWords("37.230 m")).toBe("37.230 minutes");
    expect(halfLifeWords("5.3 MeV")).toBe("level width 5.3 MeV");
    expect(halfLifeWords("?")).toBe("?");
  });

  it("writes scientific notation with NIST-style uncertainties", () => {
    expect(sci(1.1e-9, 4e-10)).toBe("1.1(4) × 10⁻⁹");
    expect(sci(2.48668576679e11)).toBe("2.49 × 10¹¹");
    expect(sci(100)).toBe("100");
    expect(sci(8.3557, 0.0001)).toBe("8.3557(1)");
  });

  it("removes floating-point noise but keeps the source's digits", () => {
    const mass = { value: 55.934935537, unc: 2.8699999999999996e-7, unit: "u", source: "iaea_livechart" };
    expect(tidy(mass).unc).toBe(2.87e-7);
    expect(tidy(mass).value).toBe(55.934935537);
    expect(tidy({ value: 1, unit: "u", source: "x" })).not.toHaveProperty("unc");
  });

  it("labels isotopes, spin and parity, and picks a readable time unit", () => {
    expect(isotopeLabel(229, "Th")).toBe("²²⁹Th");
    expect(jpText("0+")).toBe("0⁺");
    expect(jpText("(5/2+,7/2-)")).toBe("(5/2⁺, 7/2⁻)");
    expect(naturalUnit(3600)).toBe("s");
    expect(naturalUnit(30 * 86400)).toBe("d");
    expect(naturalUnit(1e12)).toBe("y");
  });

  it("gives the thorium-229 isomer energy from its frequency: about 8.36 eV", () => {
    expect(photonEnergyEv(2020407384335000)).toBeCloseTo(8.3557, 3);
  });
});
