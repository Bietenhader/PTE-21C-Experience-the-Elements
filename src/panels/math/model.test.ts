// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementIndexEntry, IndexFile } from "../../data/types";
import {
  hydrogenicEnergy,
  hundFor,
  landeFor,
  outermost,
  POINT_NUCLEUS_LIMIT,
  RYDBERG_EV,
  relativityFor,
  slaterFor,
  valenceElectrons,
} from "./model";

const index = JSON.parse(readFileSync(new URL("../../../public/data/index.json", import.meta.url), "utf8")) as IndexFile;
const el = (symbol: string) => index.elements.find((e) => e.symbol === symbol) as ElementIndexEntry;

describe("mathematical panel model", () => {
  it("lists each valence electron's quantum numbers", () => {
    const fe = valenceElectrons(el("Fe"));
    expect(fe.map((s) => [s.n, s.l, s.electrons.length, s.closed])).toEqual([
      [3, 2, 6, false],
      [4, 0, 2, true],
    ]);
    expect(fe[0]?.electrons.filter((x) => x.ms > 0)).toHaveLength(5);
  });

  it("finds the electron the first ionization removes", () => {
    expect(outermost(el("Fe"))).toEqual({ n: 4, l: 0 });
    expect(outermost(el("Pd"))).toEqual({ n: 4, l: 2 }); // [Kr] 4d10: no 5s electron
    expect(outermost(el("Gd"))).toEqual({ n: 6, l: 0 });
  });

  it("works Slater's rules for the outermost electron: sodium's 3s", () => {
    const na = slaterFor(el("Na"));
    expect(na.zeff).toBeCloseTo(2.2, 10);
    // R·Z_eff²/n² = 13.6 × 2.2² / 9 ≈ 7.3 eV against the measured 5.14 eV
    expect(hydrogenicEnergy(na.zeff, na.n)).toBeCloseTo(7.32, 2);
    expect(RYDBERG_EV).toBeCloseTo(13.6057, 4);
  });

  it("Hund's rules for iron give ⁵D₄, as NIST measures", () => {
    const h = hundFor(el("Fe"));
    expect([h.S, h.L, h.J]).toEqual([2, 2, 4]);
    expect(landeFor(h.S, h.L, h.J)).toBeCloseTo(1.50116, 5);
  });

  it("relativity: gold's 1s electron at 0.58 c, γ ≈ 1.22, and the table ends at Z = 1/α for a point nucleus", () => {
    const au = relativityFor(79);
    expect(au.beta).toBeCloseTo(0.5765, 4);
    expect(au.gamma).toBeCloseTo(1.224, 3);
    expect(au.contraction).toBeCloseTo(0.817, 3);
    expect(POINT_NUCLEUS_LIMIT).toBeCloseTo(137.036, 3);
    expect(relativityFor(118).beta).toBeLessThan(1);
  });
});
