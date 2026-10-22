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
  const span = Math.log(max) - lo || 1;
  const bin = (v: number) => Math.min(BINS - 1, Math.floor(((Math.log(v) - lo) / span) * BINS));
  const sums = new Float64Array(BINS);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (v > 0) sums[bin(v)] = (sums[bin(v)] ?? 0) + v;
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
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? 0;
    if (v > 0 && bin(v) === b) inBin.push(v);
  }
  inBin.sort((x, y) => y - x);
  for (const v of inBin) {
    acc += v;
    if (acc >= target) return v;
  }
  return inBin[inBin.length - 1] ?? minPositive;
}
