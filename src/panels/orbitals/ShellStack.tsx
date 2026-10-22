// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The shell stack (SPEC §10.1): every occupied radial distribution P(r) = r²R² on one radius axis, at
// true relative scale, so one can see that 4f sits inside 6s in the lanthanides. Each curve holds one
// electron (area 1). On the log-r option the curve drawn is r·P(r), the probability per unit of ln r,
// so areas still compare. Markers for the chosen subshell's ⟨r⟩ and most probable radius, and the
// element's covalent and van der Waals radii for comparison.

import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { useId, useMemo, useState } from "react";
import { isMissing, MISSING_TEXT } from "../../data/format";
import type { ElementIndexEntry, Q } from "../../data/types";
import { radialDistribution } from "../../physics/hydrogenic";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { A0_PM, type SubshellInfo } from "./model";
import styles from "./orbitals.module.css";

/** Dash pattern and colour per l, so no curve is told apart by colour alone. */
const DASH = ["", "7 3", "2 2.5", "9 3 2 3", "4 4"];
const STROKE = ["var(--block-s)", "var(--block-p)", "var(--block-d)", "var(--block-f)", "var(--text-muted)"];
const SAMPLES = 320;

interface Curve {
  s: SubshellInfo;
  points: Array<[number, number]>;
  peak: [number, number];
}

function sample(s: SubshellInfo, log: boolean): Curve {
  const z = s.zeff.value;
  // Each curve on its own range, so tight inner shells are drawn as finely as the valence shell.
  const hi = (s.meanPm + 6 * s.spreadPm) / A0_PM;
  const lo = log ? s.meanPm / A0_PM / 60 : 0;
  const points: Array<[number, number]> = [];
  let peak: [number, number] = [0, 0];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const r = log ? lo * (hi / lo) ** t : hi * t;
    const p = radialDistribution(s.n, s.l, z, r);
    // P(r) per pm on the linear axis; r·P(r) (dimensionless) on the log axis.
    const y = log ? r * p : p / A0_PM;
    const x = r * A0_PM;
    points.push([x, y]);
    if (y > peak[1]) peak = [x, y];
  }
  return { s, points, peak };
}

const radiusValue = (q: Q) => (isMissing(q) ? null : q.value);
const radiusText = (q: Q) =>
  isMissing(q) ? `${MISSING_TEXT[q.reason].long}${q.note ? ` (${q.note.replace(/\.$/, "")})` : ""}` : `${q.value} pm`;

export function ShellStack({
  element,
  list,
  selected,
  radii,
}: {
  element: ElementIndexEntry;
  list: SubshellInfo[];
  selected: SubshellInfo | undefined;
  radii: { covalent: Q; vdw: Q };
}) {
  const [log, setLog] = useState(element.Z > 20);
  const clipId = useId();
  const curves = useMemo(() => list.map((s) => sample(s, log)), [list, log]);
  const covalent = radiusValue(radii.covalent);
  const vdw = radiusValue(radii.vdw);
  const focus = curves.filter((c) => c.s.valence || c.s === selected);
  const tallest = Math.max(...curves.map((c) => c.peak[1]));
  // On the linear axis the inner shells are far taller than the valence shell; the y scale follows the
  // valence and chosen curves and the taller ones are cut off at the top (with their height noted).
  const yMax = log ? tallest * 1.1 : Math.max(...focus.map((c) => c.peak[1]), 1e-9) * 1.25;
  const clipped = log ? [] : curves.filter((c) => c.peak[1] > yMax);
  const rOuter = Math.max(...list.map((s) => s.meanPm + 3 * s.spreadPm), vdw ?? 0, covalent ?? 0) * 1.08;
  const rInner = Math.min(...list.map((s) => s.meanPm / 30));

  const caption = (
    <>
      Radial probability of one electron in each occupied subshell of {element.name}:{" "}
      {log ? (
        <>r·P(r) against r on a logarithmic axis (equal areas are equal probabilities)</>
      ) : (
        <>P(r) = r²R²(r) against r</>
      )}
      . Hydrogenic with the effective charges in the table below; radii in pm. The line style shows l (s solid, p
      dashed, d dotted, f dash-dot) and each curve is labelled.
      {clipped.length > 0 && <> The inner shells reach above the top of the chart; their peak heights are in the table.</>}
      {selected && (
        <>
          {" "}
          Dashed lines mark the mean radius ⟨r⟩ of {selected.label} ({selected.meanPm.toFixed(1)} pm) and its most probable
          radius r* ({selected.mostProbablePm.toFixed(1)} pm); dotted lines mark the measured radii.
        </>
      )}{" "}
      Covalent radius: {radiusText(radii.covalent)}; van der Waals radius: {radiusText(radii.vdw)}.
    </>
  );

  const table = {
    columns: ["Subshell", "Electrons", "⟨r⟩ (pm)", "Most probable r (pm)", log ? "Peak of r·P(r)" : "Peak of P(r) (1/pm)"],
    rows: curves.map((c) => ({
      key: `${c.s.n},${c.s.l}`,
      cells: [
        c.s.label,
        c.s.occupancy,
        c.s.meanPm.toFixed(1),
        c.s.mostProbablePm.toFixed(1),
        c.peak[1].toPrecision(3),
      ],
    })),
  };

  return (
    <div>
      <div className={styles.axisToggle} role="group" aria-label="Radius axis">
        <button type="button" aria-pressed={!log} onClick={() => setLog(false)}>
          Linear r
        </button>
        <button type="button" aria-pressed={log} onClick={() => setLog(true)}>
          Logarithmic r
        </button>
      </div>
      <ChartFrame caption={caption} table={table} testId="shell-stack">
        {({ width, captionId }) => {
          const H = 280;
          // Two label rows above the plot: the comparison radii, then the chosen subshell's markers.
          const M = { top: 44, right: 16, bottom: 38, left: 52 };
          const x = log
            ? scaleLog().domain([rInner, rOuter]).range([M.left, width - M.right]).clamp(true)
            : scaleLinear().domain([0, rOuter]).range([M.left, width - M.right]).clamp(true);
          const y = scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top]);
          const path = line<[number, number]>()
            .x((p) => x(Math.max(p[0], log ? rInner : 0)))
            .y((p) => y(p[1]));
          const xTicks = log ? x.ticks().filter((t) => Number.isInteger(Math.log10(t))) : x.ticks(6);
          // Labels at each peak, nudged upward where they would overlap.
          const placed: Array<{ c: Curve; lx: number; ly: number }> = [];
          for (const c of [...curves].sort((a, b) => a.peak[0] - b.peak[0])) {
            const lx = x(c.peak[0]);
            let ly = Math.max(M.top + 12, y(Math.min(c.peak[1], yMax)) - 5);
            for (const p of placed) {
              if (Math.abs(p.lx - lx) < 22 && Math.abs(p.ly - ly) < 11) ly = p.ly - 11;
            }
            placed.push({ c, lx, ly: Math.max(M.top - 2, ly) });
          }
          const lane = (items: Array<{ key: string; r: number; text: string }>, yText: number, cls: string) => {
            const sorted = [...items].sort((p, q) => p.r - q.r);
            return sorted.map((it, i) => {
              const px = x(it.r);
              // Two labels close together go either side of their lines.
              const next = sorted[i + 1];
              const prev = sorted[i - 1];
              const left = next !== undefined && x(next.r) - px < 90;
              const right = prev !== undefined && px - x(prev.r) < 90;
              const anchor = left ? "end" : right ? "start" : "middle";
              const dx = left ? -4 : right ? 4 : 0;
              return (
                <text key={it.key} className={`${viz.label} ${cls}`} x={px + dx} y={yText} textAnchor={anchor}>
                  {it.text}
                </text>
              );
            });
          };
          const comparison = [
            ...(covalent !== null ? [{ key: "cov", r: covalent, text: "covalent" }] : []),
            ...(vdw !== null ? [{ key: "vdw", r: vdw, text: "van der Waals" }] : []),
          ];
          const own = selected
            ? [
                { key: "mean", r: selected.meanPm, text: `⟨r⟩ ${selected.label}` },
                { key: "peak", r: selected.mostProbablePm, text: `r* ${selected.label}` },
              ]
            : [];
          return (
            <svg width={width} height={H} role="img" aria-labelledby={captionId}>
              <defs>
                <clipPath id={clipId}>
                  <rect x={M.left} y={M.top} width={width - M.left - M.right} height={H - M.top - M.bottom} />
                </clipPath>
              </defs>
              <g className={viz.axis}>
                {xTicks.map((t) => (
                  <g key={t} transform={`translate(${x(t)} 0)`}>
                    <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                    <text y={H - M.bottom + 16} textAnchor="middle">
                      {t}
                    </text>
                  </g>
                ))}
                <line x1={M.left} x2={width - M.right} y1={H - M.bottom} y2={H - M.bottom} className={styles.baseline} />
              </g>
              <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
                r (pm{log ? ", log scale" : ""})
              </text>
              <text className={viz.axisTitle} transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
                {log ? "r·P(r)" : "P(r) (1/pm)"}
              </text>
              <g className={styles.radiusMark}>
                {comparison.map((c) => (
                  <line key={c.key} x1={x(c.r)} x2={x(c.r)} y1={18} y2={H - M.bottom} />
                ))}
                {lane(comparison, 14, "")}
              </g>
              <g clipPath={`url(#${clipId})`}>
                {curves.map((c) => (
                  <path
                    key={`${c.s.n},${c.s.l}`}
                    d={path(c.points) ?? ""}
                    className={styles.curve}
                    data-selected={c.s === selected || undefined}
                    data-valence={c.s.valence || undefined}
                    style={{ stroke: STROKE[c.s.l] ?? STROKE[4], strokeDasharray: DASH[c.s.l] ?? DASH[4] }}
                  />
                ))}
              </g>
              <g className={styles.selectedMarks}>
                {own.map((o) => (
                  <line key={o.key} x1={x(o.r)} x2={x(o.r)} y1={34} y2={H - M.bottom} />
                ))}
                {lane(own, 30, styles.ownLabel ?? "")}
              </g>
              {placed.map(({ c, lx, ly }) => (
                <text
                  key={`${c.s.n},${c.s.l}`}
                  className={styles.curveLabel}
                  data-selected={c.s === selected || undefined}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                >
                  {c.s.label}
                  {!log && c.peak[1] > yMax ? "↑" : ""}
                </text>
              ))}
            </svg>
          );
        }}
      </ChartFrame>
    </div>
  );
}
