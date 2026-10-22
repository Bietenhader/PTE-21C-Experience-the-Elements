// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Quantity helpers and number formatting. NIST concise notation: 1 420 405 751.768(2) Hz.

import type { Interval, Missing, MissingReason, Quantity } from "./types";

/** Narrow no-break space: the SI digit-group separator. */
export const NNBSP = " ";
export const MINUS = "−";

export function isMissing(x: unknown): x is Missing {
  return typeof x === "object" && x !== null && (x as Missing).missing === true;
}

export function isInterval(x: unknown): x is Interval {
  return typeof x === "object" && x !== null && "low" in x && "high" in x;
}

export function isQuantity(x: unknown): x is Quantity {
  return typeof x === "object" && x !== null && typeof (x as Quantity).value === "number";
}

/** Group digits in threes, SI style: integer part when ≥ 5 digits, fraction when ≥ 5 decimals. */
export function groupDigits(text: string): string {
  const sign = text.startsWith("-") ? MINUS : "";
  const [intPart = "", frac] = text.replace(/^-/, "").split(".");
  const int = intPart.length >= 5 ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) : intPart;
  if (frac === undefined) return sign + int;
  const f = frac.length >= 5 ? (frac.match(/\d{1,3}/g) ?? []).join(NNBSP) : frac;
  return `${sign}${int}.${f}`;
}

/**
 * Value with its standard uncertainty in concise notation: (55.845, 0.002) → "55.845(2)".
 * No uncertainty → the value as given; uncertainty 0 → the exact value.
 */
export function concise(value: number, unc?: number): string {
  if (unc === undefined || unc === 0) return groupDigits(shortest(value));
  const [mantissa = "", expText = "0"] = unc.toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const lastDigitExp = Number(expText) - (digits.length - 1);
  if (lastDigitExp >= 3 && Math.abs(value) >= 1e12) {
    // 2 020 407 384 335 000(2000) reads better as 2.020 407 384 335(2) × 10¹⁵
    const exp = Math.floor(Math.log10(Math.abs(value)));
    return `${groupDigits((value / 10 ** exp).toFixed(exp - lastDigitExp))}(${digits})${NNBSP}×${NNBSP}10${superscriptDigits(exp)}`;
  }
  if (lastDigitExp >= 0) {
    return `${groupDigits(value.toFixed(0))}(${unc.toFixed(0)})`;
  }
  return `${groupDigits(value.toFixed(-lastDigitExp))}(${digits})`;
}

/** Shortest decimal (no exponent) that round-trips, e.g. 9192631770 → "9192631770". */
export function shortest(value: number): string {
  const s = String(value);
  if (!s.includes("e")) return s;
  return value.toFixed(Math.max(0, -Math.floor(Math.log10(Math.abs(value))) + 15)).replace(/\.?0+$/, "");
}

export function formatQuantity(q: Quantity): string {
  const body = concise(q.value, q.unc);
  const exact = q.unc === 0 ? " (exact)" : "";
  return q.unit ? `${body} ${q.unit}${exact}` : `${body}${exact}`;
}

/** Rounded for the tile: at most `decimals` decimals, trailing zeros trimmed. */
export function tileNumber(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  const trimmed = s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  return trimmed.replace(/^-/, MINUS);
}

export function signed(state: number): string {
  if (state > 0) return `+${state}`;
  if (state < 0) return `${MINUS}${-state}`;
  return "0";
}

export function fraction(x: number): string {
  return Number.isInteger(x) ? String(x) : `${Math.round(2 * x)}/2`;
}

export const MISSING_TEXT: Record<MissingReason, { short: string; long: string }> = {
  not_measured: { short: "n/m", long: "not measured" },
  not_applicable: { short: "n/a", long: "not applicable" },
  no_stable_isotope: { short: "no stable isotope", long: "no stable isotope" },
  predicted_only: { short: "pred. only", long: "only theoretical predictions exist" },
  source_unavailable_at_build: { short: "src n/a", long: "source unavailable when the data was built" },
};

export function describeMissing(m: Missing): string {
  const base = MISSING_TEXT[m.reason].long;
  return m.note ? `${base[0]?.toUpperCase()}${base.slice(1)}. ${m.note}` : base;
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function superscriptDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)] ?? d);
}
