// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// One orbital's 3D picture (SPEC §10.1, §11.1): |ψ|² on a cubic grid whose half-width is ⟨r⟩ + 3σ,
// the 90 % enclosed-probability surface by marching cubes, vertex colours by phase, the nodal
// surfaces of real orbitals (ψ = 0), and a slice of |ψ|² through the xz-plane. Lengths in a₀.
// Pure computation, run in a Web Worker (orbital.worker.ts).

import {
  complexHarmonic,
  complexMagnitudeFunction,
  meanRadius,
  type OrbitalKind,
  radialFunction,
  radiusSpread,
  realHarmonicFunction,
} from "../../physics/hydrogenic";
import { enclosedLevel } from "../../physics/isosurface";
import { marchingCubes } from "./marchingCubes";

export interface OrbitalRequest {
  n: number;
  l: number;
  m: number;
  /** Effective nuclear charge. */
  z: number;
  kind: OrbitalKind;
  /** Points per axis: 96 on desktop, 64 on phones (SPEC §11.1). */
  grid: number;
  nodal?: boolean;
  slice?: number;
}

export interface OrbitalResult {
  key: string;
  /** Half-width of the grid, a₀. */
  half: number;
  /** The density level of the 90 % surface, and the fraction of the grid's total it encloses. */
  level: number;
  enclosed: number;
  positions: Float32Array;
  normals: Float32Array;
  /** Three vertex indices per triangle. */
  indices: Uint32Array;
  /** RGB per vertex in [0, 1]. */
  colors: Float32Array;
  nodal?: { positions: Float32Array; normals: Float32Array; indices: Uint32Array };
  /** |ψ|² on the xz-plane as RGBA bytes, `slice × slice` pixels, x to the right and z up. */
  sliceImage?: Uint8ClampedArray;
  sliceSize?: number;
  millis: number;
}

export const orbitalKey = (r: OrbitalRequest) => `${r.n},${r.l},${r.m},${r.z.toFixed(4)},${r.kind},${r.grid}`;

/** Colours of the two signs of a real orbital and of the phase wheel (also shown in the legend). */
export const PHASE_POSITIVE: readonly [number, number, number] = [0.95, 0.55, 0.2];
export const PHASE_NEGATIVE: readonly [number, number, number] = [0.25, 0.55, 0.95];

function hue(phase: number): [number, number, number] {
  // A colour wheel in HSV with S = 0.75, V = 0.95: phase 0 orange-red, π/2 yellow-green, π cyan-blue …
  const h = ((phase / (2 * Math.PI)) * 6 + 6) % 6;
  const c = 0.95 * 0.75;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const mm = 0.95 - c;
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return [r + mm, g + mm, b + mm];
}

/** The viridis-like ramp for the slice, from dark (low |ψ|²) to bright. Computed, not tabulated. */
function ramp(t: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, t));
  return [Math.min(1, 1.6 * u * u + 0.05), Math.min(1, 0.1 + 0.95 * u), Math.min(1, 0.25 + 0.7 * u * (1 - u) + 0.2 * u)];
}

/**
 * Signs of a real orbital ψ under the reflections x → −x, y → −y and z → −z. The angular factor is
 * Re or Im of (x + iy)^|m| times a polynomial in z of parity (−1)^(l−|m|); the radial factor is even.
 * |ψ|² is even under all three for every orbital, real or complex.
 */
export function reflectionSigns(l: number, m: number): [number, number, number] {
  const a = Math.abs(m);
  const sx = m >= 0 ? (a % 2 ? -1 : 1) : a % 2 ? 1 : -1;
  const sy = m >= 0 ? 1 : -1;
  const sz = (l - a) % 2 ? -1 : 1;
  return [sx, sy, sz];
}

export interface Field {
  half: number;
  step: number;
  density: Float32Array;
  /** ψ itself, for real orbitals (the nodal surfaces are where it is zero). */
  psi: Float32Array | null;
  /** The density on one octant only (i, j, k ≥ n/2): every value of `density` appears in it 1/8 as often. */
  octant: Float32Array;
}

/**
 * ψ and |ψ|² on the grid. The grid points are symmetric about the origin (the point count is even),
 * so one octant is evaluated and mirrored into the other seven: an eighth of the work.
 */
export function sampleField(req: Pick<OrbitalRequest, "n" | "l" | "m" | "z" | "kind" | "grid">): Field {
  const { n: N, l, m, z, kind, grid: G } = req;
  if (G % 2) throw new RangeError(`grid must have an even number of points, got ${G}`);
  const half = meanRadius(N, l, z) + 3 * radiusSpread(N, l, z);
  const step = (2 * half) / (G - 1);
  const R = radialFunction(N, l, z);
  const Y = kind === "real" ? realHarmonicFunction(l, m) : complexMagnitudeFunction(l, m);
  const [sx, sy, sz] = reflectionSigns(l, m);
  const H = G / 2;
  const density = new Float32Array(G * G * G);
  const psi = kind === "real" ? new Float32Array(G * G * G) : null;
  const octant = new Float32Array(H * H * H);
  const eps = step * 1e-3;
  let o = 0;
  for (let k = H; k < G; k++) {
    const zz = -half + k * step;
    for (let j = H; j < G; j++) {
      const y = -half + j * step;
      // Row starts of the four mirror images of row (j, k): +y+z, −y+z, +y−z, −y−z.
      const r0 = G * (j + G * k);
      const r1 = G * (G - 1 - j + G * k);
      const r2 = G * (j + G * (G - 1 - k));
      const r3 = G * (G - 1 - j + G * (G - 1 - k));
      for (let i = H; i < G; i++) {
        const x = -half + i * step;
        const r = Math.sqrt(x * x + y * y + zz * zz) || eps;
        const v = R(r) * Y(x, y, zz, r);
        const d = v * v;
        octant[o++] = d;
        const m = G - 1 - i;
        density[r0 + i] = d;
        density[r0 + m] = d;
        density[r1 + i] = d;
        density[r1 + m] = d;
        density[r2 + i] = d;
        density[r2 + m] = d;
        density[r3 + i] = d;
        density[r3 + m] = d;
        if (psi) {
          psi[r0 + i] = v;
          psi[r0 + m] = sx * v;
          psi[r1 + i] = sy * v;
          psi[r1 + m] = sx * sy * v;
          psi[r2 + i] = sz * v;
          psi[r2 + m] = sx * sz * v;
          psi[r3 + i] = sy * sz * v;
          psi[r3 + m] = sx * sy * sz * v;
        }
      }
    }
  }
  return { half, step, density, psi, octant };
}

export function computeOrbital(req: OrbitalRequest): OrbitalResult {
  const t0 = performance.now();
  const { n: N, l, m, z, kind, grid: G } = req;
  const { half, step, density, psi, octant } = sampleField(req);
  const R = radialFunction(N, l, z);
  const Y = kind === "real" ? realHarmonicFunction(l, m) : complexMagnitudeFunction(l, m);
  const eps = step * 1e-3;
  // The level and the enclosed fraction are the same on one octant as on the whole grid.
  const level = enclosedLevel(octant, 0.9);
  let total = 0;
  let inside = 0;
  let reach = 0; // the farthest octant index (per axis) still at or above the level
  for (let k = 0, o = 0; k < G / 2; k++) {
    for (let j = 0; j < G / 2; j++) {
      for (let i = 0; i < G / 2; i++, o++) {
        const d = octant[o] ?? 0;
        total += d;
        if (d >= level) {
          inside += d;
          if (i > reach) reach = i;
          if (j > reach) reach = j;
          if (k > reach) reach = k;
        }
      }
    }
  }
  // Marching cubes only where the surface can be: the cube of cells around the points above the level.
  const lo = Math.max(0, G / 2 - 2 - reach);
  const hi = Math.min(G - 1, G / 2 + reach + 1);
  const mesh = marchingCubes({ n: G, origin: -half, step, values: density }, level, { lo, hi });
  const colors = new Float32Array(mesh.positions.length);
  for (let p = 0; p < mesh.positions.length; p += 3) {
    const x = mesh.positions[p] ?? 0;
    const y = mesh.positions[p + 1] ?? 0;
    const zz = mesh.positions[p + 2] ?? 0;
    const r = Math.sqrt(x * x + y * y + zz * zz) || eps;
    let c: readonly [number, number, number];
    if (kind === "real") {
      const v = R(r) * Y(x, y, zz, r);
      c = v >= 0 ? PHASE_POSITIVE : PHASE_NEGATIVE;
    } else {
      const { phase } = complexHarmonic(l, m, x, y, zz, r);
      c = hue(phase + (R(r) < 0 ? Math.PI : 0));
    }
    colors[p] = c[0];
    colors[p + 1] = c[1];
    colors[p + 2] = c[2];
  }
  const out: OrbitalResult = {
    key: orbitalKey(req),
    half,
    level,
    enclosed: total > 0 ? inside / total : 0,
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    colors,
    millis: 0,
  };
  if (req.nodal && psi) {
    out.nodal = marchingCubes({ n: G, origin: -half, step, values: psi }, 0);
  }
  if (req.slice) {
    const S = req.slice;
    const img = new Uint8ClampedArray(S * S * 4);
    const vals = new Float32Array(S * S);
    let max = 0;
    const s = (2 * half) / (S - 1);
    for (let row = 0; row < S; row++) {
      const zz = half - row * s; // z up
      for (let col = 0; col < S; col++) {
        const x = -half + col * s;
        const r = Math.sqrt(x * x + zz * zz) || eps;
        const v = R(r) * Y(x, 0, zz, r);
        const d = v * v;
        vals[row * S + col] = d;
        if (d > max) max = d;
      }
    }
    for (let i = 0; i < vals.length; i++) {
      // A square-root ramp so the outer lobes stay visible next to the inner peak.
      const [r, g, b] = ramp(max > 0 ? Math.sqrt((vals[i] ?? 0) / max) : 0);
      img[4 * i] = r * 255;
      img[4 * i + 1] = g * 255;
      img[4 * i + 2] = b * 255;
      img[4 * i + 3] = 255;
    }
    out.sliceImage = img;
    out.sliceSize = S;
  }
  out.millis = performance.now() - t0;
  return out;
}
