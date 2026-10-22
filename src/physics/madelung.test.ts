// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile } from "../data/types";
import { anomalyKind, aufbauConfiguration, isAnomalous, madelungOrder, parseConfiguration, notation } from "./madelung";

const index = JSON.parse(readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8")) as IndexFile;

const EXPECTED = "Cr Cu Nb Mo Ru Rh Pd Ag La Ce Gd Pt Au Ac Th Pa U Np Cm Lr".split(" ");

describe("Madelung generator", () => {
  it("orders subshells by n + l, then n", () => {
    const names = madelungOrder()
      .slice(0, 12)
      .map(([n, l]) => `${n}${"spdf"[l]}`);
    expect(names).toEqual(["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s"]);
  });

  it("writes noble-gas notation ordered by n then l", () => {
    expect(aufbauConfiguration(1)).toBe("1s1");
    expect(aufbauConfiguration(26)).toBe("[Ar] 3d6 4s2");
    expect(aufbauConfiguration(78)).toBe("[Xe] 4f14 5d8 6s2");
    expect(aufbauConfiguration(118)).toBe("[Rn] 5f14 6d10 7s2 7p6");
    expect(notation(parseConfiguration("[Xe] 4f14 5d9 6s1"))).toBe("[Xe] 4f14 5d9 6s1");
  });

  it("agrees with the pipeline's Aufbau strings for all 118 elements", () => {
    for (const e of index.elements) expect(aufbauConfiguration(e.Z), e.symbol).toBe(e.configuration.aufbau);
  });

  it("flags exactly the 20 anomalous elements against the NIST ground configurations", () => {
    const flagged = index.elements
      .filter((e) => e.configuration.source === "nist_gsie" && isAnomalous(e.Z, e.configuration.measured))
      .map((e) => e.symbol);
    expect(flagged).toEqual(EXPECTED);
  });

  it("classifies every anomaly by what moved where (SPEC §10.5)", () => {
    const kinds: Record<string, string[]> = {};
    for (const e of index.elements) {
      const k = anomalyKind(e.Z, e.configuration.measured);
      if (k) (kinds[k] ??= []).push(e.symbol);
    }
    expect(kinds).toEqual({
      "half-or-filled": ["Cr", "Cu", "Mo", "Pd", "Ag", "Au"],
      "d-s": ["Nb", "Ru", "Rh", "Pt"],
      "f-to-d": ["La", "Ce", "Gd", "Ac", "Th", "Pa", "U", "Np", "Cm"],
      relativistic: ["Lr"],
    });
  });
});
