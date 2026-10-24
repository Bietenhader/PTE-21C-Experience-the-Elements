// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Plants in detail (added after v0.1.0), opened from the Plants card of the biology panel: how roots take
// the element up, how it moves in the phloem, how much a well-fed shoot holds, its job in the plant and
// since when it is known to be needed; then leaf levels of a few plants as "too little, enough, too much",
// and sourced notes by topic. Every number and sentence comes from tools/curated/plants.toml, which Fin
// reviews; the leaf levels are the books' own figures for one plant and tissue each, converted to mg/kg
// by the pipeline and shown in g/kg when they reach 1000 mg/kg.

import { scaleLog } from "d3-scale";
import { type Ref, useId } from "react";
import { concise, superscriptDigits } from "../../data/format";
import type { ElementIndexEntry, PlantDetail, PlantLevel, SourcesFile } from "../../data/types";
import { fromMgPerKg, type MassFractionUnit, massFractionUnit } from "../../physics/units";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import shared from "../shared/panel.module.css";
import styles from "./biology.module.css";
import { Doi, Said } from "./said";

type Sources = SourcesFile["sources"];
type Topic = keyof NonNullable<PlantDetail["notes"]>;

const TOPICS: Array<[Topic, string]> = [
  ["deficiency", "Too little"],
  ["toxicity", "Too much"],
  ["soil", "In the soil"],
  ["partners", "Partners in the soil"],
  ["wild", "In the wild"],
  ["forest", "In forests"],
  ["food", "Crops and food"],
];
const MOBILITY: Record<NonNullable<PlantDetail["phloem"]>["mobility"], string> = {
  high: "moves readily (high mobility)",
  intermediate: "moves to some extent (intermediate mobility)",
  low: "hardly moves (low mobility)",
  variable: "depends on the species (variable mobility)",
};
// Mengel and Kirkby's four groups of plant nutrients, in our words.
const JOB: Record<number, string> = {
  1: "Built into the plant's organic matter (proteins, nucleic acids) through oxidation and reduction.",
  2: "Bound to sugars and other alcohols as esters, like the phosphate in DNA and in energy carriers.",
  3: "Works as a free ion: it balances charges and water in the cells and switches enzymes on.",
  4: "Held in enzymes, where it passes electrons on by changing its charge.",
};
const GROUP: Record<PlantLevel["group"], string> = {
  cereals: "cereal",
  legumes: "legume",
  vegetables: "vegetable",
  fruit: "fruit tree",
  conifers: "conifer",
  broadleaf: "broadleaf tree",
  other: "",
};
// Where shortage shows first, from Marschner's chapter on diagnosis (11.2.2).
const DIAGNOSIS_DOI = "10.1016/b978-0-12-819773-8.00008-3";

/** "one of the ten …" → "One of the ten ….", for a phrase shown on its own. */
const sentence = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? "" : "."}`;

function numbers(l: PlantLevel): number[] {
  return [l.deficientBelow, l.adequateLow, l.adequateHigh, l.excessAbove].filter((v): v is number => v !== undefined);
}

function Glance({ p, sources }: { p: PlantDetail; sources: Sources }) {
  const typicalUnit = p.typical ? massFractionUnit(p.typical.value) : "mg/kg";
  return (
    <dl className={shared.facts} data-testid="plant-glance">
      {p.uptake && (
        <div className={styles.fact}>
          <dt>Taken up as</dt>
          <dd>
            <Said t={p.uptake} sources={sources} />
          </dd>
        </div>
      )}
      {p.phloem && (
        <div className={styles.fact}>
          <dt>In the phloem</dt>
          <dd>
            It {MOBILITY[p.phloem.mobility]}. <SourceChip id={p.phloem.source} sources={sources} />
            <Doi doi={p.phloem.doi} />
          </dd>
        </div>
      )}
      {p.typical && (
        <div className={styles.fact}>
          <dt>A well-fed shoot holds</dt>
          <dd>
            <span className={styles.value}>
              about {concise(fromMgPerKg(p.typical.value, typicalUnit))} {typicalUnit}
            </span>{" "}
            of dry matter, enough for normal growth (an average over many plants).{" "}
            <SourceChip id={p.typical.source} sources={sources} />
            <Doi doi={p.typical.doi} />
          </dd>
        </div>
      )}
      {p.job && (
        <div className={styles.fact}>
          <dt>Its job</dt>
          <dd>
            {JOB[p.job.group]} <SourceChip id={p.job.source} sources={sources} />
            <Doi doi={p.job.doi} />
          </dd>
        </div>
      )}
      {p.known && (
        <div className={styles.fact}>
          <dt>Known to be needed</dt>
          <dd>
            {[
              p.known.year !== undefined ? `Since ${p.known.year}${p.known.by ? ` (${p.known.by})` : ""}.` : "",
              p.known.text ? sentence(p.known.text) : "",
            ]
              .filter(Boolean)
              .join(" ")}{" "}
            <SourceChip id={p.known.source} sources={sources} />
            <Doi doi={p.known.doi} />
          </dd>
        </div>
      )}
    </dl>
  );
}

function show(v: number | undefined, unit: MassFractionUnit): string {
  return v === undefined ? "" : concise(fromMgPerKg(v, unit));
}

/** The leaf levels of a few plants on one logarithmic axis: too little, enough, too much. */
function LeafLevels({ e, levels, sources }: { e: ElementIndexEntry; levels: PlantLevel[]; sources: Sources }) {
  const ids = useId().replace(/:/g, "");
  const all = levels.flatMap(numbers);
  const unit = massFractionUnit(Math.max(...all));
  const name = e.name.toLowerCase();
  const caption = (
    <>
      {e.name} in the leaves (or the tissue named) of {levels.length === 1 ? "one plant" : `${levels.length} plants`}, in{" "}
      {unit} of dry matter on a logarithmic axis: the range in which {name} does not limit growth, and the levels
      the source calls deficient or excessive. Each row is the source&apos;s own figure for one plant, sampled at
      its own stage, so the rows show how plants differ rather than one rule for all.{" "}
      {[...new Set(levels.map((l) => l.source))].map((s) => (
        <SourceChip key={s} id={s} sources={sources} />
      ))}
    </>
  );
  const table = {
    columns: ["Plant", "Tissue sampled", "Too little below", "Enough", "Too much above", "Source"],
    rows: levels.map((l) => ({
      key: `${l.group}-${l.plant}`,
      cells: [
        <>
          {l.plant}
          {GROUP[l.group] ? <span className={shared.muted}> ({GROUP[l.group]})</span> : null}
        </>,
        l.part ?? "",
        l.kind === "critical" ? `${show(l.deficientBelow, unit)} ${unit} (critical level)` : l.deficientBelow ? `${show(l.deficientBelow, unit)} ${unit}` : "",
        l.adequateLow !== undefined
          ? `${show(l.adequateLow, unit)}–${show(l.adequateHigh, unit)} ${unit}${l.kind === "normal" ? " (usual range)" : ""}`
          : "",
        l.excessAbove ? `${show(l.excessAbove, unit)} ${unit}` : "",
        <>
          <SourceChip id={l.source} sources={sources} />
          <Doi doi={l.doi} />
          {l.printedUnit !== unit && <span className={shared.muted}> Printed in {l.printedUnit}.</span>}
          {l.note && <span className={shared.muted}> {l.note}</span>}
        </>,
      ],
    })),
  };
  return (
    <ChartFrame caption={caption} table={table} testId="leaf-levels">
      {({ width, captionId }) => {
        const narrow = width < 420;
        const M = { top: 4, right: 14, bottom: 34, left: narrow ? 100 : 136 };
        const ROW = 40;
        const H = M.top + ROW * levels.length + M.bottom;
        const lo = Math.floor(Math.log10(Math.min(...all) / 2));
        const hi = Math.ceil(Math.log10(Math.max(...all) * 2));
        const x = scaleLog()
          .domain([10 ** lo, 10 ** hi])
          .range([M.left, width - M.right]);
        const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
        const tick = (n: number) => {
          const v = fromMgPerKg(10 ** n, unit);
          return v >= 0.01 && v < 1e5 ? concise(Number(v.toPrecision(1))) : `10${superscriptDigits(n - (unit === "g/kg" ? 3 : 0))}`;
        };
        return (
          <>
            <svg width={width} height={H} role="img" aria-labelledby={captionId}>
              <defs>
                <pattern id={`${ids}-low`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" className={styles.hatch} />
                </pattern>
                <pattern id={`${ids}-high`} width="6" height="6" patternUnits="userSpaceOnUse">
                  <path d="M0 0L6 6M6 0L0 6" className={styles.hatch} />
                </pattern>
              </defs>
              <g className={viz.axis}>
                {ticks.map((n) => (
                  <g key={n} transform={`translate(${x(10 ** n)} 0)`}>
                    <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                    <text y={H - M.bottom + 16} textAnchor="middle">
                      {tick(n)}
                    </text>
                  </g>
                ))}
              </g>
              <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
                {unit} of dry matter (log scale)
              </text>
              {levels.map((l, i) => {
                const y = M.top + i * ROW;
                const barY = 18;
                const barH = 14;
                const left = x.range()[0] ?? M.left;
                const right = x.range()[1] ?? width - M.right;
                const label = `${l.plant}${l.part ? `, ${l.part}` : ""}`;
                return (
                  <g key={`${l.group}-${l.plant}`} transform={`translate(0 ${y})`} data-kind={l.kind}>
                    <text className={styles.plantLabel} x={M.left - 8} y={barY + barH / 2 - 5} textAnchor="end">
                      {l.plant}
                    </text>
                    {GROUP[l.group] && (
                      <text className={viz.label} x={M.left - 8} y={barY + barH / 2 + 9} textAnchor="end">
                        {GROUP[l.group]}
                      </text>
                    )}
                    {l.deficientBelow !== undefined && (
                      <rect x={left} y={barY} width={Math.max(0, x(l.deficientBelow) - left)} height={barH} fill={`url(#${ids}-low)`}>
                        <title>{`${label}: too little below ${show(l.deficientBelow, unit)} ${unit}`}</title>
                      </rect>
                    )}
                    {l.kind === "critical" && l.deficientBelow !== undefined && (
                      <line className={styles.critical} x1={x(l.deficientBelow)} x2={x(l.deficientBelow)} y1={barY - 4} y2={barY + barH + 4} />
                    )}
                    {l.excessAbove !== undefined && (
                      <rect x={x(l.excessAbove)} y={barY} width={Math.max(0, right - x(l.excessAbove))} height={barH} fill={`url(#${ids}-high)`}>
                        <title>{`${label}: too much above ${show(l.excessAbove, unit)} ${unit}`}</title>
                      </rect>
                    )}
                    {l.adequateLow !== undefined && l.adequateHigh !== undefined && (
                      <>
                        <rect
                          className={l.kind === "normal" ? styles.usual : styles.enough}
                          x={x(l.adequateLow)}
                          y={barY}
                          width={Math.max(2, x(l.adequateHigh) - x(l.adequateLow))}
                          height={barH}
                        >
                          <title>{`${label}: ${l.kind === "normal" ? "usual range" : "enough"} ${show(l.adequateLow, unit)}–${show(l.adequateHigh, unit)} ${unit}`}</title>
                        </rect>
                        <text className={viz.label} x={(x(l.adequateLow) + x(l.adequateHigh)) / 2} y={barY - 4} textAnchor="middle">
                          {show(l.adequateLow, unit)}–{show(l.adequateHigh, unit)}
                        </text>
                      </>
                    )}
                    {l.kind === "critical" && l.deficientBelow !== undefined && (
                      <text className={viz.label} x={x(l.deficientBelow) + 4} y={barY - 4}>
                        {show(l.deficientBelow, unit)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <ul className={styles.levelKey} aria-label="Key">
              <li>
                <span className={`${styles.swatch} ${styles.swatchLow}`} aria-hidden="true" /> too little (deficient)
              </li>
              <li>
                <span className={`${styles.swatch} ${styles.swatchEnough}`} aria-hidden="true" /> enough (adequate)
              </li>
              {levels.some((l) => l.kind === "normal") && (
                <li>
                  <span className={`${styles.swatch} ${styles.swatchUsual}`} aria-hidden="true" /> usual range in that
                  group of plants
                </li>
              )}
              {levels.some((l) => l.kind === "critical") && (
                <li>
                  <span className={`${styles.swatch} ${styles.swatchCritical}`} aria-hidden="true" /> critical level:
                  trees below it often respond to fertiliser
                </li>
              )}
              {levels.some((l) => l.excessAbove !== undefined) && (
                <li>
                  <span className={`${styles.swatch} ${styles.swatchHigh}`} aria-hidden="true" /> too much (excess)
                </li>
              )}
            </ul>
          </>
        );
      }}
    </ChartFrame>
  );
}

export function PlantDetails({
  e,
  p,
  sources,
  headingRef,
  onClose,
}: {
  e: ElementIndexEntry;
  p: PlantDetail;
  sources: Sources;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const headingId = useId();
  return (
    <section className={styles.plantDetail} aria-labelledby={headingId} data-testid="plant-detail">
      <div className={styles.detailHead}>
        <h5 id={headingId} ref={headingRef} tabIndex={-1} className={styles.detailTitle}>
          {e.name} in plants
        </h5>
        <button type="button" className={styles.moreButton} onClick={onClose}>
          Less about plants <span aria-hidden="true">▴</span>
        </button>
      </div>
      <Glance p={p} sources={sources} />
      {p.phloem && (
        <p className={shared.muted}>
          A nutrient that moves readily in the phloem is moved out of older leaves when supply runs short, so the
          shortage shows first on older leaves; one that hardly moves shows it first on young leaves, shoot tips and
          fruits. <SourceChip id="marschner2023" sources={sources} />
          <Doi doi={DIAGNOSIS_DOI} />
        </p>
      )}
      {p.levels && (
        <>
          <h6 className={styles.topic}>Too little, enough, too much: levels in leaves</h6>
          <LeafLevels e={e} levels={p.levels} sources={sources} />
        </>
      )}
      {TOPICS.map(([topic, title]) => {
        const notes = p.notes?.[topic];
        if (!notes) return null;
        return (
          <div key={topic} data-topic={topic}>
            <h6 className={styles.topic}>{title}</h6>
            <ul className={styles.notes}>
              {notes.map((t) => (
                <li key={t.text}>
                  <Said t={t} sources={sources} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
