// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, SourcesFile } from "../data/types";
import { tileText } from "./tileText";

const read = <T>(p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), "utf8")) as T;
const index = read<IndexFile>("index.json");
const sources = read<SourcesFile>("sources.json").sources;
const el = (sym: string) => {
  const e = index.elements.find((x) => x.symbol === sym);
  if (!e) throw new Error(sym);
  return tileText(e, sources);
};

describe("tile text (SPEC §7.1)", () => {
  it("caesium: every reference-table field plus the hyperfine slot", () => {
    const t = el("Cs");
    expect(t.label).toBe("Caesium, atomic number 55, alkali metal.");
    expect(t.weight.text).toBe("132.9055");
    expect(t.ie.text).toBe("375.7");
    expect(t.en.text).toBe("0.79");
    expect(t.ox.states).toEqual([
      { text: "+1", common: true },
      { text: "\u22121", common: false },
    ]);
    expect(t.config.core).toBe("Xe");
    expect(t.hfs.missing).toBe(false);
    expect(t.hfs.isotope).toBe(133);
    expect(t.hfs.title).toContain("(exact)");
  });

  it("shows the mass number in parentheses when there is no standard atomic weight", () => {
    expect(el("Tc").weight.text).toBe("(97)");
    expect(el("Og").weight.text).toBe("(294)");
  });

  it("uses IUPAC's single value for interval elements", () => {
    expect(el("H").weight.text).toBe("1.008");
    expect(el("H").weight.title).toContain("[1.00784, 1.00811]");
  });

  it("marks NIST's semi-empirical and theoretical ionization energies as NIST does", () => {
    expect(el("Md").ie.text).toMatch(/^\[.*\]$/);
    expect(el("H").ie.text).toMatch(/^\(.*\)$/);
    expect(el("Og").ie).toMatchObject({ text: "pred. only", missing: true });
  });

  it("renders the hyperfine Missing states correctly", () => {
    expect(el("Ce").hfs.text).toBe("no hfs (I = 0)");
    expect(el("He").hfs.text).toBe("no hfs (J = 0)");
    expect(el("H").hfs.text).toBe("hfs n/m");
    expect(el("Tc").hfs.text).toBe("hfs: no stable isotope");
    for (const sym of ["Ce", "He", "H", "Tc"]) expect(el(sym).hfs.title.length).toBeGreaterThan(30);
  });

  it("lists oxidation states highest first with the common ones marked", () => {
    const fe = el("Fe").ox.states;
    expect(fe.map((s) => s.text)).toEqual(["+7", "+6", "+5", "+4", "+3", "+2", "+1", "\u22121", "\u22122", "\u22124"]);
    expect(fe.filter((s) => s.common).map((s) => s.text)).toEqual(["+3", "+2"]);
  });

  it("flags anomalies and predictions on the configuration", () => {
    expect(el("Cr").config.anomalous).toBe(true);
    expect(el("Cr").config.title).toContain("[Ar] 3d4 4s2");
    expect(el("Og").config.predicted).toBe(true);
    expect(el("Fe").config.anomalous).toBe(false);
  });

  it("never renders a bare dash or a zero for missing data", () => {
    for (const e of index.elements) {
      const t = tileText(e, sources);
      for (const f of [t.weight, t.ie, t.en, t.hfs]) {
        expect(f.text, `${e.symbol}`).not.toMatch(/^[-–—]?$/);
        if (f.missing) expect(f.text).not.toBe("0");
      }
      expect(t.description).not.toContain("undefined");
    }
  });
});
