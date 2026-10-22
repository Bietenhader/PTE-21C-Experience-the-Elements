// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ElementDetailFile, ElementIndexEntry, IndexFile } from "../../data/types";
import { A0_PM, subshells } from "./model";

const index = JSON.parse(readFileSync(new URL("../../../public/data/index.json", import.meta.url), "utf8")) as IndexFile;
const detail = (z: number) =>
  JSON.parse(readFileSync(new URL(`../../../public/data/elements/${z}.json`, import.meta.url), "utf8")) as ElementDetailFile;
const el = (z: number) => index.elements[z - 1] as ElementIndexEntry;

describe("orbitals model", () => {
  it("iron: seven subshells, ordered by SRD 141 energy, 3d and 4s marked valence", () => {
    const s = subshells(el(26), detail(26));
    expect(s.map((x) => x.label)).toEqual(["1s", "2s", "2p", "3s", "3p", "3d", "4s"]);
    expect(s.filter((x) => x.valence).map((x) => x.label).sort()).toEqual(["3d", "4s"]);
    expect(s.find((x) => x.label === "4s")?.zeff).toMatchObject({ value: 5.434, method: "clementi" });
    expect(s.reduce((a, x) => a + x.occupancy, 0)).toBe(26);
  });

  it("hydrogen: Slater gives the exact Z = 1, so ⟨r⟩ = 1.5 a₀", () => {
    const [h] = subshells(el(1), detail(1));
    expect(h?.zeff).toMatchObject({ value: 1, method: "slater" });
    expect(h?.meanPm).toBeCloseTo(1.5 * A0_PM, 9);
    expect(A0_PM).toBeCloseTo(52.9177, 3);
  });

  it("gadolinium: the 5d electron that Clementi–Raimondi's configuration lacks falls back to Slater", () => {
    const s = subshells(el(64), detail(64));
    expect(s.find((x) => x.label === "5d")?.zeff.method).toBe("slater");
    expect(s.find((x) => x.label === "4f")?.zeff.method).toBe("clementi");
    expect(s).toHaveLength(14); // the eleven of the [Xe] core, 4f, 5d and 6s
  });

  it("oganesson: nineteen predicted subshells, all by Slater's rules, in Madelung order", () => {
    const s = subshells(el(118), detail(118));
    expect(s).toHaveLength(19);
    expect(s.every((x) => x.zeff.method === "slater" && x.zeff.value > 0)).toBe(true);
    expect(s.at(-1)?.label).toBe("7p");
  });

  it("covers every element without throwing", () => {
    for (let z = 1; z <= 118; z++) {
      const s = subshells(el(z), detail(z));
      expect(s.reduce((a, x) => a + x.occupancy, 0), `Z=${z}`).toBe(z);
      for (const x of s) expect(x.meanPm, `Z=${z} ${x.label}`).toBeGreaterThan(0);
    }
  });
});
