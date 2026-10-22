// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Colour from wavelength (SPEC §11.6): CIE 1931 2° colour-matching functions → XYZ → linear sRGB →
// the sRGB transfer curve. The matching functions are data (public/data/cie1931.json, from the
// pipeline) and are passed in; the sRGB matrix is derived here from the primaries and white point
// that define sRGB (IEC 61966-2-1), so no colour constant is typed by hand beyond that definition.
// Colours outside the sRGB gamut are desaturated toward white, never clipped to black.

export interface CmfTable {
  /** First wavelength, nm. */
  start: number;
  /** Spacing, nm. */
  step: number;
  x: readonly number[];
  y: readonly number[];
  z: readonly number[];
}

export type XYZ = readonly [number, number, number];
export type RGB = readonly [number, number, number];

/** The sRGB definition: chromaticities of the red, green and blue primaries and of the D65 white. */
const SRGB = {
  r: [0.64, 0.33],
  g: [0.3, 0.6],
  b: [0.15, 0.06],
  white: [0.3127, 0.329],
} as const;

type M3 = [[number, number, number], [number, number, number], [number, number, number]];

function invert(m: M3): M3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

const xyz = ([x, y]: readonly [number, number]): [number, number, number] => [x / y, 1, (1 - x - y) / y];

/** The XYZ → linear-sRGB matrix, derived from the primaries so that white (Y = 1) maps to (1, 1, 1). */
export const XYZ_TO_LINEAR_SRGB: M3 = (() => {
  const [r, g, b] = [xyz(SRGB.r), xyz(SRGB.g), xyz(SRGB.b)];
  const P: M3 = [
    [r[0], g[0], b[0]],
    [r[1], g[1], b[1]],
    [r[2], g[2], b[2]],
  ];
  const w = xyz(SRGB.white);
  const Pi = invert(P);
  const s = Pi.map((row) => row[0] * w[0] + row[1] * w[1] + row[2] * w[2]);
  const M: M3 = [
    [P[0][0] * (s[0] ?? 0), P[0][1] * (s[1] ?? 0), P[0][2] * (s[2] ?? 0)],
    [P[1][0] * (s[0] ?? 0), P[1][1] * (s[1] ?? 0), P[1][2] * (s[2] ?? 0)],
    [P[2][0] * (s[0] ?? 0), P[2][1] * (s[1] ?? 0), P[2][2] * (s[2] ?? 0)],
  ];
  return invert(M);
})();

/** The colour-matching functions at a wavelength, linearly interpolated; zero outside the table. */
export function cmf(nm: number, t: CmfTable): XYZ {
  const pos = (nm - t.start) / t.step;
  const i = Math.floor(pos);
  if (i < 0 || i >= t.x.length - 1) {
    if (i === t.x.length - 1 && pos === i) return [t.x[i] ?? 0, t.y[i] ?? 0, t.z[i] ?? 0];
    return [0, 0, 0];
  }
  const f = pos - i;
  const lerp = (a: readonly number[]) => (a[i] ?? 0) * (1 - f) + (a[i + 1] ?? 0) * f;
  return [lerp(t.x), lerp(t.y), lerp(t.z)];
}

export function xyzToLinearSRGB([X, Y, Z]: XYZ): RGB {
  const m = XYZ_TO_LINEAR_SRGB;
  return [
    m[0][0] * X + m[0][1] * Y + m[0][2] * Z,
    m[1][0] * X + m[1][1] * Y + m[1][2] * Z,
    m[2][0] * X + m[2][1] * Y + m[2][2] * Z,
  ];
}

/** The sRGB transfer curve (IEC 61966-2-1) for one linear channel in [0, 1]. */
export function encodeSRGB(c: number): number {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * A displayable colour for an XYZ stimulus at full brightness: out-of-gamut (negative) channels are
 * lifted by adding white until the smallest is 0, then the colour is scaled so its largest channel
 * is 1, then encoded. Returns gamma-encoded sRGB channels in [0, 1], or null for black.
 */
export function displayColour(stimulus: XYZ): RGB | null {
  let [r, g, b] = xyzToLinearSRGB(stimulus);
  const lowest = Math.min(r, g, b);
  if (lowest < 0) {
    r -= lowest;
    g -= lowest;
    b -= lowest;
  }
  const highest = Math.max(r, g, b);
  if (!(highest > 0)) return null;
  return [encodeSRGB(r / highest), encodeSRGB(g / highest), encodeSRGB(b / highest)];
}

/** The colour of a single spectral line (the hue at full brightness). */
export function wavelengthColour(nm: number, t: CmfTable): RGB | null {
  return displayColour(cmf(nm, t));
}

/**
 * The colour of a mixture of lines, each weighted by its intensity — an approximation of the
 * overall glow of a discharge tube, since tabulated intensities depend on how the source was run.
 */
export function mixtureColour(lines: ReadonlyArray<{ nm: number; weight: number }>, t: CmfTable): RGB | null {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (const { nm, weight } of lines) {
    const [x, y, z] = cmf(nm, t);
    X += weight * x;
    Y += weight * y;
    Z += weight * z;
  }
  return displayColour([X, Y, Z]);
}

export function toHex(rgb: RGB): string {
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}
