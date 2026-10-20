// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// What the active overlay shows, in words (SPEC §8): the arrow trend's cause and exceptions, the
// heatmap's colour scale and gaps, the map's classes. Every overlay names its sources.

import { type CSSProperties, lazy, Suspense, useId, useState } from "react";
import type { ElementIndexEntry, SourcesFile, TrendArrow } from "../data/types";
import { SourceChip } from "../ui/Quantity";
import { arrowText } from "./TrendArrows";
import styles from "./TrendLegend.module.css";
import type { ActiveOverlay } from "./useOverlay";
import type { Units } from "./values";

const TrendChart = lazy(() => import("./TrendChart"));

const GLYPH: Record<TrendArrow["axis"], Record<TrendArrow["direction"], string>> = {
  across: { increases: "→", decreases: "←", "about constant": "↔" },
  down: { increases: "↓", decreases: "↑", "about constant": "↕" },
};

interface Props {
  active: ActiveOverlay;
  elements: ElementIndexEntry[];
  sources: SourcesFile["sources"];
  units: Units;
}

export function TrendLegend({ active, elements, sources, units }: Props) {
  const headingId = useId();
  const [chart, setChart] = useState(false);
  const chartId = useId();

  if (active.kind === "arrows") {
    const t = active.trend;
    return (
      <section className={styles.legend} aria-labelledby={headingId} data-testid="trend-legend">
        <h2 id={headingId} className={styles.title}>
          Trend: {t.label}
        </h2>
        <ul className={styles.arrows}>
          {t.arrows.map((a, i) => (
            <li key={i}>
              <span aria-hidden="true">{GLYPH[a.axis][a.direction]}</span> {arrowText(a, t.label)}
            </li>
          ))}
        </ul>
        <p className={styles.caption}>{t.cause}</p>
        {t.exceptions.length > 0 && (
          <>
            <h3 className={styles.subtitle}>Notable exceptions (numbered on the table)</h3>
            <ol className={styles.exceptions}>
              {t.exceptions.map((ex) => (
                <li key={ex.symbols.join()}>
                  <b>{ex.symbols.join(", ")}</b> — {ex.note}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className={styles.small}>
          The arrows on the table point the way the property grows. This is a qualitative summary in the project's
          own drawing; a heatmap of the same property, where one exists, shows the measured values.
        </p>
      </section>
    );
  }

  if (active.kind === "heat") {
    const { heatmap: h, legend } = active;
    return (
      <section className={styles.legend} aria-labelledby={headingId} data-testid="trend-legend">
        <h2 id={headingId} className={styles.title}>
          Heatmap: {h.label}
          {legend.unit ? ` (${legend.unit})` : ""}
        </h2>
        <div className={styles.scale} aria-hidden="true">
          <div className={styles.bar} style={{ background: legend.gradient }} />
          <div className={styles.ticks}>
            {legend.ticks.map((t) => (
              <span key={t.text} style={{ "--at": t.at } as CSSProperties}>
                {t.text}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.range}>
          From {legend.min} to {legend.max}
          {legend.unit ? ` ${legend.unit}` : ""}
          {legend.log ? ", on a logarithmic scale" : ""}; dark is low, bright is high. The value is printed on each
          tile large enough to hold it.
        </p>
        {legend.missing > 0 && (
          <p className={styles.missing}>
            <span className={styles.hatch} aria-hidden="true" /> Hatched: no value ({legend.missing} elements). Each
            such tile names the reason; hover or focus it for details.
          </p>
        )}
        <p className={styles.caption}>
          {h.caption}{" "}
          {h.sources.map((s) => (
            <SourceChip key={s} id={s} sources={sources} />
          ))}
        </p>
        <button type="button" className={styles.chartButton} aria-expanded={chart} aria-controls={chartId} onClick={() => setChart((c) => !c)}>
          {chart ? "Hide chart" : "Show as chart"}
        </button>
        <div id={chartId}>
          {chart && (
            <Suspense fallback={<p className={styles.small}>Loading the chart…</p>}>
              <TrendChart heatmap={h} elements={elements} units={units} sources={sources} />
            </Suspense>
          )}
        </div>
      </section>
    );
  }

  const { map, counts } = active;
  return (
    <section className={styles.legend} aria-labelledby={headingId} data-testid="trend-legend">
      <h2 id={headingId} className={styles.title}>
        Map: {map.label}
      </h2>
      <ul className={styles.classes}>
        {map.classes.map((c) => (
          <li key={c.id}>
            <span className={styles.swatch} style={{ background: `var(--map-${c.tone})` }} aria-hidden="true">
              {c.short}
            </span>
            <span>
              <b>{c.label}</b> ({counts[c.id] ?? 0}) — {c.description}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.caption}>
        {map.caption}{" "}
        {map.sources.map((s) => (
          <SourceChip key={s} id={s} sources={sources} />
        ))}
      </p>
    </section>
  );
}
