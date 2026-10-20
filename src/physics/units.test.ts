// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { CODATA, EV_IN_KJ_PER_MOL } from "./constants";
import { celsiusToKelvin, convertEnergy, convertTemperature, evToKjPerMol, kelvinToCelsius, kjPerMolToEv } from "./units";

describe("unit conversions", () => {
  it("uses the exact CODATA factor e·N_A", () => {
    expect(EV_IN_KJ_PER_MOL).toBeCloseTo((CODATA.e.value * CODATA.NA.value) / 1000, 12);
    expect(CODATA.e.exact && CODATA.NA.exact).toBe(true);
    expect(EV_IN_KJ_PER_MOL).toBeCloseTo(96.485332, 6);
  });

  it("round-trips kJ/mol ↔ eV", () => {
    for (const ev of [3.89390572743, 13.598434599702, 24.587389011]) {
      expect(kjPerMolToEv(evToKjPerMol(ev))).toBeCloseTo(ev, 12);
    }
    expect(evToKjPerMol(3.89390572743)).toBeCloseTo(375.70, 2); // Cs IE₁
  });

  it("round-trips K ↔ °C", () => {
    expect(kelvinToCelsius(273.15)).toBe(0);
    expect(celsiusToKelvin(kelvinToCelsius(1811))).toBeCloseTo(1811, 12);
  });

  it("marks the SI defining constants exact", () => {
    expect(CODATA.deltaNuCs).toMatchObject({ value: 9192631770, exact: true, unc: 0 });
    expect(CODATA.alpha.exact).toBe(false);
  });

  it("converts for display in the chosen unit", () => {
    expect(convertEnergy(375.7, "kJ/mol", "kJ/mol")).toBe(375.7);
    expect(convertEnergy(375.7, "kJ/mol", "eV")).toBeCloseTo(3.8939, 4);
    expect(convertEnergy(0.4715, "eV", "kJ/mol")).toBeCloseTo(45.49, 2); // Cs electron affinity
    expect(convertTemperature(1811, "K")).toBe(1811);
    expect(convertTemperature(1811, "°C")).toBeCloseTo(1537.85, 10);
  });
});
