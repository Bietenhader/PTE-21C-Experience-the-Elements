// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile } from "../data/types";
import { CODATA } from "./constants";
import { parseConfiguration } from "./madelung";
import { fillSubshell, half, hund, landeLS, parity, termParts } from "./terms";

const index = JSON.parse(readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8")) as IndexFile;
const term = (cfg: string) => {
  const h = hund(parseConfiguration(cfg));
  const t = termParts(h.S, h.L, h.J, h.parity === "odd");
  return `${t.multiplicity}${t.letter}${t.odd ? "*" : ""}${t.J}`;
};

describe("Hund's rules and LS terms (SPEC §10.5)", () => {
  it("fills one orbital per electron with spin up first, from m_l = +l", () => {
    expect(fillSubshell(3, 2, 6).map((e) => [e.ml, e.ms])).toEqual([
      [2, 0.5],
      [1, 0.5],
      [0, 0.5],
      [-1, 0.5],
      [-2, 0.5],
      [2, -0.5],
    ]);
  });

  it("gives the textbook ground terms", () => {
    expect(term("1s1")).toBe("2S1/2");
    expect(term("[He] 2s2 2p2")).toBe("3P0"); // carbon: less than half full
    expect(term("[He] 2s2 2p3")).toBe("4S*3/2"); // nitrogen: half full, and three p electrons make it odd
    expect(term("[He] 2s2 2p4")).toBe("3P2"); // oxygen: more than half full
    expect(term("[Ar] 3d6 4s2")).toBe("5D4"); // iron
    expect(term("[Xe] 4f7 5d1 6s2")).toBe("9D*2"); // gadolinium: several open subshells, and it still works
    expect(term("[Ne] 3s2 3p6")).toBe("1S0");
    // several open subshells: the subshell with the largest L sets the third rule
    expect(term("[Kr] 4d7 5s1")).toBe("5F5"); // ruthenium: 4d more than half full
    expect(term("[Xe] 4f14 5d9 6s1")).toBe("3D3"); // platinum
    expect(term("[Rn] 5f3 6d1 7s2")).toBe("5L*6"); // uranium: 5f less than half full
    expect(term("[Ar] 3d5 4s1")).toBe("7S3"); // chromium: L = 0
  });

  it("agrees with NIST for every element in LS coupling but cerium (and the predicted superheavies)", () => {
    const disagree: string[] = [];
    let checked = 0;
    for (const e of index.elements) {
      const g = e.groundTerm;
      if (!("S" in g) || g.coupling !== "LS" || g.flag === "predicted") continue;
      const h = hund(parseConfiguration(e.configuration.measured));
      checked++;
      const nist = `${Math.round(2 * (g.S ?? 0) + 1)}${g.L}${g.J}`;
      const ours = `${Math.round(2 * h.S + 1)}${h.L}${h.J}`;
      if (nist !== ours) disagree.push(e.symbol);
    }
    expect(checked).toBeGreaterThan(90);
    // Hund's rules are a guide, not a law: cerium's two open subshells (4f 5d) pair into a singlet.
    expect(disagree).toEqual(["Ce"]);
  });

  it("computes the parity from Σl", () => {
    expect(parity(parseConfiguration("[Xe] 4f7 5d1 6s2"))).toBe("odd");
    expect(parity(parseConfiguration("[Ar] 3d6 4s2"))).toBe("even");
  });

  it("Landé g in LS coupling: iron's ⁵D₄ near NIST's 1.5002", () => {
    const g = landeLS(2, 2, 4, Math.abs(CODATA.ge.value));
    expect(g).toBeCloseTo(1.50116, 5);
    expect(landeLS(0.5, 0, 0.5, 2)).toBe(2);
    expect(landeLS(1, 1, 0, 2)).toBeNull();
  });

  it("writes half-integers as fractions", () => {
    expect([half(0.5), half(4), half(3.5)]).toEqual(["1/2", "4", "7/2"]);
  });
});
