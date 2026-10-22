// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import type { CrystalStructure } from "../../data/types";
import { atomsInCell, cellEdges, cellModel, latticeVectors, share, structureType } from "./cell";

const q = (value: number, unit: "pm" | "°" = "pm") => ({ value, unit, source: "cod" }) as const;

function make(pearson: string, spaceGroupNumber: number, structure: string, a: number, c?: number, gamma = 90): CrystalStructure {
  return {
    structure,
    lattice: gamma === 120 ? "hexagonal" : c ? "tetragonal" : "cubic",
    spaceGroup: "",
    spaceGroupNumber,
    pearson,
    a: q(a),
    ...(c ? { c: q(c) } : {}),
    alpha: q(90, "°"),
    beta: q(90, "°"),
    gamma: q(gamma, "°"),
    temperature: q(298, "pm") as never,
    codId: 1,
    reference: "",
    source: "cod",
  };
}

function model(c: CrystalStructure) {
  const m = cellModel(c);
  if (!m) throw new Error(`no drawing for ${c.pearson}`);
  return m;
}

describe("unit cells", () => {
  it("bcc iron: 9 atoms drawn, 2 per cell, nearest neighbours a√3/2 apart", () => {
    const m = model(make("cI2", 229, "body-centred cubic (bcc)", 286.54));
    expect(m.type.id).toBe("bcc");
    expect(m.atoms).toHaveLength(9);
    expect(m.perCell).toBeCloseTo(2, 12);
    expect(m.nearest).toBeCloseTo((286.54 * Math.sqrt(3)) / 2, 9);
  });

  it("fcc copper: 14 atoms drawn, 4 per cell, nearest neighbours a/√2 apart", () => {
    const m = model(make("cF4", 225, "face-centred cubic (fcc)", 361.5));
    expect(m.atoms).toHaveLength(14);
    expect(m.perCell).toBeCloseTo(4, 12);
    expect(m.nearest).toBeCloseTo(361.5 / Math.SQRT2, 9);
  });

  it("hcp magnesium: 9 atoms drawn on the hexagonal prism cell, 2 per cell", () => {
    const m = model(make("hP2", 194, "hexagonal close-packed (hcp)", 320.93, 521.03, 120));
    expect(m.type.id).toBe("hcp");
    expect(m.atoms).toHaveLength(9);
    expect(m.perCell).toBeCloseTo(2, 12);
    expect(m.nearest).toBeCloseTo(Math.min(320.93, Math.sqrt(320.93 ** 2 / 3 + 521.03 ** 2 / 4)), 9);
  });

  it("diamond-cubic silicon: 18 atoms drawn, 8 per cell, bonds a√3/4 long", () => {
    const m = model(make("cF8", 227, "diamond cubic", 543.0941));
    expect(m.atoms).toHaveLength(18);
    expect(m.perCell).toBeCloseTo(8, 12);
    expect(m.nearest).toBeCloseTo((543.0941 * Math.sqrt(3)) / 4, 9);
  });

  it("graphite: 4 per cell, the in-layer bond a/√3", () => {
    const m = model(make("hP4", 194, "hexagonal layered (graphite)", 246.4, 671.1, 120));
    expect(m.type.id).toBe("graphite");
    expect(m.perCell).toBeCloseTo(4, 12);
    expect(m.nearest).toBeCloseTo(246.4 / Math.sqrt(3), 9);
  });

  it("β-tin, dhcp and α-mercury count their atoms right", () => {
    expect(model(make("tI4", 141, "body-centred tetragonal (β-tin type)", 583.1, 318.1)).perCell).toBeCloseTo(4, 12);
    expect(model(make("hP4", 194, "double hexagonal close-packed (dhcp)", 377, 1215.9, 120)).perCell).toBeCloseTo(4, 12);
    expect(model(make("hR1", 166, "rhombohedral (α-mercury type)", 345.8, 668.4, 120)).perCell).toBeCloseTo(3, 12);
  });

  it("structures without a drawing give null, among them molecular hydrogen", () => {
    expect(structureType({ pearson: "hP4", spaceGroupNumber: 194, structure: "hexagonal close-packed molecular crystal" })).toBeNull();
    expect(structureType({ pearson: "oF128", spaceGroupNumber: 70, structure: "orthorhombic (S8 rings)" })).toBeNull();
  });

  it("geometry helpers", () => {
    const [a, b, c] = latticeVectors(1, 1, 2, 90, 90, 120);
    expect(a).toEqual([1, 0, 0]);
    expect(b[0]).toBeCloseTo(-0.5, 12);
    expect(b[1]).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(c[2]).toBeCloseTo(2, 12);
    expect(cellEdges()).toHaveLength(12);
    expect(atomsInCell([[0, 0, 0]])).toHaveLength(8);
    expect(share([0, 0, 0])).toBe(1 / 8);
    expect(share([0.5, 0.5, 0])).toBe(1 / 2);
    expect(share([0.25, 0.25, 0.25])).toBe(1);
  });
});
