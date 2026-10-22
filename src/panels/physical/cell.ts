// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The conventional unit cell of an element's crystal (SPEC §10.4), as pure geometry: the atom positions
// of the common structure types (fractional coordinates, origin on an atom as in most textbooks), every
// copy of them that lies in or on the cell, the cell's edges, and the lattice vectors from a, b, c, α, β,
// γ. The cell sizes come from the crystal record (tools/curated/crystal.toml, COD); structure types not
// listed here are shown as parameters only.

import type { CrystalStructure } from "../../data/types";

export type Vec3 = [number, number, number];

export interface StructureType {
  id: string;
  /** Plain words, used in the picture's label. */
  label: string;
  basis: Vec3[];
}

const FCC: Vec3[] = [
  [0, 0, 0],
  [0.5, 0.5, 0],
  [0.5, 0, 0.5],
  [0, 0.5, 0.5],
];

const TYPES = {
  sc: { id: "sc", label: "simple cubic", basis: [[0, 0, 0]] },
  bcc: { id: "bcc", label: "body-centred cubic", basis: [[0, 0, 0], [0.5, 0.5, 0.5]] },
  fcc: { id: "fcc", label: "face-centred cubic", basis: FCC },
  diamond: {
    id: "diamond",
    label: "diamond cubic",
    basis: [...FCC, ...FCC.map(([x, y, z]): Vec3 => [x + 0.25, y + 0.25, z + 0.25])],
  },
  hcp: { id: "hcp", label: "hexagonal close-packed", basis: [[0, 0, 0], [1 / 3, 2 / 3, 0.5]] },
  dhcp: {
    id: "dhcp",
    label: "double hexagonal close-packed",
    basis: [[0, 0, 0], [0, 0, 0.5], [1 / 3, 2 / 3, 0.25], [2 / 3, 1 / 3, 0.75]],
  },
  graphite: {
    id: "graphite",
    label: "graphite: hexagonal layers",
    basis: [[0, 0, 0], [1 / 3, 2 / 3, 0], [0, 0, 0.5], [2 / 3, 1 / 3, 0.5]],
  },
  bct: { id: "bct", label: "body-centred tetragonal", basis: [[0, 0, 0], [0.5, 0.5, 0.5]] },
  betaTin: {
    id: "betaTin",
    label: "β-tin type, body-centred tetragonal",
    basis: [[0, 0, 0], [0.5, 0.5, 0.5], [0, 0.5, 0.25], [0.5, 0, 0.75]],
  },
  alphaHg: {
    id: "alphaHg",
    label: "rhombohedral α-mercury type, drawn on hexagonal axes",
    basis: [[0, 0, 0], [2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 2 / 3]],
  },
} satisfies Record<string, StructureType>;

/** The structure type of a crystal record, by Pearson symbol and space group; null when PTE-21C has no drawing for it. */
export function structureType(c: Pick<CrystalStructure, "pearson" | "spaceGroupNumber" | "structure">): StructureType | null {
  const key = `${c.pearson}/${c.spaceGroupNumber}`;
  switch (key) {
    case "cP1/221":
      return TYPES.sc;
    case "cI2/229":
      return TYPES.bcc;
    case "cF4/225":
      return TYPES.fcc;
    case "cF8/227":
      return TYPES.diamond;
    case "hP2/194":
      return TYPES.hcp;
    case "tI2/139":
      return TYPES.bct;
    case "tI4/141":
      return TYPES.betaTin;
    case "hR1/166":
      return TYPES.alphaHg;
    case "hP4/194":
      // Three different things share this symbol: double hcp (La, Pr, Nd, Am), graphite, and solid H₂
      // (whose "atoms" are molecules on hcp sites: not drawn).
      if (/double hexagonal/.test(c.structure)) return TYPES.dhcp;
      if (/graphite/.test(c.structure)) return TYPES.graphite;
      return null;
    default:
      return null;
  }
}

const RAD = Math.PI / 180;

/** Cartesian lattice vectors (a along x, b in the xy-plane) from the cell lengths and angles in degrees. */
export function latticeVectors(a: number, b: number, c: number, alpha: number, beta: number, gamma: number): [Vec3, Vec3, Vec3] {
  const [ca, cb, cg, sg] = [Math.cos(alpha * RAD), Math.cos(beta * RAD), Math.cos(gamma * RAD), Math.sin(gamma * RAD)];
  const cy = (ca - cb * cg) / sg;
  const cz = Math.sqrt(Math.max(0, 1 - cb * cb - cy * cy));
  return [
    [a, 0, 0],
    [b * cg, b * sg, 0],
    [c * cb, c * cy, c * cz],
  ];
}

export function toCartesian(f: Vec3, v: [Vec3, Vec3, Vec3]): Vec3 {
  const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = v;
  return [f[0] * ax + f[1] * bx + f[2] * cx, f[0] * ay + f[1] * by + f[2] * cy, f[0] * az + f[1] * bz + f[2] * cz];
}

/** p − q, scaled: a position relative to the cell's middle, in scene units. */
export function relative(p: Vec3, q: Vec3, scale = 1): Vec3 {
  return [(p[0] - q[0]) * scale, (p[1] - q[1]) * scale, (p[2] - q[2]) * scale];
}

const EPS = 1e-6;
const wrap = (x: number) => x - Math.floor(x + EPS);
const onFace = (x: number) => Math.abs(x) < EPS || Math.abs(x - 1) < EPS;

/** Every copy of the basis whose fractional coordinates lie in [0, 1]: the atoms one draws in the cell. */
export function atomsInCell(basis: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  const seen = new Set<string>();
  const options = (x: number) => (onFace(x) ? [0, 1] : [x]);
  for (const p of basis) {
    const w: Vec3 = [wrap(p[0]), wrap(p[1]), wrap(p[2])];
    for (const x of options(w[0]))
      for (const y of options(w[1]))
        for (const z of options(w[2])) {
          const key = [x, y, z].map((t) => t.toFixed(5)).join(",");
          if (!seen.has(key)) {
            seen.add(key);
            out.push([x, y, z]);
          }
        }
  }
  return out;
}

/** How much of each drawn atom belongs to this cell: ½ per face it sits on (a corner atom counts ⅛). */
export function share(f: Vec3): number {
  return f.reduce((s, x) => (onFace(x) ? s / 2 : s), 1);
}

/** The twelve edges of the cell, as pairs of fractional corners. */
export function cellEdges(): Array<[Vec3, Vec3]> {
  const edges: Array<[Vec3, Vec3]> = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const u of [0, 1])
      for (const v of [0, 1]) {
        const from: Vec3 = [0, 0, 0];
        const [i, j] = [0, 1, 2].filter((k) => k !== axis) as [number, number];
        from[i] = u;
        from[j] = v;
        const to: Vec3 = [...from];
        to[axis] = 1;
        edges.push([from, to]);
      }
  }
  return edges;
}

function dist(p: Vec3, q: Vec3): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export interface CellModel {
  type: StructureType;
  vectors: [Vec3, Vec3, Vec3];
  /** Fractional and Cartesian (pm) positions of every drawn atom. */
  atoms: Array<{ frac: Vec3; pos: Vec3; share: number }>;
  edges: Array<[Vec3, Vec3]>;
  /** Atoms per cell, counting the shared ones by their share. */
  perCell: number;
  /** Shortest distance between two atoms, pm. */
  nearest: number;
  /** Middle of the cell, pm. */
  centre: Vec3;
  /** Distance from the middle to the farthest corner, pm: the cell fits in a sphere of this radius. */
  radius: number;
}

export function cellModel(c: CrystalStructure): CellModel | null {
  const type = structureType(c);
  if (!type) return null;
  const a = c.a.value;
  const b = c.b?.value ?? a;
  const cc = c.c?.value ?? a;
  const vectors = latticeVectors(a, b, cc, c.alpha.value, c.beta.value, c.gamma.value);
  const atoms = atomsInCell(type.basis).map((f) => ({ frac: f, pos: toCartesian(f, vectors), share: share(f) }));
  const centre = toCartesian([0.5, 0.5, 0.5], vectors);
  let nearest = Infinity;
  atoms.forEach((p, i) => {
    for (const q of atoms.slice(i + 1)) nearest = Math.min(nearest, dist(p.pos, q.pos));
  });
  return {
    type,
    vectors,
    atoms,
    edges: cellEdges().map(([p, q]) => [toCartesian(p, vectors), toCartesian(q, vectors)]),
    perCell: atoms.reduce((s, x) => s + x.share, 0),
    nearest,
    centre,
    radius: Math.max(...cellEdges().flat().map((corner) => dist(toCartesian(corner, vectors), centre))),
  };
}

/** The drawing's sphere radius, as a share of the shortest atom–atom distance: small enough to see through the cell. */
export const BALL_SHARE = 0.22;
