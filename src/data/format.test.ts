// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { NNBSP, concise, formatQuantity, groupDigits, signed, tileNumber } from "./format";

const g = (s: string) => s.replaceAll(" ", NNBSP);

describe("NIST concise notation", () => {
  it("formats the golden hydrogen hyperfine value", () => {
    expect(concise(1420405751.768, 0.002)).toBe(g("1 420 405 751.768(2)"));
  });
  it("keeps the uncertainty digits of the source", () => {
    expect(concise(55.845, 0.002)).toBe("55.845(2)");
    expect(concise(4.002602, 0.000002)).toBe(g("4.002 602(2)"));
    expect(concise(1312.0494787094, 1.2e-9)).toBe(g("1312.049 478 709 4(12)"));
    expect(concise(207.2, 0.1)).toBe("207.2(1)");
  });
  it("groups an exact value without parentheses", () => {
    expect(concise(9192631770, 0)).toBe(g("9 192 631 770"));
    expect(formatQuantity({ value: 9192631770, unc: 0, unit: "Hz", source: "si_brochure" })).toBe(
      `${g("9 192 631 770")} Hz (exact)`,
    );
  });
  it("leaves a value without uncertainty as given", () => {
    expect(concise(12.011)).toBe("12.011");
  });
  it("handles integer-scale uncertainties", () => {
    expect(concise(1234, 16)).toBe("1234(16)");
    // the thorium-229 nuclear clock frequency: powers of ten once the uncertainty is in the thousands
    expect(concise(2020407384335000, 2000)).toBe(g("2.020 407 384 335(2) × 10¹⁵"));
  });
});

describe("digit grouping", () => {
  it("groups both sides in threes from five digits on", () => {
    expect(groupDigits("6834682610.9043126")).toBe(g("6 834 682 610.904 312 6"));
    expect(groupDigits("1312.0")).toBe("1312.0");
    expect(groupDigits("96485.3")).toBe(g("96 485.3"));
  });
});

describe("tile numbers", () => {
  it("trims trailing zeros and uses a real minus sign", () => {
    expect(tileNumber(4.002602, 4)).toBe("4.0026");
    expect(tileNumber(1.008, 4)).toBe("1.008");
    expect(tileNumber(375.70389, 1)).toBe("375.7");
    expect(tileNumber(-2, 1)).toBe("−2");
    expect(signed(3)).toBe("+3");
    expect(signed(-2)).toBe("−2");
    expect(signed(0)).toBe("0");
  });
});
