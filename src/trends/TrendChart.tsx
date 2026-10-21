// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// "Show as chart" for a heatmap (SPEC §8.2): the property against Z (the sawtooth) and against
// group. D3 computes scales and paths; React draws the SVG. A caption says what is plotted and
// from where, and "Show as table" lists every number (SPEC §10: every chart has a table).

import { scaleLinear, scaleLog, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ElementIndexEntry, Heatmap, SourcesFile } from "../data/types";
import styles from "./TrendChart.module.css";
import { domain, formatValue, series, type SeriesPoint, type Units } from "./values";

interface Props {
  heatmap: Heatmap;
  elements: ElementIndexEntry[];
  units: Units;
  sources: SourcesFile["sources"];
}

const H = 240;
const M = { top: 12, right: 12, bottom: 34, left: 58 };
const GROUP_KEYS = ["1", "2", "f", ...Array.from({ length: 16 }, (_, i) => String(i + 3))];

export default function TrendChart({ heatmap: h, elements, units, sources }: Props) {
  const points = series(elements, h, units);
  const log = h.scale === "log";
  const [lo, hi] = domain(points, log) ?? [0, 1];
  const present = points.filter((p): p is SeriesPoint & { v: { ok: true } } => p.v.ok && (!log || p.v.value > 0));
  const unit = present[0]?.v.unit ?? "";
  const gaps = points.length - present.length;
  const [table, setTable] = useState(false);
  const captionId = useId();
  const tableId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const y = (log ? scaleLog() : scaleLinear()).domain([lo, hi === lo ? lo + 1 : hi]).range([H - M.bottom, M.top]).nice();
  const yTicks = y.ticks(log ? 4 : 5);
  const xz = scaleLinear().domain([1, 118]).range([M.left, width - M.right]);
  const xg = scalePoint<string>().domain(GROUP_KEYS).range([M.left, width - M.right]).padding(0.5);
  const sawtooth =
    line<SeriesPoint>()
      .defined((p) => p.v.ok && (!log || p.v.value > 0))
      .x((p) => xz(p.Z))
      .y((p) => (p.v.ok ? y(p.v.value) : 0))(points) ?? "";
  const sourceNames = h.sources.map((s) => sources[s]?.title ?? s).join(", ");
  const yLabel = `${h.label}${unit ? ` (${unit})` : ""}`;
  const groupKey = (p: SeriesPoint) => (p.group === null ? "f" : String(p.group));

  const axisY = (
    <g className={styles.axis}>
      {yTicks.map((t) => (
        <g key={t} transform={`translate(0 ${y(t)})`}>
          <line x1={M.left} x2={width - M.right} className={styles.grid} />
          <text x={M.left - 6} dy="0.32em" textAnchor="end">
            {formatValue(t, unit)}
          </text>
        </g>
      ))}
    </g>
  );

  return (
    <div className={styles.chart} ref={box}>
      <p id={captionId} className={styles.caption}>
        Plotted: {yLabel} against atomic number Z (top) and against group (bottom; “f” is the f-block)
        {log ? ", logarithmic axis" : ""}. Data: {sourceNames}. Hollow points are semi-empirical, theoretical
        or predicted values. {gaps > 0 ? `${gaps} elements have no value and are left out of the lines.` : "Every element has a value."}
      </p>
      <svg width={width} height={H} role="img" aria-labelledby={captionId} data-testid="trend-chart-z">
        {axisY}
        <path d={sawtooth} className={styles.line} />
        {present.map((p) => (
          <circle key={p.Z} cx={xz(p.Z)} cy={y(p.v.value)} r={2.6} className={p.v.flag && p.v.flag !== "measured" ? styles.hollow : styles.dot}>
            <title>{`${p.symbol} (Z = ${p.Z}): ${p.v.long}`}</title>
          </circle>
        ))}
        <g className={styles.axis}>
          {[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 118].map((z) => (
            <text key={z} x={xz(z)} y={H - M.bottom + 16} textAnchor="middle">
              {z}
            </text>
          ))}
          <text x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
            Atomic number Z
          </text>
        </g>
      </svg>
      <svg width={width} height={H} role="img" aria-labelledby={captionId} data-testid="trend-chart-group">
        {axisY}
        {present.map((p) => (
          <circle key={p.Z} cx={xg(groupKey(p)) ?? 0} cy={y(p.v.value)} r={3} className={p.v.flag && p.v.flag !== "measured" ? styles.hollow : styles.dot}>
            <title>{`${p.symbol} (group ${p.group ?? "f-block"}): ${p.v.long}`}</title>
          </circle>
        ))}
        <g className={styles.axis}>
          {GROUP_KEYS.map((g) => (
            <text key={g} x={xg(g) ?? 0} y={H - M.bottom + 16} textAnchor="middle">
              {g}
            </text>
          ))}
          <text x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
            Group
          </text>
        </g>
      </svg>
      <button type="button" className={styles.toggle} aria-expanded={table} aria-controls={tableId} onClick={() => setTable((t) => !t)}>
        {table ? "Hide table" : "Show as table"}
      </button>
      <div id={tableId}>
        {table && (
          <table className={styles.table}>
            <caption className="visually-hidden">{yLabel} for every element</caption>
            <thead>
              <tr>
                <th scope="col">Z</th>
                <th scope="col">Element</th>
                <th scope="col">{yLabel}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.Z}>
                  <td>{p.Z}</td>
                  <th scope="row">{p.symbol}</th>
                  <td>{p.v.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
