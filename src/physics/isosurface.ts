// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The 90 % enclosed-probability surface (SPEC §11.1): the density level c such that the voxels with
// ρ ≥ c hold the given fraction of the total. Equivalent to sorting the voxels by density and
// accumulating, but in linear time: a histogram of log ρ finds the right bin, and only that bin is
// sorted.

const BINS = 4096;

export function enclosedLevel(values: ArrayLike<number>, fraction: number): number {
  if (!(fraction > 0 && fraction < 1)) throw new RangeError(`fraction must be in (0, 1), got ${fraction}`);
  let total = 0;
  let max = 0;
  let minPositive = Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (v <= 0) continue;
    total += v;
    if (v > max) max = v;
    if (v < minPositive) minPositive = v;
  }
  if (total === 0) return 0;
  const lo = Math.log(minPositive);
  const scale = BINS / (Math.log(max) - lo || 1);
  // One logarithm per voxel: the bin of every positive value is kept for the final pass.
  const bins = new Uint16Array(values.length);
  const sums = new Float64Array(BINS);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (v <= 0) {
      bins[i] = 0xffff;
      continue;
    }
    const b = Math.min(BINS - 1, Math.floor((Math.log(v) - lo) * scale));
    bins[i] = b;
    sums[b] = (sums[b] ?? 0) + v;
  }
  const target = fraction * total;
  let acc = 0;
  let b = BINS - 1;
  for (; b >= 0; b--) {
    const s = sums[b] ?? 0;
    if (acc + s >= target) break;
    acc += s;
  }
  const inBin: number[] = [];
  for (let i = 0; i < values.length; i++) if (bins[i] === b) inBin.push(values[i] ?? 0);
  inBin.sort((x, y) => y - x);
  for (const v of inBin) {
    acc += v;
    if (acc >= target) return v;
  }
  return inBin[inBin.length - 1] ?? minPositive;
}
