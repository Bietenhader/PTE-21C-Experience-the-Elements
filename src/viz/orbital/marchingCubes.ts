// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Marching cubes (Lorensen & Cline 1987) on a cubic grid, for the orbital isosurfaces (SPEC §11.1,
// IMPLEMENTER'S CHOICE I2). The 256-case edge and triangle tables are three.js's (MIT), in Paul
// Bourke's corner and edge numbering. Normals come from the field's gradient, so the surfaces are
// smoothly shaded. No DOM, no React: runs in a Web Worker.

import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";

export interface Grid {
  /** Points per axis. */
  n: number;
  /** Coordinate of the first point on every axis, and the spacing. */
  origin: number;
  step: number;
  /** Values at (i, j, k), index i + n·(j + n·k). */
  values: Float32Array;
}

export interface Mesh {
  /** One entry per distinct vertex: a vertex on a grid edge is shared by the cells around that edge. */
  positions: Float32Array;
  normals: Float32Array;
  /** Three vertex indices per triangle. */
  indices: Uint32Array;
}

// Each cell edge in Bourke's numbering as the offset of its lower corner and its direction (0 x, 1 y,
// 2 z): v0 (0,0,0) v1 (1,0,0) v2 (1,1,0) v3 (0,1,0) v4 (0,0,1) v5 (1,0,1) v6 (1,1,1) v7 (0,1,1).
const EDGE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 0], // v0–v1
  [1, 0, 0, 1], // v1–v2
  [0, 1, 0, 0], // v3–v2
  [0, 0, 0, 1], // v0–v3
  [0, 0, 1, 0], // v4–v5
  [1, 0, 1, 1], // v5–v6
  [0, 1, 1, 0], // v7–v6
  [0, 0, 1, 1], // v4–v7
  [0, 0, 0, 2], // v0–v4
  [1, 0, 0, 2], // v1–v5
  [1, 1, 0, 2], // v2–v6
  [0, 1, 0, 2], // v3–v7
];
// The eight corners as (i, j, k) offsets, in Bourke's order.
const CORNER = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
] as const;

class Growable<T extends Float32Array | Uint32Array> {
  length = 0;
  constructor(
    public data: T,
    private make: (size: number) => T,
  ) {}
  push3(a: number, b: number, c: number): void {
    if (this.length + 3 > this.data.length) {
      const next = this.make(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
  result(): T {
    return this.data.slice(0, this.length) as T;
  }
}

/**
 * The surface where the field equals `level`; "inside" is where the field exceeds it. `cells` limits
 * the work to the cells lo … hi − 1 on every axis, where the caller knows the surface lies.
 */
export function marchingCubes(grid: Grid, level: number, cells?: { lo: number; hi: number }): Mesh {
  const { n, origin, step, values: f } = grid;
  const lo = Math.max(0, cells?.lo ?? 0);
  const hi = Math.min(n - 1, cells?.hi ?? n - 1);
  const n2 = n * n;
  const stride = [1, n, n2];
  const cornerOffset = CORNER.map(([a, b, c]) => a + n * b + n2 * c);
  const pos = new Growable(new Float32Array(1 << 16), (k) => new Float32Array(k));
  const nor = new Growable(new Float32Array(1 << 16), (k) => new Float32Array(k));
  const tri = new Growable(new Uint32Array(1 << 17), (k) => new Uint32Array(k));
  // The vertex on each grid edge (3 per point: +x, +y, +z), stored as index + 1 so that 0 means none yet.
  const vertexOf = new Uint32Array(3 * n * n2);
  const local = new Int32Array(12);
  let count = 0;

  // Central-difference gradient at grid point q = (i, j, k), one-sided at the faces.
  const g = [0, 0, 0];
  const gradient = (q: number, i: number, j: number, k: number) => {
    g[0] = (f[i < n - 1 ? q + 1 : q] ?? 0) - (f[i > 0 ? q - 1 : q] ?? 0);
    g[1] = (f[j < n - 1 ? q + n : q] ?? 0) - (f[j > 0 ? q - n : q] ?? 0);
    g[2] = (f[k < n - 1 ? q + n2 : q] ?? 0) - (f[k > 0 ? q - n2 : q] ?? 0);
  };

  /** The vertex where the surface crosses the grid edge from point q = (i, j, k) along `dir`. */
  const vertex = (q: number, i: number, j: number, k: number, dir: number): number => {
    const key = 3 * q + dir;
    const known = vertexOf[key] ?? 0;
    if (known) return known - 1;
    const qb = q + (stride[dir] ?? 1);
    const va = f[q] ?? 0;
    const vb = f[qb] ?? 0;
    const t = va === vb ? 0.5 : (level - va) / (vb - va);
    pos.push3(
      origin + step * (i + (dir === 0 ? t : 0)),
      origin + step * (j + (dir === 1 ? t : 0)),
      origin + step * (k + (dir === 2 ? t : 0)),
    );
    gradient(q, i, j, k);
    const ax = g[0] ?? 0;
    const ay = g[1] ?? 0;
    const az = g[2] ?? 0;
    gradient(qb, i + (dir === 0 ? 1 : 0), j + (dir === 1 ? 1 : 0), k + (dir === 2 ? 1 : 0));
    // The surface normal points down the gradient, out of the region where the field is high.
    const nx = -(ax + t * ((g[0] ?? 0) - ax));
    const ny = -(ay + t * ((g[1] ?? 0) - ay));
    const nz = -(az + t * ((g[2] ?? 0) - az));
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nor.push3(nx / len, ny / len, nz / len);
    vertexOf[key] = count + 1;
    return count++;
  };

  // Which grid points lie below the level, computed once: each point is a corner of up to eight cells.
  const below = new Uint8Array(f.length);
  for (let q = 0; q < f.length; q++) below[q] = (f[q] ?? 0) < level ? 1 : 0;
  const [o0 = 0, o1 = 0, o2 = 0, o3 = 0, o4 = 0, o5 = 0, o6 = 0, o7 = 0] = cornerOffset;

  for (let k = lo; k < hi; k++) {
    for (let j = lo; j < hi; j++) {
      let q = lo + n * j + n2 * k;
      for (let i = lo; i < hi; i++, q++) {
        const cube =
          (below[q + o0] ?? 0) |
          ((below[q + o1] ?? 0) << 1) |
          ((below[q + o2] ?? 0) << 2) |
          ((below[q + o3] ?? 0) << 3) |
          ((below[q + o4] ?? 0) << 4) |
          ((below[q + o5] ?? 0) << 5) |
          ((below[q + o6] ?? 0) << 6) |
          ((below[q + o7] ?? 0) << 7);
        if (cube === 0 || cube === 255) continue;
        const bits = edgeTable[cube] ?? 0;
        for (let e = 0; e < 12; e++) {
          if (!(bits & (1 << e))) continue;
          const [di, dj, dk, dir] = EDGE[e] ?? [0, 0, 0, 0];
          local[e] = vertex(q + di + n * dj + n2 * dk, i + di, j + dj, k + dk, dir);
        }
        const base = cube * 16;
        for (let t = 0; t < 16; t += 3) {
          const e0 = triTable[base + t] ?? -1;
          if (e0 === -1) break;
          tri.push3(local[e0] ?? 0, local[triTable[base + t + 1] ?? 0] ?? 0, local[triTable[base + t + 2] ?? 0] ?? 0);
        }
      }
    }
  }
  return { positions: pos.result(), normals: nor.result(), indices: tri.result() };
}
