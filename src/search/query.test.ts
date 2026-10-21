// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile } from "../data/types";
import { search } from "./query";

const elements = (
  JSON.parse(readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8")) as IndexFile
).elements;
const units = { energy: "kJ/mol", temperature: "K" } as const;
const find = (q: string, u: { energy: "kJ/mol" | "eV"; temperature: "K" | "°C" } = units) => search(elements, q, u);
const symbols = (zs: number[]) => zs.map((z) => elements[z - 1]?.symbol);

describe("search", () => {
  it("finds by symbol, name, alias and atomic number", () => {
    expect(symbols(find("Cs").matches)[0]).toBe("Cs");
    expect(symbols(find("fe").matches)[0]).toBe("Fe");
    expect(symbols(find("iron").matches)).toEqual(["Fe"]);
    expect(symbols(find("cesium").matches)[0]).toBe("Cs");
    expect(symbols(find("26").matches)).toEqual(["Fe"]);
    expect(find("119").matches).toEqual([]);
  });

  it("ranks the exact symbol before names that merely start with it", () => {
    const c = symbols(find("c").matches);
    expect(c[0]).toBe("C");
    expect(c).toContain("Ca");
  });

  it("compares numeric fields in the unit shown", () => {
    const high = symbols(find("ionization > 2000").matches);
    expect(high).toEqual(["He", "Ne"]);
    expect(symbols(find("ie > 20 eV").matches)).toEqual(["He", "Ne"]);
    expect(symbols(find("ie > 20", { energy: "eV", temperature: "K" }).matches)).toEqual(["He", "Ne"]);
    const liquidish = symbols(find("melting < 0 °C").matches);
    expect(liquidish).toContain("Hg");
    expect(liquidish).not.toContain("Ga");
    expect(find("period 1").matches).toEqual([1, 2]);
    expect(find("group = 18").matches).toHaveLength(7);
  });

  it("matches keywords and categories", () => {
    expect(find("noble gases").matches).toHaveLength(6);
    expect(find("radioactive").matches).toContain(43);
    expect(symbols(find("liquid").matches).sort()).toEqual(["Br", "Hg"]);
    expect(find("f-block").matches.length).toBeGreaterThanOrEqual(28);
    expect(find("anomalous").matches).toContain(79);
  });

  it("finds the elements behind the AMO and biology flags", () => {
    const cooled = find("laser-cooled").matches;
    expect(cooled).toEqual(expect.arrayContaining([3, 11, 19, 37, 55, 38, 70]));
    expect(find("laser cooled").matches).toEqual(cooled);
    expect(find("clock").matches).toEqual(expect.arrayContaining([13, 38, 55, 70, 90]));
    expect(find("essential").matches).toEqual(expect.arrayContaining([1, 6, 7, 8, 15, 26, 53]));
  });

  it("tells the user when nothing matches", () => {
    expect(find("unobtainium").message).toMatch(/Nothing matches/);
    expect(find("").message).toBe("");
  });

  it("does not compare elements without a value, and says how many", () => {
    expect(find("density > 0").message).toMatch(/without a value were not compared/);
  });
});
