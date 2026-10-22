// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Electromagnetic & ionization (SPEC §10.2): the ionization ladder — every stage NIST lists, on a log
// axis, with the shell closures marked (the staircase that *is* shell structure); electron affinity
// and electronegativity on three scales, Mulliken's computed with its formula shown; the properties
// not yet compiled, each shown as missing with its reason; and IE₁ on the sawtooth of all elements.

import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { useSettings } from "../../app/store";
import { useElementDetail } from "../../data/load";
import { concise, isMissing, superscriptDigits } from "../../data/format";
import type { ElementIndexEntry, IonizationLadder, Missing, Q, SourcesFile } from "../../data/types";
import { type EnergyUnit, kjPerMolToEv, convertEnergy, polarizabilityAuToA3 } from "../../physics/units";
import { Formula } from "../../ui/Formula";
import { MissingValue, Quantity } from "../../ui/Quantity";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./em.module.css";

type Sources = SourcesFile["sources"];
type Stage = IonizationLadder["stages"][number];

const NOBLE: ReadonlyArray<[number, string]> = [
  [2, "He"],
  [10, "Ne"],
  [18, "Ar"],
  [36, "Kr"],
  [54, "Xe"],
  [86, "Rn"],
];

/** An uncertainty kept to two significant digits after a unit conversion. */
const roundUnc = (u: number | undefined) => (u === undefined || u === 0 ? u : Number(u.toPrecision(2)));

function energyText(ev: number, uncEv: number | undefined, unit: EnergyUnit): string {
  const v = convertEnergy(ev, "eV", unit);
  const u = uncEv === undefined ? undefined : roundUnc(convertEnergy(uncEv, "eV", unit));
  return `${concise(v, u)} ${unit}`;
}

function ion(symbol: string, charge: number): string {
  if (charge === 0) return symbol;
  return `${symbol}${charge === 1 ? "" : superscriptDigits(charge)}⁺`;
}

const FLAG_TEXT: Record<string, string> = {
  interpolated: "semi-empirical [ ]",
  calculated: "theoretical ( )",
  predicted: "predicted",
};

/** Where the next electron has to come out of a closed noble-gas shell: after stage k, Z − k = 2, 10, 18, … */
function closures(z: number, count: number): Array<{ after: number; core: string }> {
  return NOBLE.filter(([n]) => z - n >= 1 && z - n < count).map(([n, sym]) => ({ after: z - n, core: sym }));
}

function Ladder({ e, ladder, unit }: { e: ElementIndexEntry; ladder: IonizationLadder; unit: EnergyUnit }) {
  const stages = ladder.stages;
  const marks = closures(e.Z, stages.length);
  const caption = (
    <>
      Plotted: the energy to remove each electron in turn, from {e.symbol} to {ion(e.symbol, stages.length)}, on a
      logarithmic axis; stage k takes the k-th electron from the ion that has already lost k − 1. Dashed lines mark
      where the next electron has to come out of a closed noble-gas shell — the big jumps. Hollow points are NIST's semi-empirical or theoretical
      values. Data: NIST Atomic Spectra Database, ionization energies ({stages.length} of {e.Z} stages listed).
    </>
  );
  const table = {
    columns: ["Stage", "Ion", `Energy (${unit})`, "Note"],
    rows: stages.map((s) => ({
      key: String(s.stage),
      cells: [
        s.stage,
        `${ion(e.symbol, s.stage - 1)} → ${ion(e.symbol, s.stage)}`,
        energyText(s.eV, s.unc, unit),
        [s.flag ? FLAG_TEXT[s.flag] : "", marks.some((m) => m.after + 1 === s.stage) ? "first electron from a closed shell" : ""]
          .filter(Boolean)
          .join("; "),
      ],
    })),
  };
  return (
    <ChartFrame title="The ionization ladder" caption={caption} table={table} testId="ionization-ladder">
      {({ width, captionId }) => {
        const H = 260;
        const M = { top: 14, right: 14, bottom: 36, left: 64 };
        const values = stages.map((s) => convertEnergy(s.eV, "eV", unit));
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        const x = scaleLinear()
          .domain([0.5, Math.max(1.5, stages.length + 0.5)])
          .range([M.left, width - M.right]);
        const y = scaleLog()
          .domain([lo / 1.6, hi * 1.6])
          .range([H - M.bottom, M.top]);
        const path = line<Stage>()
          .x((s) => x(s.stage))
          .y((s) => y(convertEnergy(s.eV, "eV", unit)))(stages);
        const xTicks = stages.length <= 20 ? stages.map((s) => s.stage) : stages.map((s) => s.stage).filter((k) => k === 1 || k % 10 === 0);
        const yTicks = y.ticks().filter((t) => Number.isInteger(Math.log10(t)));
        const powers = hi / lo > 300; // over several decades, label every tick as a power of ten
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0 ${y(t)})`}>
                  <line x1={M.left} x2={width - M.right} className={viz.grid} />
                  <text x={M.left - 6} dy="0.32em" textAnchor="end">
                    {powers ? `10${superscriptDigits(Math.round(Math.log10(t)))}` : t}
                  </text>
                </g>
              ))}
              {xTicks.map((k) => (
                <text key={k} x={x(k)} y={H - M.bottom + 16} textAnchor="middle">
                  {k}
                </text>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              Ionization stage
            </text>
            <text className={viz.axisTitle} transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
              Energy ({unit}, log scale)
            </text>
            {marks.map((m) => (
              <g key={m.after}>
                <line x1={x(m.after + 0.5)} x2={x(m.after + 0.5)} y1={M.top} y2={H - M.bottom} className={styles.closure} />
                <text className={viz.label} x={x(m.after + 0.5) + 3} y={M.top + 10}>
                  [{m.core}]
                </text>
              </g>
            ))}
            {path && <path d={path} className={styles.line} />}
            {stages.map((s) => (
              <circle
                key={s.stage}
                cx={x(s.stage)}
                cy={y(convertEnergy(s.eV, "eV", unit))}
                r={stages.length > 60 ? 2.2 : 3}
                className={s.flag ? styles.hollow : styles.dot}
              >
                <title>{`IE${superscriptDigits(s.stage)}: ${ion(e.symbol, s.stage - 1)} → ${ion(e.symbol, s.stage)}, ${energyText(s.eV, s.unc, unit)}${s.flag ? `, ${FLAG_TEXT[s.flag]}` : ""}`}</title>
              </circle>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function Sawtooth({ e, elements, unit }: { e: ElementIndexEntry; elements: ElementIndexEntry[]; unit: EnergyUnit }) {
  const points = elements
    .filter((x) => !isMissing(x.ie1))
    .map((x) => ({ z: x.Z, symbol: x.symbol, v: convertEnergy((x.ie1 as { value: number }).value, "kJ/mol", unit), flag: (x.ie1 as { flag?: string }).flag }));
  const mine = points.find((p) => p.z === e.Z);
  const caption = (
    <>
      Plotted: the first ionization energy of every element against atomic number Z, with {e.name} marked. Data: NIST
      Atomic Spectra Database; for Z ≥ 109 published predictions, drawn as hollow points.
      {elements.length > points.length ? ` ${elements.length - points.length} elements have no value.` : ""}
    </>
  );
  const table = {
    columns: ["Z", "Element", `IE₁ (${unit})`],
    rows: points.map((p) => ({ key: String(p.z), cells: [p.z, p.symbol, `${Number(p.v.toPrecision(5))}${p.flag && p.flag !== "measured" ? ` (${p.flag})` : ""}`] })),
  };
  return (
    <ChartFrame title={`${e.name} on the IE₁ sawtooth`} caption={caption} table={table} testId="ie1-sawtooth">
      {({ width, captionId }) => {
        const H = 120;
        const M = { top: 10, right: 10, bottom: 24, left: 48 };
        const x = scaleLinear().domain([1, 118]).range([M.left, width - M.right]);
        const vs = points.map((p) => p.v);
        const y = scaleLinear()
          .domain([0, Math.max(...vs) * 1.05])
          .range([H - M.bottom, M.top]);
        const d = line<(typeof points)[number]>()
          .x((p) => x(p.z))
          .y((p) => y(p.v))(points);
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {y.ticks(3).map((t) => (
                <g key={t} transform={`translate(0 ${y(t)})`}>
                  <line x1={M.left} x2={width - M.right} className={viz.grid} />
                  <text x={M.left - 6} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {[1, 20, 40, 60, 80, 100, 118].map((z) => (
                <text key={z} x={x(z)} y={H - 6} textAnchor="middle">
                  {z}
                </text>
              ))}
            </g>
            {d && <path d={d} className={styles.spark} />}
            {points
              .filter((p) => p.flag === "predicted")
              .map((p) => (
                <circle key={p.z} cx={x(p.z)} cy={y(p.v)} r={2.5} className={styles.hollow} />
              ))}
            {mine && (
              <g>
                <circle cx={x(mine.z)} cy={y(mine.v)} r={5} className={styles.mine} />
                <text className={viz.label} x={x(mine.z)} y={y(mine.v) - 9} textAnchor="middle">
                  {e.symbol}
                </text>
              </g>
            )}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function Mulliken({ e, unit }: { e: ElementIndexEntry; unit: EnergyUnit }) {
  const ie = e.ie1;
  const ea = e.electronAffinity;
  if (isMissing(ie) || isMissing(ea)) {
    const why: Missing = {
      missing: true,
      reason: "not_measured",
      note: `It needs both the first ionization energy and the electron affinity, and ${isMissing(ea) ? "the electron affinity" : "the ionization energy"} is missing.`,
    };
    return <MissingValue m={why} />;
  }
  const ieEv = ie.unit === "eV" ? ie.value : kjPerMolToEv(ie.value);
  const eaEv = ea.unit === "eV" ? ea.value : kjPerMolToEv(ea.value);
  const chiEv = (ieEv + eaEv) / 2;
  return (
    <span>
      {Number(convertEnergy(chiEv, "eV", unit).toPrecision(4))} {unit}{" "}
      <span className={shared.muted}>(computed here from the two values on this panel)</span>
    </span>
  );
}

/**
 * Properties SPEC §10.2 lists that PTE-21C has not compiled yet. They are named, so their absence is
 * visible, but they are not shown as missing values: "not measured" would be untrue — they have been
 * measured; PTE-21C has not gathered the numbers yet.
 */
const NOT_COMPILED = [
  "Magnetic ordering and molar magnetic susceptibility",
  "Electrical resistivity",
  "Superconducting transition temperature",
  "Work function",
  "Band gap",
];

const NO_POLARIZABILITY: Missing = {
  missing: true,
  reason: "source_unavailable_at_build",
  note: "The data file has no polarizability field; rebuild the data with tools/pipeline.py.",
};

function Polarizability({ q, sources }: { q: Q; sources: Sources }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  return (
    <span>
      <Quantity q={q} sources={sources} />{" "}
      <span className={shared.muted}>
        = {Number(polarizabilityAuToA3(q.value).toPrecision(4))} Å³ (the polarizability volume; 1 a.u. = a₀³)
      </span>
    </span>
  );
}

function Facts({ e, en, sources, unit }: { e: ElementIndexEntry; en: { pauling: Q; allen: Q }; sources: Sources; unit: EnergyUnit }) {
  return (
    <dl className={shared.facts}>
      <dt>Electron affinity</dt>
      <dd>
        <Quantity q={e.electronAffinity} sources={sources} />
      </dd>
      <dt>Electronegativity, Pauling</dt>
      <dd>
        <Quantity q={en.pauling} sources={sources} />
      </dd>
      <dt>Electronegativity, Allen</dt>
      <dd>
        <Quantity q={en.allen} sources={sources} />
      </dd>
      <dt>Electronegativity, Mulliken</dt>
      <dd>
        <Formula tex={String.raw`\chi_\mathrm{M} = \tfrac{1}{2}\,(\mathrm{IE}_1 + \mathrm{EA})`} /> ={" "}
        <Mulliken e={e} unit={unit} />
      </dd>
    </dl>
  );
}

export default function Panel({ element: e, elements, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  const unit = useSettings((s) => s.energyUnit);
  return (
    <WhenLoaded files={[detail]}>
      {(d) => {
        const ladder = d.em.ionizationEnergies;
        return (
          <div className={styles.panel}>
            <Section title="Ionization energies" id="ladder">
              {ladder.stages.length > 0 ? (
                <Ladder e={e} ladder={ladder} unit={unit} />
              ) : (
                <p>
                  The ionization ladder:{" "}
                  <MissingValue
                    m={{
                      missing: true,
                      reason: "not_measured",
                      note: "NIST lists no ionization energies for this element; only a predicted first ionization energy exists (below).",
                    }}
                  />
                </p>
              )}
              <p>
                First ionization energy: <Quantity q={e.ie1} sources={sources} />
              </p>
            </Section>
            <Section title="Electron affinity and electronegativity" id="en">
              <Facts e={e} en={d.em.en} sources={sources} unit={unit} />
            </Section>
            <Section title="Other electromagnetic properties" id="other">
              <dl className={shared.facts}>
                <dt>Static dipole polarizability</dt>
                <dd>
                  <Polarizability q={d.em.polarizability ?? NO_POLARIZABILITY} sources={sources} />
                </dd>
              </dl>
              <p className={shared.muted}>
                How easily the atom's electron cloud is pulled out of shape by an electric field: the dipole it acquires per
                unit field. Large for the alkali metals, whose single outer electron is loosely held.
              </p>
              <h5 className={styles.subheading}>Not yet compiled in PTE-21C</h5>
              <p className={shared.muted}>
                These have been measured for many elements, but PTE-21C has not gathered sourced values for them yet:{" "}
                {NOT_COMPILED.join("; ")}.
              </p>
            </Section>
            <Section title="In context" id="context">
              <Sawtooth e={e} elements={elements} unit={unit} />
            </Section>
            <SourcesFooter
              ids={collectSources(ladder, e.ie1, e.electronAffinity, d.em.en, d.em.polarizability, elements.map((x) => x.ie1))}
              sources={sources}
            />
          </div>
        );
      }}
    </WhenLoaded>
  );
}
