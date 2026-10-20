// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describe, expect, it } from "vitest";
import { TILE_MIN_PX, clampTileWidth, fitTileWidth, tileAspect } from "./zoom";

const m = { rem: 16, gap: 3, labelTrack: 24 };

describe("fit to width", () => {
  it("shares the width among the tile columns", () => {
    // 18 tiles + 1 label column, 18 gaps: (1200 − 24 − 54) / 18 = 62.33
    expect(fitTileWidth(1200, { tileCols: 18, labelCols: 1 }, m)).toBe(62.25);
  });

  it("never exceeds full size and never drops below the WCAG target minimum", () => {
    expect(fitTileWidth(10_000, { tileCols: 18, labelCols: 1 }, m)).toBe(144);
    expect(fitTileWidth(360, { tileCols: 32, labelCols: 1 }, m)).toBe(TILE_MIN_PX);
  });
});

describe("zoom limits", () => {
  it("clamps manual zoom between 24 px and 1.5 × full size", () => {
    expect(clampTileWidth(5, m)).toBe(24);
    expect(clampTileWidth(1000, m)).toBe(216);
    expect(clampTileWidth(100, m)).toBe(100);
  });

  it("switches to the reference proportions once every field shows", () => {
    expect(tileAspect(60)).toBe(1.2);
    expect(tileAspect(144)).toBe(1.08);
  });
});
