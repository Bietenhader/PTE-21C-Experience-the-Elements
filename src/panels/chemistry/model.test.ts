// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementDetailFile } from "../../data/types";
import { coordination, coordinationByIon, coordinationText, formulaText, ionLabel, ladderRadii } from "./model";

const detail = (z: number) =>
  JSON.parse(readFileSync(new URL(`../../../public/data/elements/${z}.json`, import.meta.url), "utf8")) as ElementDetailFile;

describe("formulas", () => {
  it("writes atom counts as subscripts", () => {
    expect(formulaText("Fe2(SO4)3")).toBe("Fe₂(SO₄)₃");
    expect(formulaText("Ca5(PO4)3(OH)")).toBe("Ca₅(PO₄)₃(OH)");
    expect(formulaText("H2O")).toBe("H₂O");
    expect(formulaText("UF6")).toBe("UF₆");
  });

  it("leaves coefficients and charges alone", () => {
    expect(formulaText("CuSO4·5H2O")).toBe("CuSO₄·5H₂O");
    expect(formulaText("NpO2⁺")).toBe("NpO₂⁺");
    expect(formulaText("AmO2²⁺")).toBe("AmO₂²⁺");
  });
});

describe("ions and coordination", () => {
  it("labels ions with superscript charges", () => {
    expect(ionLabel("Fe", 3)).toBe("Fe³⁺");
    expect(ionLabel("Na", 1)).toBe("Na⁺");
    expect(ionLabel("O", -2)).toBe("O²⁻");
    expect(ionLabel("Cl", -1)).toBe("Cl⁻");
  });

  it("reads Shannon's Roman numerals and geometry suffixes", () => {
    expect(coordination("VI")).toEqual({ n: 6 });
    expect(coordination("VIII")).toEqual({ n: 8 });
    expect(coordination("IX")).toEqual({ n: 9 });
    expect(coordination("IVSQ")).toEqual({ n: 4, geometry: "square planar" });
    expect(coordinationText("IIIPY")).toBe("3 (pyramidal)");
  });

  it("draws one radius per ion on the ladder, six-coordinate where there is one", () => {
    const fe = detail(26).chemistry;
    expect(fe).toBeDefined();
    const ladder = ladderRadii(fe?.ionicRadii ?? []);
    expect(ladder.map((r) => `${r.charge}${r.spin ?? ""}:${r.coordination}`)).toEqual(["2HS:VI", "2LS:VI", "3HS:VI", "3LS:VI"]);
    expect(ladder.find((r) => r.charge === 3 && r.spin === "HS")?.radius).toMatchObject({ value: 64.5, unit: "pm", source: "shannon1976" });
    expect(coordinationByIon(fe?.ionicRadii ?? []).map((g) => [g.charge, g.spin, g.rows.map((r) => r.coordination)])).toEqual([
      [2, "HS", ["IV", "VI", "VIII"]],
      [2, "LS", ["VI"]],
      [3, "HS", ["IV", "VI", "VIII"]],
      [3, "LS", ["VI"]],
    ]);
  });
});

describe("the chemistry records", () => {
  it("cover every element, with a reason wherever something is missing", () => {
    for (let z = 1; z <= 118; z++) {
      const c = detail(z).chemistry;
      expect(c, `Z = ${z}`).toBeDefined();
      if (!c) continue;
      for (const v of [c.bonding, c.reactivity.air, c.reactivity.water, c.reactivity.acids, c.compounds]) {
        if ("missing" in v) expect(v.reason, `Z = ${z}`).toMatch(/^(not_measured|not_applicable|predicted_only|no_stable_isotope|source_unavailable_at_build)$/);
        else if (!Array.isArray(v)) expect(v.source, `Z = ${z}`).toBeTruthy();
      }
    }
  });
});
