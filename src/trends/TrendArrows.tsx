// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Arrow trends (SPEC §8.1), redrawn in the project's style: an arrow along the period axis above
// the table and one along the group axis beside it, pointing the way the property grows, plus
// numbered markers on the notable exceptions. Only the two standard layouts have these axes.
// The trend legend below the table says the same in words, so this drawing is hidden from
// screen readers.

import { useLayoutEffect, useState } from "react";
import type { ArrowTrend, ElementIndexEntry, LayoutVariant, TrendArrow } from "../data/types";
import styles from "./TrendArrows.module.css";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Geometry {
  width: number;
  height: number;
  body: Box;
  room: number;
  top: number;
  left: number;
  tiles: Map<number, Box>;
}

interface Props {
  trend: ArrowTrend;
  variant: LayoutVariant;
  elements: ElementIndexEntry[];
  /** Re-measure when any of these change. */
  deps: unknown[];
}

function measure(content: HTMLElement, variant: LayoutVariant): Geometry | null {
  const grid = content.querySelector<HTMLElement>("[data-table-grid]");
  if (!grid) return null;
  const tiles = new Map<number, Box>();
  for (const el of grid.querySelectorAll<HTMLElement>("[data-z]")) {
    tiles.set(Number(el.dataset.z), { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  }
  // The main body is everything down to francium's row; the detached f-block rows sit below it.
  const lastRow = variant.cells["87"]?.row ?? Infinity;
  const body = [...tiles].filter(([z]) => (variant.cells[String(z)]?.row ?? Infinity) <= lastRow).map(([, b]) => b);
  if (!body.length) return null;
  const x0 = Math.min(...body.map((b) => b.x));
  const x1 = Math.max(...body.map((b) => b.x + b.w));
  const y0 = Math.min(...body.map((b) => b.y));
  const y1 = Math.max(...body.map((b) => b.y + b.h));
  const room = parseFloat(getComputedStyle(grid).paddingTop) || 40;
  return {
    width: content.scrollWidth,
    height: content.scrollHeight,
    body: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    room,
    top: grid.offsetTop,
    left: grid.offsetLeft,
    tiles,
  };
}

const WORD: Record<TrendArrow["direction"], string> = {
  increases: "increases",
  decreases: "decreases",
  "about constant": "about constant",
};

export function TrendArrows({ trend, variant, elements, deps }: Props) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const host = svg?.parentElement;
    if (!host) return;
    const update = () => setGeo(measure(host, variant));
    update();
    const ro = new ResizeObserver(update);
    const grid = host.querySelector("[data-table-grid]");
    if (grid) ro.observe(grid);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's re-measure triggers
  }, [svg, variant, ...deps]);

  const bySymbol = new Map(elements.map((e) => [e.symbol, e.Z]));

  return (
    <svg
      ref={setSvg}
      className={styles.svg}
      aria-hidden="true"
      data-testid="trend-arrows"
      width={geo?.width ?? 0}
      height={geo?.height ?? 0}
    >
      <defs>
        <marker id="trend-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className={styles.head} />
        </marker>
      </defs>
      {geo && trend.arrows.map((a, i) => <Arrow key={i} arrow={a} geo={geo} name={trend.label} />)}
      {geo &&
        trend.exceptions.flatMap((ex, i) =>
          ex.symbols.map((s) => {
            const t = geo.tiles.get(bySymbol.get(s) ?? -1);
            if (!t) return null;
            const r = Math.max(6, Math.min(9, t.w / 6));
            return (
              <g key={`${i}-${s}`} className={styles.marker} transform={`translate(${t.x + t.w - r - 1} ${t.y + r + 1})`}>
                <circle r={r} />
                <text dy="0.35em">{i + 1}</text>
              </g>
            );
          }),
        )}
    </svg>
  );
}

/** "First ionization energy increases across a period"; "metals: increases down a group". */
export function arrowText(arrow: TrendArrow, name: string): string {
  const word = arrow.region === "all" && arrow.label ? arrow.label : WORD[arrow.direction];
  const axis = arrow.axis === "across" ? "across a period" : "down a group";
  if (arrow.region !== "all") return `${arrow.label ?? arrow.region}: ${word} ${axis}`;
  return arrow.axis === "across" ? `${name} ${word} ${axis}` : `${word} ${axis}`;
}

function Arrow({ arrow, geo, name }: { arrow: TrendArrow; geo: Geometry; name: string }) {
  const { body, room, top, left } = geo;
  const flat = arrow.direction === "about constant";
  const reverse = arrow.direction === "decreases";
  if (arrow.axis === "across") {
    const y = top + room * 0.62;
    const [xa, xb] = [body.x + 4, body.x + body.w - 4];
    return (
      <g className={styles.arrow} data-axis="across" data-direction={arrow.direction}>
        <line
          x1={reverse ? xb : xa}
          x2={reverse ? xa : xb}
          y1={y}
          y2={y}
          markerEnd={flat ? undefined : "url(#trend-head)"}
          strokeDasharray={flat ? "6 5" : undefined}
        />
        {flat && <path d={`M ${xa} ${y - 6} v 12 M ${xb} ${y - 6} v 12`} />}
        <text x={body.x + body.w / 2} y={y - 8} textAnchor="middle">
          {arrowText(arrow, name)}
        </text>
      </g>
    );
  }
  const x = arrow.region === "nonmetals" ? body.x + body.w + room * 0.5 : left + room * 0.6;
  const [ya, yb] = [body.y + 4, body.y + body.h - 4];
  const cy = body.y + body.h / 2;
  return (
    <g className={styles.arrow} data-axis="down" data-direction={arrow.direction}>
      <line
        x1={x}
        x2={x}
        y1={reverse ? yb : ya}
        y2={reverse ? ya : yb}
        markerEnd={flat ? undefined : "url(#trend-head)"}
        strokeDasharray={flat ? "6 5" : undefined}
      />
      {flat && <path d={`M ${x - 6} ${ya} h 12 M ${x - 6} ${yb} h 12`} />}
      <text transform={`translate(${x - 8} ${cy}) rotate(-90)`} textAnchor="middle">
        {arrowText(arrow, name)}
      </text>
    </g>
  );
}
