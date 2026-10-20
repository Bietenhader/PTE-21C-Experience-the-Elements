// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IndexFile, TrendsFile } from "../data/types";
import { domain, formatDuration, formatValue, heatValue, scientific, series, significant } from "./values";

const read = <T,>(p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), "utf8")) as T;
const elements = read<IndexFile>("index.json").elements;
const trends = read<TrendsFile>("trends.json");
const heat = (id: string) => {
  const h = trends.heatmaps.find((x) => x.id === id);
  if (!h) throw new Error(id);
  return h;
};
const el = (s: string) => {
  const e = elements.find((x) => x.symbol === s);
  if (!e) throw new Error(s);
  return e;
};
const kj = { energy: "kJ/mol", temperature: "K" } as const;
const ev = { energy: "eV", temperature: "°C" } as const;

describe("heat values", () => {
  it("every heatmap yields a value or a Missing for every element", () => {
    for (const h of trends.heatmaps) {
      for (const units of [kj, ev]) {
        const pts = series(elements, h, units);
        expect(pts).toHaveLength(118);
        expect(domain(pts), h.id).not.toBeNull();
        for (const p of pts) {
          expect(p.v.text.length, `${h.id} Z=${p.Z}`).toBeGreaterThan(0);
          if (p.v.ok) expect(Number.isFinite(p.v.value)).toBe(true);
          else expect(p.v.missing.reason).toBeTruthy();
        }
      }
    }
  });

  it("converts energies and temperatures to the chosen unit", () => {
    const cs = heatValue(el("Cs"), heat("ie1"), kj);
    expect(cs).toMatchObject({ ok: true, unit: "kJ/mol", text: "376" });
    const csEv = heatValue(el("Cs"), heat("ie1"), ev);
    expect(csEv).toMatchObject({ ok: true, unit: "eV", text: "3.89" });
    const fe = heatValue(el("Fe"), heat("melting-point"), ev);
    expect(fe.ok && fe.value).toBeCloseTo(1811 - 273.15, 6);
    const ea = heatValue(el("Cl"), heat("electron-affinity"), kj);
    expect(ea).toMatchObject({ ok: true, unit: "kJ/mol" });
  });

  it("keeps NIST's markers for semi-empirical and theoretical values", () => {
    const flagged = elements.map((e) => heatValue(e, heat("ie1"), kj)).filter((v) => v.ok && v.flag && v.flag !== "measured");
    expect(flagged.length).toBeGreaterThan(0);
    for (const v of flagged) expect(v.text).toMatch(/^[[(].*[\])]$/);
  });

  it("renders Missing with its reason, never as zero", () => {
    const og = heatValue(el("Og"), heat("density"), kj);
    expect(og).toMatchObject({ ok: false, text: "n/m" });
    expect(og.long).toMatch(/^Density: Not measured/);
    const fe = heatValue(el("Fe"), heat("longest-half-life"), kj);
    expect(fe).toMatchObject({ ok: false, text: "n/a" });
  });

  it("computes the hydrogenic 1s speed", () => {
    const au = heatValue(el("Au"), heat("z-alpha"), kj);
    expect(au).toMatchObject({ ok: true, text: "0.576", flag: "calculated" });
  });

  it("uses the conventional value for interval atomic weights", () => {
    const h = heatValue(el("H"), heat("atomic-weight"), kj);
    expect(h).toMatchObject({ ok: true, text: "1.01" });
  });
});

describe("number formatting", () => {
  it("formats durations in readable units", () => {
    expect(formatDuration(0.00058)).toBe("580 µs");
    expect(formatDuration(0.0058)).toBe("5.8 ms");
    expect(formatDuration(3.8235 * 86400)).toBe("3.82 d");
    expect(formatDuration(1.4099634525447706e17)).toBe("4.47 Ga");
    expect(formatDuration(6.3e26)).toBe("2.0·10¹⁹ a");
  });

  it("formats significant figures and exponents", () => {
    expect(significant(0.0072973525643, 3)).toBe("0.0073");
    expect(significant(-38.83, 3)).toBe("−38.8");
    expect(significant(1811, 3)).toBe("1810");
    expect(scientific(8.988e-5, 2)).toBe("9.0·10⁻⁵");
    expect(formatValue(8.988e-5, "g/cm³")).toBe("9.0·10⁻⁵");
    expect(formatValue(19.282, "g/cm³")).toBe("19.3");
    expect(formatValue(-38.83, "°C")).toBe("−39");
    expect(formatValue(4, "")).toBe("4");
  });
});
