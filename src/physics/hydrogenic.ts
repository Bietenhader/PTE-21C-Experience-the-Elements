// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Hydrogenic orbitals with an effective nuclear charge (SPEC §11.1, Tier A). Lengths are in Bohr
// radii a₀ throughout; the UI converts to pm with CODATA's a₀. Pure functions, no React.
//
//   R_nl(r) = N · ρ^l · e^(−ρ/2) · L^(2l+1)_(n−l−1)(ρ),   ρ = 2Zr/n,   ∫₀^∞ r² R² dr = 1
//
// Angular parts are spherical harmonics, either complex (labelled by m_l) or the real
// combinations chemists draw (p_x, p_y, p_z, d_xy …). Neither needs a trigonometric call: cos θ, sin θ
// and e^(imφ) all follow from x, y, z, which keeps the 96³ grids of the orbital gallery fast.

export const L_LETTER = "spdfghik";

/** Generalised Laguerre polynomial L^(α)_k(x) by the three-term recurrence. */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  let prev = 1;
  let curr = 1 + alpha - x;
  for (let j = 1; j < k; j++) {
    const next = ((2 * j + 1 + alpha - x) * curr - (j + alpha) * prev) / (j + 1);
    prev = curr;
    curr = next;
  }
  return curr;
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function checkQuantumNumbers(n: number, l: number, z: number): void {
  if (!Number.isInteger(n) || !Number.isInteger(l) || n < 1 || l < 0 || l >= n) {
    throw new RangeError(`no hydrogenic orbital with n = ${n}, l = ${l}`);
  }
  if (!(z > 0)) throw new RangeError(`effective charge must be positive, got ${z}`);
}

/** Normalisation constant of R_nl for effective charge z. */
export function radialNorm(n: number, l: number, z: number): number {
  checkQuantumNumbers(n, l, z);
  return Math.sqrt(((2 * z) / n) ** 3 * (factorial(n - l - 1) / (2 * n * factorial(n + l))));
}

/** R_nl(r), r in a₀, in units of a₀^(−3/2). */
export function radial(n: number, l: number, z: number, r: number): number {
  const rho = (2 * z * r) / n;
  return radialNorm(n, l, z) * rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** A fast evaluator of R_nl for one orbital, for use inside grid loops. */
export function radialFunction(n: number, l: number, z: number): (r: number) => number {
  const norm = radialNorm(n, l, z);
  const scale = (2 * z) / n;
  const k = n - l - 1;
  const alpha = 2 * l + 1;
  return (r) => {
    const rho = scale * r;
    return norm * rho ** l * Math.exp(-rho / 2) * laguerre(k, alpha, rho);
  };
}

/** Radial distribution P(r) = r² R_nl(r)²: the probability per unit radius. */
export function radialDistribution(n: number, l: number, z: number, r: number): number {
  const R = radial(n, l, z, r);
  return r * r * R * R;
}

/** ⟨r⟩ = (1 / 2Z) [3n² − l(l+1)] a₀ (exact for a hydrogenic orbital). */
export function meanRadius(n: number, l: number, z: number): number {
  checkQuantumNumbers(n, l, z);
  return (3 * n * n - l * (l + 1)) / (2 * z);
}

/** ⟨r²⟩ = (n² / 2Z²) [5n² + 1 − 3l(l+1)] a₀². */
export function meanSquareRadius(n: number, l: number, z: number): number {
  checkQuantumNumbers(n, l, z);
  return ((n * n) / (2 * z * z)) * (5 * n * n + 1 - 3 * l * (l + 1));
}

/** Spread σ_r = √(⟨r²⟩ − ⟨r⟩²). */
export function radiusSpread(n: number, l: number, z: number): number {
  return Math.sqrt(meanSquareRadius(n, l, z) - meanRadius(n, l, z) ** 2);
}

export const radialNodes = (n: number, l: number): number => n - l - 1;
export const angularNodes = (l: number): number => l;

/**
 * Radius of the largest maximum of P(r). For a nodeless orbital (l = n − 1) this is n²/Z exactly;
 * otherwise it is found numerically (dense scan, then golden-section refinement).
 */
export function mostProbableRadius(n: number, l: number, z: number): number {
  checkQuantumNumbers(n, l, z);
  if (l === n - 1) return (n * n) / z;
  const rMax = (meanRadius(n, l, z) + 6 * radiusSpread(n, l, z)) * 1.2;
  const steps = 4000;
  let best = 0;
  let bestP = -1;
  for (let i = 1; i <= steps; i++) {
    const r = (rMax * i) / steps;
    const p = radialDistribution(n, l, z, r);
    if (p > bestP) {
      bestP = p;
      best = r;
    }
  }
  let a = Math.max(0, best - rMax / steps);
  let b = best + rMax / steps;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (radialDistribution(n, l, z, c) > radialDistribution(n, l, z, d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** ∫₀^r P(r′) dr′ by Simpson's rule: the probability of finding the electron within r. */
export function enclosedProbability(n: number, l: number, z: number, r: number, steps = 2000): number {
  if (r <= 0) return 0;
  const m = steps % 2 === 0 ? steps : steps + 1;
  const h = r / m;
  let sum = radialDistribution(n, l, z, 0) + radialDistribution(n, l, z, r);
  for (let i = 1; i < m; i++) sum += (i % 2 === 0 ? 2 : 4) * radialDistribution(n, l, z, i * h);
  return (sum * h) / 3;
}

/** Radii where R_nl changes sign (the radial nodes), from the roots of the Laguerre polynomial. */
export function radialNodeRadii(n: number, l: number, z: number): number[] {
  const k = n - l - 1;
  if (k === 0) return [];
  const rMax = meanRadius(n, l, z) + 8 * radiusSpread(n, l, z);
  const f = radialFunction(n, l, z);
  const out: number[] = [];
  const steps = 8000;
  let prev = f(rMax / steps);
  for (let i = 2; i <= steps && out.length < k; i++) {
    const r = (rMax * i) / steps;
    const v = f(r);
    if (Math.sign(v) !== Math.sign(prev)) {
      let a = r - rMax / steps;
      let b = r;
      for (let j = 0; j < 60; j++) {
        const c = (a + b) / 2;
        if (Math.sign(f(c)) === Math.sign(f(a))) a = c;
        else b = c;
      }
      out.push((a + b) / 2);
    }
    prev = v;
  }
  return out;
}

// --- Angular part ------------------------------------------------------------------------------

/** Associated Legendre P_l^m(x) for m ≥ 0, without the Condon–Shortley phase. */
export function legendre(l: number, m: number, x: number, s = Math.sqrt(Math.max(0, 1 - x * x))): number {
  let pmm = 1;
  for (let i = 1; i <= m; i++) pmm *= (2 * i - 1) * s;
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pl = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pl = (x * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pm1;
    pm1 = pl;
  }
  return pl;
}

/** Normalisation N_lm = √[(2l+1)/(4π) · (l−|m|)!/(l+|m|)!]. */
export function harmonicNorm(l: number, m: number): number {
  const a = Math.abs(m);
  return Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (factorial(l - a) / factorial(l + a)));
}

export type OrbitalKind = "real" | "complex";

/**
 * Names of the real orbitals of a subshell, by m: m > 0 ∝ cos(mφ), m < 0 ∝ sin(|m|φ). So p_x is
 * m = +1, p_y is m = −1 and p_z is m = 0, as in most chemistry texts.
 */
export const REAL_NAMES: Readonly<Record<number, Readonly<Record<number, string>>>> = {
  0: { 0: "s" },
  1: { [-1]: "y", 0: "z", 1: "x" },
  2: { [-2]: "xy", [-1]: "yz", 0: "z²", 1: "xz", 2: "x²−y²" },
  3: { [-3]: "y(3x²−y²)", [-2]: "xyz", [-1]: "yz²", 0: "z³", 1: "xz²", 2: "z(x²−y²)", 3: "x(x²−3y²)" },
};

/** "3d_z²", "2p_x", or "4f, m = −2" for the complex orbitals. */
export function orbitalName(n: number, l: number, m: number, kind: OrbitalKind): string {
  const base = `${n}${L_LETTER[l]}`;
  if (l === 0) return base;
  if (kind === "complex") return `${base}, m = ${m < 0 ? "−" : m > 0 ? "+" : ""}${Math.abs(m)}`;
  return `${base}${REAL_NAMES[l]?.[m] ? `_${REAL_NAMES[l]?.[m]}` : `, m = ${m}`}`;
}

/** Angular factor of the real orbital (l, m) at the point (x, y, z) with r = |(x, y, z)| > 0. */
export function realHarmonic(l: number, m: number, x: number, y: number, z: number, r: number): number {
  const a = Math.abs(m);
  const cosT = z / r;
  // (x + iy)^|m| / r^|m| = sin^|m|θ · e^(i|m|φ); the Legendre recursion then needs sinθ only as that factor.
  let re = 1;
  let im = 0;
  for (let i = 0; i < a; i++) {
    const nr = re * x - im * y;
    im = re * y + im * x;
    re = nr;
  }
  const rm = r ** a;
  re /= rm;
  im /= rm;
  // P_l^a(cosθ) / sin^aθ, so the sin^a factor is carried by (re, im).
  const p = legendre(l, a, cosT, 1);
  const n = harmonicNorm(l, m);
  if (m === 0) return n * p;
  return Math.SQRT2 * n * p * (m > 0 ? re : im);
}

/** |Y_l^m| and the phase of Y_l^m (complex orbital, Condon–Shortley convention) at (x, y, z). */
export function complexHarmonic(
  l: number,
  m: number,
  x: number,
  y: number,
  z: number,
  r: number,
): { magnitude: number; phase: number } {
  const a = Math.abs(m);
  const rho = Math.hypot(x, y);
  const sinT = rho / r;
  const p = legendre(l, a, z / r, sinT);
  const value = harmonicNorm(l, m) * p;
  // Condon–Shortley: (−1)^m for m > 0; Y_l^(−m) = (−1)^m conj(Y_l^m).
  const sign = m > 0 && m % 2 === 1 ? -1 : 1;
  const phi = rho > 0 ? Math.atan2(y, x) : 0;
  let phase = m * phi + (sign * value < 0 ? Math.PI : 0);
  phase = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { magnitude: Math.abs(value), phase };
}

/** ψ of a real hydrogenic orbital at (x, y, z), lengths in a₀. */
export function realOrbital(n: number, l: number, m: number, z: number, x: number, y: number, zz: number): number {
  const r = Math.sqrt(x * x + y * y + zz * zz);
  if (r === 0) return l === 0 ? radial(n, 0, z, 0) * harmonicNorm(0, 0) : 0;
  return radial(n, l, z, r) * realHarmonic(l, m, x, y, zz, r);
}

// --- Fast evaluators for grid loops (constants computed once per orbital) ----------------------

/**
 * The angular factor of the real orbital (l, m) as a function of (x, y, z, r). Same values as
 * realHarmonic, with the normalisation and Legendre coefficients computed once.
 */
export function realHarmonicFunction(l: number, m: number): (x: number, y: number, z: number, r: number) => number {
  const a = Math.abs(m);
  const n = (m === 0 ? 1 : Math.SQRT2) * harmonicNorm(l, m);
  return (x, y, z, r) => {
    let re = 1;
    let im = 0;
    for (let i = 0; i < a; i++) {
      const nr = re * x - im * y;
      im = re * y + im * x;
      re = nr;
    }
    const inv = 1 / r;
    let scale = 1;
    for (let i = 0; i < a; i++) scale *= inv;
    const p = legendre(l, a, z * inv, 1);
    return n * p * (m === 0 ? 1 : (m > 0 ? re : im) * scale);
  };
}

/** |Y_l^m| as a function of (x, y, z, r): the complex orbitals' angular magnitude (independent of φ). */
export function complexMagnitudeFunction(l: number, m: number): (x: number, y: number, z: number, r: number) => number {
  const a = Math.abs(m);
  const n = harmonicNorm(l, m);
  return (x, y, z, r) => {
    const inv = 1 / r;
    return Math.abs(n * legendre(l, a, z * inv, Math.sqrt(x * x + y * y) * inv));
  };
}
