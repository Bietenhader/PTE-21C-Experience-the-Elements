// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Zoom arithmetic for the table (SPEC §7.4). Zooming changes the tile width rather than scaling
// the picture, so the tiles keep disclosing fields as they grow (SPEC §7.1) and text stays sharp.

/** WCAG 2.2 SC 2.5.8: targets at least 24 × 24 CSS px. */
export const TILE_MIN_PX = 24;
/** Full size: every field of the reference table (9rem). */
export const TILE_FULL_REM = 9;
/** Largest zoom: one and a half times full size. */
export const TILE_MAX_REM = 13.5;
export const ZOOM_STEP = 1.25;

export interface Tracks {
  tileCols: number;
  labelCols: number;
}

export interface Metrics {
  /** Root font size in px (1rem). */
  rem: number;
  gap: number;
  labelTrack: number;
}

export function clampTileWidth(w: number, m: Metrics): number {
  return Math.min(TILE_MAX_REM * m.rem, Math.max(TILE_MIN_PX, w));
}

/** Widest tile that fits `available` px across, never above full size or below the target minimum. */
export function fitTileWidth(available: number, t: Tracks, m: Metrics): number {
  const tracks = t.tileCols + t.labelCols;
  const w = (available - t.labelCols * m.labelTrack - (tracks - 1) * m.gap) / t.tileCols;
  // Exactly the CSS fallback in PeriodicTable.module.css (--fit-w), so nothing moves when the
  // measured width takes over from it.
  return Math.min(TILE_FULL_REM * m.rem, Math.max(TILE_MIN_PX, w));
}

/** Height ÷ width: small tiles need room for the symbol; full-size ones match the reference. */
export function tileAspect(w: number): number {
  return w >= 110 ? 1.08 : 1.2;
}
