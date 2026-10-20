// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The numbers behind heatmaps and charts (SPEC §8.2): which value an element has for a heatmap
// field, in the unit chosen in Settings, and how it reads on a tile and to a screen reader.
// Pure: no colour, no DOM. Missing values stay Missing, with their reason, all the way to the tile.

import { MINUS, MISSING_TEXT, describeMissing, isInterval, isMissing, superscriptDigits } from "../data/format";
import type { ElementIndexEntry, Heatmap, Missing, Quantity, Unit } from "../data/types";
import { zAlpha } from "../physics/relativity";
import { convertEnergy, convertTemperature, type EnergyUnit, type TemperatureUnit } from "../physics/units";

export interface Units {
  energy: EnergyUnit;
  temperature: TemperatureUnit;
}

export interface Present {
  ok: true;
  /** Value in the display unit. */
  value: number;
  unit: string;
  /** NIST-style marker: interpolated values in [ ], calculated in ( ). */
  flag?: Quantity["flag"];
  source: string;
  note?: string;
  /** Short text for the tile. */
  text: string;
  /** Full sentence for screen readers and tooltips. */
  long: string;
}

export interface Absent {
  ok: false;
  missing: Missing;
  text: string;
  long: string;
}

export type HeatValue = Present | Absent;

export interface SeriesPoint {
  Z: number;
  symbol: string;
  group: number | null;
  period: number;
  v: HeatValue;
}

const COMPUTED: Record<string, (e: ElementIndexEntry) => Quantity> = {
  zAlpha: (e) => ({
    value: zAlpha(e.Z),
    unit: "",
    source: "nist_codata",
    flag: "calculated",
    note: "hydrogenic estimate v/c = Zα",
  }),
};

/** The raw stored quantity for a heatmap field, before unit conversion. */
export function rawQuantity(e: ElementIndexEntry, field: string): Quantity | Missing {
  if (field.startsWith("computed:")) {
    const fn = COMPUTED[field.slice("computed:".length)];
    if (!fn) throw new Error(`unknown computed heatmap field ${field}`);
    return fn(e);
  }
  const q = (e as unknown as Record<string, unknown>)[field];
  if (isMissing(q)) return q;
  if (isInterval(q)) {
    // Interval atomic weights: IUPAC's abridged single value stands in (the caption says so).
    if (q.conventional) return q.conventional;
    return { value: (q.low + q.high) / 2, unit: q.unit, source: q.source, note: "midpoint of the interval" };
  }
  if (typeof q === "object" && q !== null && typeof (q as Quantity).value === "number") return q as Quantity;
  throw new Error(`heatmap field ${field} is not a quantity`);
}

function display(q: Quantity, h: Heatmap, units: Units): { value: number; unit: string } {
  if (h.quantity === "energy") {
    if (q.unit !== "kJ/mol" && q.unit !== "eV") throw new Error(`energy heatmap ${h.id} has unit ${q.unit}`);
    return { value: convertEnergy(q.value, q.unit, units.energy), unit: units.energy };
  }
  if (h.quantity === "temperature") {
    if (q.unit !== "K") throw new Error(`temperature heatmap ${h.id} has unit ${q.unit}`);
    return { value: convertTemperature(q.value, units.temperature), unit: units.temperature };
  }
  return { value: q.value, unit: q.unit };
}

export function heatValue(e: ElementIndexEntry, h: Heatmap, units: Units): HeatValue {
  const q = rawQuantity(e, h.field);
  if (isMissing(q)) {
    return { ok: false, missing: q, text: MISSING_TEXT[q.reason].short, long: `${h.label}: ${describeMissing(q)}` };
  }
  const { value, unit } = display(q, h, units);
  let text = formatValue(value, unit as Unit | EnergyUnit | TemperatureUnit);
  if (q.flag === "interpolated") text = `[${text}]`;
  if (q.flag === "calculated" && !h.field.startsWith("computed:")) text = `(${text})`;
  const flagWord = q.flag && q.flag !== "measured" ? `, ${q.flag}` : "";
  const long = `${h.label}: ${formatLong(value, unit)}${flagWord}${q.note ? ` (${q.note})` : ""}`;
  return { ok: true, value, unit, flag: q.flag, source: q.source, note: q.note, text, long };
}

export function series(elements: ElementIndexEntry[], h: Heatmap, units: Units): SeriesPoint[] {
  return elements.map((e) => ({ Z: e.Z, symbol: e.symbol, group: e.group, period: e.period, v: heatValue(e, h, units) }));
}

/** Smallest and largest present value; null when nothing is present. */
export function domain(points: SeriesPoint[], positiveOnly = false): [number, number] | null {
  const vs = points.flatMap((p) => (p.v.ok && (!positiveOnly || p.v.value > 0) ? [p.v.value] : []));
  if (!vs.length) return null;
  return [Math.min(...vs), Math.max(...vs)];
}

// --- Number formatting for tiles -----------------------------------------------------------

const JULIAN_YEAR_S = 365.25 * 86400;

/** A duration in seconds in the most readable unit: 0.58 ms, 3.8 d, 4.47 Ga. */
export function formatDuration(seconds: number): string {
  const steps: Array<[number, string]> = [
    [1e-6, "µs"],
    [1e-3, "ms"],
    [1, "s"],
    [60, "min"],
    [3600, "h"],
    [86400, "d"],
    [JULIAN_YEAR_S, "a"],
    [1e3 * JULIAN_YEAR_S, "ka"],
    [1e6 * JULIAN_YEAR_S, "Ma"],
    [1e9 * JULIAN_YEAR_S, "Ga"],
  ];
  const abs = Math.abs(seconds);
  if (abs >= 1e12 * JULIAN_YEAR_S) return `${scientific(seconds / JULIAN_YEAR_S, 2)} a`;
  if (abs < 1e-6) return `${scientific(seconds, 2)} s`;
  let chosen: [number, string] = steps[0] ?? [1, "s"];
  for (const step of steps) if (abs >= step[0]) chosen = step;
  return `${significant(seconds / chosen[0], 3)} ${chosen[1]}`;
}

/** n significant figures, no exponent, trailing zeros trimmed, typographic minus. */
export function significant(value: number, n: number): string {
  if (value === 0) return "0";
  const s = Number(value.toPrecision(n));
  const digits = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(s))));
  return s
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")
    .replace(/^-/, MINUS);
}

/** 9.0·10⁻⁵ style. */
export function scientific(value: number, n: number): string {
  const [m = "0", e = "0"] = value.toExponential(n - 1).split("e");
  const exp = Number(e);
  return `${m.replace(/^-/, MINUS)}·10${exp < 0 ? "⁻" : ""}${superscriptDigits(Math.abs(exp))}`;
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.01 || abs >= 1e5)) return scientific(value, 2);
  return significant(value, 3);
}

/** Tile text for a value in its display unit. */
export function formatValue(value: number, unit: string): string {
  switch (unit) {
    case "kJ/mol":
    case "K":
    case "°C":
    case "pm":
      return significant(Math.round(value), 6);
    case "eV":
      return significant(Number(value.toFixed(2)), 6);
    case "s":
      return formatDuration(value);
    case "":
      return Number.isInteger(value) ? String(value) : significant(value, 3);
    default:
      return compact(value);
  }
}

function formatLong(value: number, unit: string): string {
  if (unit === "s") return `${formatDuration(value)} (${scientific(value, 3)} s)`;
  const text = unit === "" && Number.isInteger(value) ? String(value) : significant(value, 4);
  return unit ? `${text} ${unit}` : text;
}
