// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { EMPTY_ROUTE, formatHash, parseHash } from "./route";

const table = { layout: "standard18", group3: "lu", overlay: null } as const;

describe("parseHash", () => {
  it("reads the table", () => {
    expect(parseHash("")).toEqual(EMPTY_ROUTE);
    expect(parseHash("#/")).toEqual(EMPTY_ROUTE);
  });

  it("reads an element and a panel (SPEC §9.4)", () => {
    expect(parseHash("#/Cs")).toMatchObject({ element: "Cs", panel: null });
    expect(parseHash("#/Cs/amo")).toMatchObject({ element: "Cs", panel: "amo" });
  });

  it("normalises symbol capitalisation", () => {
    expect(parseHash("#/cs/AMO")).toMatchObject({ element: "Cs", panel: "amo" });
    expect(parseHash("#/OG")).toMatchObject({ element: "Og" });
  });

  it("reads table state", () => {
    expect(parseHash("#/?layout=janet&g3=la&trend=ie1&view=heat")).toEqual({
      ...EMPTY_ROUTE,
      layout: "janet",
      group3: "la",
      trend: "ie1",
      view: "heat",
    });
    expect(parseHash("#/Fe/orbitals?layout=adomah")).toMatchObject({ element: "Fe", panel: "orbitals", layout: "adomah" });
  });

  it("drops what it does not understand instead of failing", () => {
    expect(parseHash("#/Cs/nope")).toMatchObject({ element: "Cs", panel: null });
    expect(parseHash("#/12345")).toEqual(EMPTY_ROUTE);
    expect(parseHash("#/?layout=spiral&g3=sc&trend=<b>")).toEqual(EMPTY_ROUTE);
    expect(parseHash("#/%E0%A4%A")).toEqual(EMPTY_ROUTE);
    expect(parseHash("#/?trend=ie1&view=pie")).toMatchObject({ trend: "ie1", view: null });
  });
});

describe("formatHash", () => {
  it("writes only what differs from the defaults", () => {
    expect(formatHash(null, null, table)).toBe("#/");
    expect(formatHash("Cs", "amo", table)).toBe("#/Cs/amo");
    expect(formatHash("Cs", null, table)).toBe("#/Cs");
    expect(formatHash(null, null, { layout: "janet", group3: "la", overlay: { kind: "heat", id: "ie1" } })).toBe(
      "#/?layout=janet&g3=la&trend=ie1&view=heat",
    );
  });

  it("round-trips", () => {
    for (const hash of ["#/", "#/Fe/orbitals", "#/U/nucleus?layout=long32", "#/?g3=la&trend=madelung&view=map"]) {
      const r = parseHash(hash);
      const back = formatHash(r.element, r.panel, {
        layout: r.layout ?? "standard18",
        group3: r.group3 ?? "lu",
        overlay: r.trend && r.view ? { id: r.trend, kind: r.view } : null,
      });
      expect(back).toBe(hash);
    }
  });
});
