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
  positions: Float32Array;
  normals: Float32Array;
}

// Corner offsets (Bourke): v0 (0,0,0) v1 (1,0,0) v2 (1,1,0) v3 (0,1,0) v4 (0,0,1) v5 (1,0,1) v6 (1,1,1) v7 (0,1,1)
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
const EDGE = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

class Growable {
  data: Float32Array;
  length = 0;
  constructor(capacity: number) {
    this.data = new Float32Array(capacity);
  }
  push3(a: number, b: number, c: number): void {
    if (this.length + 3 > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
  result(): Float32Array {
    return this.data.slice(0, this.length);
  }
}

/** The surface where the field equals `level`; "inside" is where the field exceeds it. */
export function marchingCubes(grid: Grid, level: number): Mesh {
  const { n, origin, step, values: f } = grid;
  const n2 = n * n;
  // Index offsets of the eight corners, and the (i, j, k) offsets, in Bourke's order.
  const off = CORNER.map(([a, b, c]) => a + n * b + n2 * c);
  const pos = new Growable(1 << 18);
  const nor = new Growable(1 << 18);
  const ex = new Float32Array(36);
  const en = new Float32Array(36);
  const v = new Float64Array(8);
  const gx = new Float64Array(8);
  const gy = new Float64Array(8);
  const gz = new Float64Array(8);

  // Central-difference gradient at one grid point, one-sided at the faces.
  const gradient = (idx: number, i: number, j: number, k: number, c: number) => {
    const xp = i < n - 1 ? idx + 1 : idx;
    const xm = i > 0 ? idx - 1 : idx;
    const yp = j < n - 1 ? idx + n : idx;
    const ym = j > 0 ? idx - n : idx;
    const zp = k < n - 1 ? idx + n2 : idx;
    const zm = k > 0 ? idx - n2 : idx;
    gx[c] = (f[xp] ?? 0) - (f[xm] ?? 0);
    gy[c] = (f[yp] ?? 0) - (f[ym] ?? 0);
    gz[c] = (f[zp] ?? 0) - (f[zm] ?? 0);
  };

  for (let k = 0; k < n - 1; k++) {
    for (let j = 0; j < n - 1; j++) {
      let idx = n * j + n2 * k;
      for (let i = 0; i < n - 1; i++, idx++) {
        let cube = 0;
        for (let c = 0; c < 8; c++) {
          const val = f[idx + (off[c] ?? 0)] ?? 0;
          v[c] = val;
          if (val < level) cube |= 1 << c;
        }
        if (cube === 0 || cube === 255) continue;
        const bits = edgeTable[cube] ?? 0;
        let have = 0; // corners whose gradient is computed
        for (let e = 0; e < 12; e++) {
          if (!(bits & (1 << e))) continue;
          const pair = EDGE[e] ?? [0, 0];
          const a = pair[0];
          const b = pair[1];
          for (const c of pair) {
            if (have & (1 << c)) continue;
            const o = CORNER[c] ?? [0, 0, 0];
            gradient(idx + (off[c] ?? 0), i + o[0], j + o[1], k + o[2], c);
            have |= 1 << c;
          }
          const oa = CORNER[a] ?? [0, 0, 0];
          const ob = CORNER[b] ?? [0, 0, 0];
          const va = v[a] ?? 0;
          const vb = v[b] ?? 0;
          const t = va === vb ? 0.5 : (level - va) / (vb - va);
          ex[3 * e] = origin + step * (i + oa[0] + t * (ob[0] - oa[0]));
          ex[3 * e + 1] = origin + step * (j + oa[1] + t * (ob[1] - oa[1]));
          ex[3 * e + 2] = origin + step * (k + oa[2] + t * (ob[2] - oa[2]));
          // The surface normal points down the gradient, out of the region where the field is high.
          const nx = -((gx[a] ?? 0) + t * ((gx[b] ?? 0) - (gx[a] ?? 0)));
          const ny = -((gy[a] ?? 0) + t * ((gy[b] ?? 0) - (gy[a] ?? 0)));
          const nz = -((gz[a] ?? 0) + t * ((gz[b] ?? 0) - (gz[a] ?? 0)));
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          en[3 * e] = nx / len;
          en[3 * e + 1] = ny / len;
          en[3 * e + 2] = nz / len;
        }
        const base = cube * 16;
        for (let t = 0; t < 16; t++) {
          const e = triTable[base + t] ?? -1;
          if (e === -1) break;
          pos.push3(ex[3 * e] ?? 0, ex[3 * e + 1] ?? 0, ex[3 * e + 2] ?? 0);
          nor.push3(en[3 * e] ?? 0, en[3 * e + 1] ?? 0, en[3 * e + 2] ?? 0);
        }
      }
    }
  }
  return { positions: pos.result(), normals: nor.result() };
}
