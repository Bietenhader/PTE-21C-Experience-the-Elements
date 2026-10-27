// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Physical & engineering (SPEC §10.4): phase, density, melting and boiling points; heat capacity, the
// specific value computed with its formula shown; the crystal structure with a rotatable unit cell
// (three.js, loaded only when it is first shown, drawn only while this panel is the one shown) and the
// allotropes; abundance in the crust, sea water, the Sun and the body on one logarithmic axis; world
// production and unit value with their years; the EU critical-raw-material flag; what the element is
// used for; its GHS hazard pictograms; and, plainly listed, what PTE-21C has not compiled yet.

import { scaleLog } from "d3-scale";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useSettings } from "../../app/store";
import { useElementDetail } from "../../data/load";
import { concise, formatQuantity, isInterval, isMissing, MISSING_TEXT, superscriptDigits } from "../../data/format";
import type {
  Allotrope,
  CrystalStructure,
  ElementDetailFile,
  ElementIndexEntry,
  GhsHazards,
  Missing,
  Q,
  SectorRole,
  SourcesFile,
  UseNote,
} from "../../data/types";
import { convertTemperature, type TemperatureUnit } from "../../physics/units";
import { Formula } from "../../ui/Formula";
import { MissingValue, Quantity, SourceChip } from "../../ui/Quantity";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import { BALL_SHARE, type CellModel, cellModel } from "./cell";
import { mostlyNotHazardous, NOT_COMPILED, priceIsCurrent, specificHeat } from "./model";
import styles from "./physical.module.css";
import type { CellTurn } from "./UnitCell";

const UnitCell = lazy(() => import("./UnitCell"));

type Sources = SourcesFile["sources"];
type Physical = ElementDetailFile["physical"];

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (n: number) => String(n).replace(/\d/g, (d) => SUBSCRIPT[Number(d)] ?? d);

/** A number for a label: plain between 0.01 and a million, otherwise m × 10ⁿ; three significant digits. */
function compact(v: number): string {
  const r = Number(v.toPrecision(3));
  if (r >= 0.01 && r < 1e6) return concise(r);
  const [m = "", ex = "0"] = r.toExponential().split("e");
  const n = Number(ex);
  return `${m} × 10${n < 0 ? "⁻" : ""}${superscriptDigits(Math.abs(n))}`;
}

/** Decimal places of a number as written, so that a conversion keeps the precision of the source. */
function decimals(x: number): number {
  const s = String(x);
  return s.includes("e") ? 0 : (s.split(".")[1]?.length ?? 0);
}

function Note({ text }: { text: string | undefined }) {
  return text ? <span className={styles.note}> {text}</span> : null;
}

/** A temperature stored in kelvin, shown in the unit chosen in Settings, to the precision of the source. */
function Temperature({ q, unit, sources }: { q: Q; unit: TemperatureUnit; sources: Sources }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  if (unit === "K") {
    return (
      <>
        <Quantity q={q} sources={sources} />
        <Note text={q.note} />
      </>
    );
  }
  const d = Math.max(decimals(q.value), q.unc ? decimals(q.unc) : 0);
  const v = Number(convertTemperature(q.value, unit).toFixed(d));
  return (
    <>
      <span className={styles.value}>
        {concise(v, q.unc)} {unit}
      </span>{" "}
      <SourceChip id={q.source} sources={sources} />
      <Note text={q.note} />
    </>
  );
}

function Phase({ e, sources }: { e: ElementIndexEntry; sources: Sources }) {
  if (e.standardState === "unknown") {
    return (
      <MissingValue
        m={{ missing: true, reason: "predicted_only", note: "PubChem gives only an expected state: too few atoms have been made to see one." }}
      />
    );
  }
  return (
    <>
      {e.standardState} <SourceChip id="pubchem" sources={sources} />
    </>
  );
}

function StateFacts({ e, sources, unit }: { e: ElementIndexEntry; sources: Sources; unit: TemperatureUnit }) {
  return (
    <>
      <dl className={shared.facts}>
        <dt>Phase at standard conditions</dt>
        <dd>
          <Phase e={e} sources={sources} />
        </dd>
        <dt>Density</dt>
        <dd>
          <Quantity q={e.density} sources={sources} />
          {!isMissing(e.density) && <Note text={e.density.note} />}
        </dd>
        <dt>Melting point</dt>
        <dd>
          <Temperature q={e.meltingPoint} unit={unit} sources={sources} />
        </dd>
        <dt>Boiling point</dt>
        <dd>
          <Temperature q={e.boilingPoint} unit={unit} sources={sources} />
        </dd>
      </dl>
      {[e.meltingPoint, e.boilingPoint, e.density].some((q) => !isMissing(q)) &&
        [e.meltingPoint, e.boilingPoint, e.density].every((q) => isMissing(q) || q.unc === undefined) && (
        <p className={shared.muted}>PubChem gives these values without uncertainties, so none is shown.</p>
      )}
    </>
  );
}

function HeatCapacity({ e, thermal, sources }: { e: ElementIndexEntry; thermal: Physical["thermal"]; sources: Sources }) {
  const cp = thermal.molarHeatCapacity;
  const c = specificHeat(cp, thermal.formulaAtoms, e);
  const n = thermal.formulaAtoms;
  const weight = isInterval(e.atomicWeight) ? "IUPAC's conventional atomic weight" : "the standard atomic weight";
  return (
    <dl className={shared.facts}>
      <dt>
        Molar heat capacity, C<sub>p</sub> (25 °C)
      </dt>
      <dd>
        <Quantity q={cp} sources={sources} />
        {!isMissing(cp) && <Note text={cp.note} />}
      </dd>
      <dt>
        Specific heat capacity, c<sub>p</sub>
      </dt>
      <dd data-testid="specific-heat">
        {c.ok && !isMissing(cp) ? (
          <>
            <Formula tex={n ? String.raw`c_p = \frac{C_p}{${n}\,M}` : String.raw`c_p = \frac{C_p}{M}`} /> ={" "}
            <span className={styles.value}>{concise(Number(c.value.toPrecision(4)))} J/(g·K)</span>{" "}
            <span className={shared.muted}>
              (computed here: {concise(cp.value)} J/(mol·K) ÷ {n ? `(${n} × ${c.molarMass} g/mol)` : `${c.molarMass} g/mol`}, with M from{" "}
              {weight}
              {n ? `; ${n} atoms because the table gives C_p per mole of ${e.symbol}${subscript(n)} molecules` : ""})
            </span>
          </>
        ) : (
          <MissingValue m={c.ok ? { missing: true, reason: "not_measured" } : c.why} />
        )}
      </dd>
    </dl>
  );
}

function CellView({ e, crystal, model, active }: { e: ElementIndexEntry; crystal: CrystalStructure; model: CellModel; active: boolean }) {
  const [turn, setTurn] = useState<CellTurn>({ seq: 0, dAzimuth: 0, dElevation: 0 });
  const [drawn, setDrawn] = useState(false);
  const onDrawn = useCallback(() => setDrawn(true), []);
  const step = Math.PI / 8;
  const turnBy = (dAzimuth: number, dElevation: number) => setTurn((t) => ({ seq: t.seq + 1, dAzimuth, dElevation }));
  const label = `Unit cell of ${e.name}: ${model.type.label}, ${model.atoms.length} atoms drawn, ${Number(model.perCell.toFixed(3))} per cell.`;
  const caption = (
    <>
      Drawn: the conventional unit cell of {crystal.allotrope ?? e.name} ({model.type.label}) to scale, from the cell
      lengths and angles of COD entry {crystal.codId}; atoms on corners, edges and faces are shared with the
      neighbouring cells, so the {model.atoms.length} atoms drawn make {Number(model.perCell.toFixed(3))} per cell.
      The spheres are drawn smaller than the atoms (radius {Math.round(BALL_SHARE * 100)} % of the shortest
      distance between atoms, {concise(Number(model.nearest.toPrecision(4)))} pm) so that the cell can be seen
      through. Drag to turn it, or use the buttons.
    </>
  );
  const table = {
    columns: ["Atom", "x", "y", "z", "Share in this cell"],
    rows: model.atoms.map((a, i) => ({
      key: String(i),
      cells: [i + 1, ...a.frac.map((x) => Number(x.toFixed(4))), a.share === 1 ? "whole" : `1/${Math.round(1 / a.share)}`],
    })),
  };
  return (
    <ChartFrame title="Unit cell" caption={caption} table={table} testId="unit-cell">
      {({ width }) => {
        const size = Math.min(width, 380);
        return (
          <div className={styles.cellStage} data-drawn={drawn ? "true" : undefined} data-atoms={model.atoms.length}>
            <div className={styles.canvasBox} style={{ width: size, height: size }}>
              {active ? (
                <Suspense fallback={<p className={shared.muted}>Loading the 3D view…</p>}>
                  <UnitCell model={model} accent={`--accent-${e.category}`} turn={turn} label={label} size={size} onDrawn={onDrawn} />
                </Suspense>
              ) : (
                <p className={shared.muted}>The 3D view is drawn while this panel is shown.</p>
              )}
            </div>
            <div className={styles.turns} role="group" aria-label="Turn the unit cell">
              <button type="button" onClick={() => turnBy(-step, 0)} aria-label="Turn left">
                ⟲
              </button>
              <button type="button" onClick={() => turnBy(step, 0)} aria-label="Turn right">
                ⟳
              </button>
              <button type="button" onClick={() => turnBy(0, step)} aria-label="Tilt up">
                ↑
              </button>
              <button type="button" onClick={() => turnBy(0, -step)} aria-label="Tilt down">
                ↓
              </button>
              <button type="button" onClick={() => setTurn((t) => ({ seq: t.seq + 1, dAzimuth: 0, dElevation: 0, reset: true }))}>
                Reset view
              </button>
            </div>
          </div>
        );
      }}
    </ChartFrame>
  );
}

/** "a = 286.54 pm, c = …; α = β = γ = 90°" for the cell, with one source chip. */
function cellText(c: CrystalStructure): string {
  const lengths = [
    `a = ${formatQuantity(c.a)}`,
    ...(c.b ? [`b = ${formatQuantity(c.b)}`] : []),
    ...(c.c ? [`c = ${formatQuantity(c.c)}`] : []),
  ].join(", ");
  return `${lengths}; α = ${c.alpha.value}°, β = ${c.beta.value}°, γ = ${c.gamma.value}°`;
}

function Crystal({ e, crystal, sources, active }: { e: ElementIndexEntry; crystal: Physical["crystal"]; sources: Sources; active: boolean }) {
  if (isMissing(crystal)) {
    return (
      <p>
        Crystal structure: <MissingValue m={crystal} />
      </p>
    );
  }
  const model = cellModel(crystal);
  return (
    <>
      <dl className={shared.facts}>
        <dt>Form</dt>
        <dd>
          {crystal.allotrope ?? e.name}: {crystal.structure}
        </dd>
        <dt>Lattice and symmetry</dt>
        <dd>
          {crystal.lattice}
          {crystal.cellAxes ? ` (cell given on ${crystal.cellAxes} axes)` : ""}; space group {crystal.spaceGroup} (No.{" "}
          {crystal.spaceGroupNumber}); Pearson symbol {crystal.pearson}
          {crystal.atomsPerCell ? `; ${crystal.atomsPerCell} atoms per cell` : ""}
        </dd>
        <dt>Cell</dt>
        <dd>
          {cellText(crystal)} <SourceChip id={crystal.a.source} sources={sources} />
        </dd>
        <dt>Measured at</dt>
        <dd>
          {isMissing(crystal.temperature) ? <MissingValue m={crystal.temperature} /> : formatQuantity(crystal.temperature)}
          {crystal.pressure ? `, ${formatQuantity(crystal.pressure)}` : null}
        </dd>
        <dt>Reference</dt>
        <dd>
          COD {crystal.codId}: {crystal.reference}
          {crystal.doi ? ` doi:${crystal.doi}` : ""} <SourceChip id={crystal.source} sources={sources} />
        </dd>
      </dl>
      {crystal.lowTemperatureSolid && (
        <Badge>
          {e.name} is not a solid at room temperature: this is the structure of the solid, measured cold
          {isMissing(crystal.temperature) ? "" : ` (${crystal.temperature.value} K)`}.
        </Badge>
      )}
      {crystal.doubtful && <Badge>Doubtful entry: see the note below.</Badge>}
      {crystal.note && <p className={shared.muted}>{crystal.note}</p>}
      {model ? (
        <CellView e={e} crystal={crystal} model={model} active={active} />
      ) : (
        <p className={shared.muted}>
          No 3D drawing for this structure type yet: PTE-21C draws the common cubic, hexagonal and tetragonal
          types; the cell parameters above describe this one.
        </p>
      )}
    </>
  );
}

function Allotropes({ list, name, sources }: { list: Allotrope[]; name: string; sources: Sources }) {
  if (list.length === 0) {
    return <p className={shared.muted}>PTE-21C lists no allotropes for {name.toLowerCase()}.</p>;
  }
  return (
    <ul className={styles.list}>
      {list.map((a) => (
        <li key={a.name}>
          <strong>{a.name}</strong>
          {a.standard ? " (the standard form)" : ""}: {a.note} <SourceChip id={a.source} sources={sources} />
          {a.doi ? <span className={shared.muted}> doi:{a.doi}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const ABUNDANCE: ReadonlyArray<[keyof Physical["abundanceByMass"], string]> = [
  ["crust", "Earth's crust"],
  ["ocean", "Sea water"],
  ["solar", "Solar System"],
  ["body", "Human body"],
];

function powerOfTen(n: number): string {
  return n === 0 ? "1" : n === 1 ? "10" : `10${n < 0 ? "⁻" : ""}${superscriptDigits(Math.abs(n))}`;
}

function AbundanceChart({ e, ppm, sources }: { e: ElementIndexEntry; ppm: Physical["abundanceByMass"]; sources: Sources }) {
  const rows = ABUNDANCE.map(([key, label]) => ({ key, label, q: ppm[key] }));
  const values = rows.flatMap((r) => (isMissing(r.q) ? [] : [r.q.value])).filter((v) => v > 0);
  const caption = (
    <>
      Plotted: how much of {e.name.toLowerCase()} there is in a kilogram of Earth's crust, of sea water, of the
      Solar System's original matter and of a human body, in milligrams per kilogram (parts per million by mass), on a
      logarithmic axis: each grid line is ten times the one before. Sea water is taken as one kilogram per litre; the
      body is the reference adult of ICRP Publication 23 (1975). Data: Jefferson Lab estimates via PubChem (crust, sea
      water), Lodders et al. 2025 (Solar System), ICRP Publication 23 (body).
    </>
  );
  const table = {
    columns: ["Where", "mg/kg", "How it was obtained"],
    rows: rows.map((r) => ({
      key: r.key,
      cells: [
        r.label,
        isMissing(r.q) ? <MissingValue m={r.q} /> : <Quantity q={r.q} sources={sources} />,
        isMissing(r.q) ? "" : (r.q.note ?? ""),
      ],
    })),
  };
  if (values.length === 0) {
    return (
      <p>
        Abundance:{" "}
        <MissingValue m={{ missing: true, reason: "not_measured", note: "None of the four abundance tables gives a value for this element." }} />
      </p>
    );
  }
  return (
    <ChartFrame title={`How common ${e.name.toLowerCase()} is`} caption={caption} table={table} testId="abundance-chart">
      {({ width, captionId }) => {
        const narrow = width < 420;
        const M = { top: 8, right: 16, bottom: 34, left: narrow ? 96 : 120 };
        const ROW = 30;
        const H = M.top + ROW * rows.length + M.bottom;
        let lo = Math.floor(Math.log10(Math.min(...values)));
        let hi = Math.ceil(Math.log10(Math.max(...values)));
        if (hi - lo < 2) {
          lo -= 1;
          hi += 1;
        }
        const x = scaleLog()
          .domain([10 ** lo, 10 ** hi])
          .range([M.left, width - M.right]);
        const span = hi - lo;
        const every = span > (narrow ? 6 : 10) ? Math.ceil(span / (narrow ? 5 : 8)) : 1;
        const ticks = Array.from({ length: span + 1 }, (_, i) => lo + i).filter((n) => (n - lo) % every === 0);
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {ticks.map((n) => (
                <g key={n} transform={`translate(${x(10 ** n)} 0)`}>
                  <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                  <text y={H - M.bottom + 16} textAnchor="middle">
                    {powerOfTen(n)}
                  </text>
                </g>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              mg/kg (log scale)
            </text>
            {rows.map((r, i) => {
              const y = M.top + i * ROW;
              return (
                <g key={r.key} transform={`translate(0 ${y})`}>
                  <text className={viz.label} x={M.left - 8} y={ROW / 2} dy="0.32em" textAnchor="end">
                    {r.label}
                  </text>
                  {isMissing(r.q) || r.q.value <= 0 ? (
                    <text className={styles.noValue} x={M.left + 6} y={ROW / 2} dy="0.32em">
                      no value ({isMissing(r.q) ? MISSING_TEXT[r.q.reason].long : "zero"}); see the table
                    </text>
                  ) : (
                    <>
                      <rect className={styles.bar} x={M.left} y={6} height={ROW - 12} width={Math.max(1, x(r.q.value) - M.left)}>
                        <title>{`${r.label}: ${compact(r.q.value)} mg/kg`}</title>
                      </rect>
                      <text
                        className={x(r.q.value) > width - 90 ? styles.barValueInside : viz.label}
                        x={x(r.q.value) + (x(r.q.value) > width - 90 ? -4 : 4)}
                        y={ROW / 2}
                        dy="0.32em"
                        textAnchor={x(r.q.value) > width - 90 ? "end" : "start"}
                      >
                        {compact(r.q.value)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function Production({ e, p, sources }: { e: ElementIndexEntry; p: Physical["production"]; sources: Sources }) {
  const thisYear = new Date().getFullYear();
  if (!p.tonnesPerYear && !p.unitValue) {
    return (
      <p>
        World production:{" "}
        <MissingValue
          m={{ missing: true, reason: "not_measured", note: "PTE-21C's table from the USGS Mineral Commodity Summaries 2026 has no world production figure for this element." }}
        />
      </p>
    );
  }
  return (
    <dl className={shared.facts}>
      <dt>Reported as</dt>
      <dd>
        {p.commodity} ({p.basis}), USGS {p.edition}
        {p.viaMineral ? `: the figure is for the mineral or material, not for ${e.name.toLowerCase()} itself` : ""}
      </dd>
      <dt>World production{p.year ? `, ${p.year}` : ""}</dt>
      <dd>{p.tonnesPerYear ? <Quantity q={p.tonnesPerYear} sources={sources} /> : "—"}</dd>
      <dt>Unit value{p.priceYear ? `, ${p.priceYear}` : ""}</dt>
      <dd>
        {p.unitValue && p.priceYear && priceIsCurrent(p.priceYear, thisYear) ? (
          <>
            <Quantity q={p.unitValue} sources={sources} />
            <Note text={p.unitValue.note} />
          </>
        ) : p.unitValue && p.priceYear ? (
          <span className={shared.muted}>The latest USGS value is from {p.priceYear}, more than five years ago, so it is not shown.</span>
        ) : (
          <MissingValue m={{ missing: true, reason: "not_measured", note: "USGS gives no recent price or unit value for this commodity." }} />
        )}
      </dd>
    </dl>
  );
}

function Critical({ e, c, sources }: { e: ElementIndexEntry; c: Physical["critical"]; sources: Sources }) {
  return (
    <p data-testid="crm-flag">
      <span className={c.eu2023 ? styles.flagOn : styles.flagOff}>{c.eu2023 ? "EU critical raw material" : "Not on the EU list"}</span>{" "}
      {c.eu2023 ? (
        <>
          Listed as “{c.listedAs}” in the EU's 2023 list of critical raw materials
          {c.strategic ? ", and as a strategic raw material" : ""}.
        </>
      ) : (
        <>{e.name} is not on the EU's 2023 list of critical raw materials.</>
      )}{" "}
      <SourceChip id={c.source ?? "eu_crm"} sources={sources} />
      {c.doubtful && <span className={shared.muted}> Doubtful: see the note.</span>}
      {c.note && <span className={shared.muted}> {c.note}</span>}
    </p>
  );
}

function Uses({ uses, sources }: { uses: UseNote[]; sources: Sources }) {
  return (
    <ul className={styles.list} data-testid="uses">
      {uses.map((u) => (
        <li key={u.text}>
          {u.text} <SourceChip id={u.source} sources={sources} />
          {u.doi ? <span className={shared.muted}> doi:{u.doi}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const SECTOR_NAME: Record<SectorRole["sector"], string> = {
  energy: "Energy",
  infrastructure: "Logistics & infrastructure",
  ict: "IT, computing & telecom",
};

/** The element's role in three sectors (tools/curated/sectors.toml), each with its source. */
function Sectors({ rows, sources }: { rows: SectorRole[]; sources: Sources }) {
  if (rows.length === 0) {
    return (
      <p className={shared.muted} data-testid="sectors">
        No role in these sectors is named in PTE-21C&apos;s sources.
      </p>
    );
  }
  const status = (r: SectorRole) =>
    r.status === "essential" ? `Essential${r.asOf ? ` (as of ${r.asOf})` : ""}` : "Important";
  return (
    <dl className={shared.facts} data-testid="sectors">
      {rows.map((r) => (
        <div key={r.sector} className={styles.sectorRow} data-sector={r.sector}>
          <dt>{SECTOR_NAME[r.sector]}</dt>
          <dd>
            <b>{status(r)}.</b> {r.text} <SourceChip id={r.source} sources={sources} />
            {r.page ? <span className={shared.muted}> ({r.page})</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Our own drawing of a GHS pictogram frame: a red-bordered diamond with the code inside; no GHS artwork is copied. */
function Diamond({ code, name }: { code: string; name: string }) {
  return (
    <li className={styles.pictogram}>
      <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true" focusable="false">
        <rect x="17" y="17" width="66" height="66" rx="3" transform="rotate(45 50 50)" className={styles.diamond} />
        <text x="50" y="55" textAnchor="middle" className={styles.code}>
          {code}
        </text>
      </svg>
      <span className={styles.pictoName}>
        {code}: {name}
      </span>
    </li>
  );
}

function Hazards({ e, h, sources }: { e: ElementIndexEntry; h: GhsHazards | Missing; sources: Sources }) {
  if (isMissing(h)) {
    return (
      <p>
        GHS classification: <MissingValue m={h} />
      </p>
    );
  }
  const mostlyNone = mostlyNotHazardous(h);
  return (
    <div data-testid="hazards">
      {h.notClassified && h.hazardStatements.length === 0 ? (
        <p>
          <strong>Not classified</strong>: the reports say {e.name.toLowerCase()} does not meet the GHS criteria for any hazard class.{" "}
          <SourceChip id={h.source} sources={sources} />
        </p>
      ) : (
        <>
          {mostlyNone && h.notMeetingCriteria && (
            <Badge>
              Most of the reports ({h.notMeetingCriteria.share} %, {h.notMeetingCriteria.reports} of {h.notMeetingCriteria.of}) say{" "}
              {e.name.toLowerCase()} does not meet the GHS criteria for any hazard class. The pictograms and statements below are
              those the other reports give, each with its share.
            </Badge>
          )}
          <ul className={styles.pictograms} aria-label="GHS pictograms">
            {h.pictograms.map((p) => (
              <Diamond key={p.code} code={p.code} name={p.name} />
            ))}
          </ul>
          {h.signalWord && (
            <p>
              Signal word: <strong>{h.signalWord}</strong> <SourceChip id={h.source} sources={sources} />
            </p>
          )}
          <ul className={styles.list}>
            {h.hazardStatements.map((s) => (
              <li key={s.code}>
                <span className={styles.hcode}>{s.code}</span> {s.text}
                {s.share !== undefined ? <span className={shared.muted}> ({s.share} % of reports)</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={shared.muted}>
        {h.note} PubChem compound {h.cid}.
      </p>
    </div>
  );
}

function NotCompiled() {
  return (
    <>
      <p className={shared.muted}>Planned for this panel, but not yet compiled from a primary table:</p>
      <ul className={styles.list} data-testid="not-compiled">
        {NOT_COMPILED.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </>
  );
}

function Body({ e, d, sources, active }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources; active: boolean }) {
  const unit = useSettings((s) => s.temperatureUnit);
  const p = d.physical;
  const ids = useMemo(
    () =>
      collectSources(p, e.density, e.meltingPoint, e.boilingPoint, e.atomicWeight, {
        sources: [e.standardState === "unknown" ? "" : "pubchem", "eu_crm"].filter(Boolean),
      }),
    [p, e],
  );
  return (
    <div className={styles.panel}>
      <Section title="State, density, melting and boiling" id="state">
        <StateFacts e={e} sources={sources} unit={unit} />
      </Section>
      <Section title="Heat capacity" id="heat">
        <HeatCapacity e={e} thermal={p.thermal} sources={sources} />
      </Section>
      <Section title="Crystal structure" id="crystal">
        <Crystal e={e} crystal={p.crystal} sources={sources} active={active} />
      </Section>
      <Section title="Allotropes" id="allotropes">
        <Allotropes list={p.allotropes} name={e.name} sources={sources} />
      </Section>
      <Section title="Abundance" id="abundance">
        <AbundanceChart e={e} ppm={p.abundanceByMass} sources={sources} />
      </Section>
      <Section title="Production and price" id="production">
        <Production e={e} p={p.production} sources={sources} />
        <Critical e={e} c={p.critical} sources={sources} />
      </Section>
      <Section title="Uses" id="uses">
        <Uses uses={p.uses} sources={sources} />
      </Section>
      <Section title="Role in energy, infrastructure and IT" id="sectors">
        <Sectors rows={p.sectors} sources={sources} />
      </Section>
      <Section title="Hazards (GHS)" id="hazards">
        <Hazards e={e} h={p.hazards} sources={sources} />
      </Section>
      <Section title="Not yet compiled in PTE-21C" id="not-compiled">
        <NotCompiled />
      </Section>
      <SourcesFooter ids={ids} sources={sources} />
    </div>
  );
}

export default function Panel({ element: e, sources, active }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <Body key={e.Z} e={e} d={d} sources={sources} active={active} />}</WhenLoaded>;
}
