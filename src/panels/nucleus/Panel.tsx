// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Nucleus & isotopes (SPEC §10.7): every known isotope on an N axis (log half-life, decay mode,
// natural abundance), the selected isotope's record and decays, its survival curve, binding energy
// per nucleon against the nickel-62 maximum, magic numbers, spin and parity, the element's cosmic
// origin (an approximation, named as one) and, for thorium, the nuclear clock.

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { type MouseEvent, useId, useState } from "react";
import { useElementDetail, useIsotopes, useJson, useMetrology, useTrends } from "../../data/load";
import { isMissing } from "../../data/format";
import type {
  CosmicOrigin,
  ElementDetailFile,
  ElementIndexEntry,
  Isotope,
  IsotopesFile,
  MetrologyFile,
  Missing,
  Q,
  SourcesFile,
  TrendsFile,
} from "../../data/types";
import { CODATA } from "../../physics/constants";
import { decayConstant, meanLifetime, SECONDS_PER_YEAR, survivingFraction } from "../../physics/decay";
import { isMagic, magicKind, MAGIC_NUMBERS } from "../../physics/nuclear";
import { Formula } from "../../ui/Formula";
import { MissingValue, Quantity } from "../../ui/Quantity";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import {
  defaultIsotope,
  dominantDecay,
  FAMILIES,
  type Family,
  halfLifeSeconds,
  halfLifeWords,
  isotopeFamily,
  isotopeLabel,
  jpText,
  modeLabel,
  naturalUnit,
  NOTHING_TO_DECAY,
  photonEnergyEv,
  sci,
  sup,
  tidy,
  TIME_UNITS,
  type TimeUnit,
} from "./model";
import styles from "./nucleus.module.css";

type Sources = SourcesFile["sources"];
type Timeline = MetrologyFile["timeline"];

const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.id, f])) as Record<Family, (typeof FAMILIES)[number]>;

// --- Patterns: every decay family has a texture as well as a colour (no meaning by colour alone) ---

function Patterns({ prefix }: { prefix: string }) {
  const lines = (id: Family, rotate: number, dots = false) => (
    <pattern key={id} id={`${prefix}-${id}`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate})`}>
      <rect width={6} height={6} style={{ fill: `var(--map-${FAMILY[id].tone})` }} />
      {dots ? (
        <circle cx={3} cy={3} r={1.1} className={styles.texture} />
      ) : (
        <line x1={0} y1={0} x2={0} y2={6} className={styles.texture} strokeWidth={1.6} />
      )}
    </pattern>
  );
  return (
    <defs>
      <pattern id={`${prefix}-stable`} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} style={{ fill: `var(--map-${FAMILY.stable.tone})` }} />
      </pattern>
      {lines("beta-minus", 45)}
      {lines("beta-plus", -45)}
      {lines("alpha", 90)}
      <pattern id={`${prefix}-fission`} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} style={{ fill: `var(--map-${FAMILY.fission.tone})` }} />
        <path d="M0 0L6 6M6 0L0 6" className={styles.texture} strokeWidth={1.2} />
      </pattern>
      {lines("particle", 0, true)}
      {lines("cluster", 0)}
      {lines("isomeric", 45, true)}
      <pattern id={`${prefix}-unknown`} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} style={{ fill: `var(--map-${FAMILY.unknown.tone})` }} />
      </pattern>
    </defs>
  );
}

function Swatch({ prefix, family }: { prefix: string; family: Family }) {
  return (
    <svg width={18} height={12} aria-hidden="true" className={styles.swatch}>
      <rect width={18} height={12} rx={2} style={{ fill: `url(#${prefix}-${family})` }} />
    </svg>
  );
}

// --- Words for one isotope ---------------------------------------------------------------------

function HalfLife({ iso, sources }: { iso: Isotope; sources: Sources }) {
  if (iso.stable) return <span>stable — no decay has been observed</span>;
  const h = iso.halfLife;
  if (!h) return <MissingValue m={{ missing: true, reason: "not_measured", note: "IAEA lists no half-life for this nuclide." }} />;
  if (isMissing(h)) return <MissingValue m={h} />;
  return (
    <span>
      {iso.halfLifeText ? `${halfLifeWords(iso.halfLifeText)} = ` : ""}
      {sci(h.value)} s{h.note ? <span className={shared.muted}> ({h.note})</span> : null} <SourceChip id={h.source} sources={sources} />
    </span>
  );
}

function halfLifeText(iso: Isotope): string {
  if (iso.stable) return "stable";
  if (iso.halfLifeText) return halfLifeWords(iso.halfLifeText);
  const h = iso.halfLife;
  if (h && !isMissing(h)) return `${sci(h.value)} s`;
  return "not measured";
}

function Branching({ q }: { q: Q }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  return <span>{sci(q.value, q.unc)} %</span>;
}

function spinParity(iso: Isotope): string {
  return iso.jp ? jpText(iso.jp) : "not assigned";
}

function Record({ iso, e, source, sources }: { iso: Isotope; e: ElementIndexEntry; source: string; sources: Sources }) {
  const kind = magicKind(e.Z, iso.N);
  const absent = (note: string): Missing => ({ missing: true, reason: "not_measured", note });
  return (
    <dl className={shared.facts} data-testid="isotope-record">
      <dt>Isotope</dt>
      <dd>
        <strong>{isotopeLabel(iso.A, e.symbol)}</strong> ({e.name.toLowerCase()}-{iso.A}): Z = {e.Z} protons, N = {iso.N} neutrons
        {kind === "doubly" ? " — doubly magic: both shells are closed" : kind === "neutrons" ? ` — N = ${iso.N} is a magic number` : ""}
      </dd>
      <dt>Spin and parity</dt>
      <dd>
        {iso.jp ? (
          <>
            {jpText(iso.jp)}
            {iso.jp.startsWith("(") ? <span className={shared.muted}> (tentative)</span> : null} <SourceChip id={source} sources={sources} />
          </>
        ) : (
          <MissingValue m={absent("ENSDF assigns no spin and parity to this ground state.")} />
        )}
      </dd>
      <dt>Half-life</dt>
      <dd>
        <HalfLife iso={iso} sources={sources} />
      </dd>
      <dt>Natural abundance</dt>
      <dd>
        <Quantity q={iso.abundance} sources={sources} />
      </dd>
      <dt>Atomic mass</dt>
      <dd>
        <Quantity q={isMissing(iso.mass) ? iso.mass : tidy(iso.mass)} sources={sources} />
      </dd>
      <dt>Mass excess</dt>
      <dd>
        <Quantity q={iso.massExcess} sources={sources} />
      </dd>
      <dt>Binding energy per nucleon</dt>
      <dd>
        <Quantity q={iso.bindingPerNucleon} sources={sources} />
      </dd>
      <dt>Magnetic dipole moment μ</dt>
      <dd>
        <Quantity q={iso.mu} sources={sources} />
      </dd>
      <dt>Electric quadrupole moment Q</dt>
      <dd>
        <Quantity q={iso.Q} sources={sources} />
      </dd>
      <dt>Charge radius</dt>
      <dd>
        <Quantity q={iso.chargeRadius ?? absent("The IAEA table gives no charge radius for this nuclide.")} sources={sources} />
      </dd>
      <dt>Discovered</dt>
      <dd>
        {iso.discoveryYear ? (
          <>
            {iso.discoveryYear} <SourceChip id={source} sources={sources} />
          </>
        ) : (
          <MissingValue m={absent("The IAEA table gives no discovery year.")} />
        )}
      </dd>
    </dl>
  );
}

// --- The isotope strip ---------------------------------------------------------------------------

/** Named times for the half-life axis: exact definitions, not data. */
const GUIDES: Array<[string, number]> = [
  ["10⁻²¹ s", 1e-21],
  ["10⁻¹⁸ s", 1e-18],
  ["10⁻¹⁵ s", 1e-15],
  ["1 ps", 1e-12],
  ["1 ns", 1e-9],
  ["1 μs", 1e-6],
  ["1 ms", 1e-3],
  ["1 s", 1],
  ["1 hour", 3600],
  ["1 day", 86400],
  ["1 year", SECONDS_PER_YEAR],
  ["1000 years", 1e3 * SECONDS_PER_YEAR],
  ["1 million years", 1e6 * SECONDS_PER_YEAR],
  ["1 billion years", 1e9 * SECONDS_PER_YEAR],
  ["10¹⁵ years", 1e15 * SECONDS_PER_YEAR],
  ["10²⁰ years", 1e20 * SECONDS_PER_YEAR],
];

const DECADES: Array<[string, number]> = ["ns", "μs", "ms", "s"].flatMap((u, k) =>
  [1, 10, 100].map((m): [string, number] => [`${m} ${u}`, m * 10 ** (3 * k - 9)]),
);

function Strip({
  e,
  isotopes,
  selected,
  onSelect,
  prefix,
}: {
  e: ElementIndexEntry;
  isotopes: Isotope[];
  selected: number;
  onSelect: (a: number) => void;
  prefix: string;
}) {
  const logs =isotopes.map(halfLifeSeconds).filter((t): t is number => t !== null).map(Math.log10);
  const lo = logs.length ? Math.floor(Math.min(...logs)) - 1 : -1;
  const hi = logs.length ? Math.ceil(Math.max(...logs)) + 1 : 1;
  const nMin = Math.min(...isotopes.map((i) => i.N));
  const nMax = Math.max(...isotopes.map((i) => i.N));
  const natural = isotopes.filter((i) => !isMissing(i.abundance));
  const caption = (
    <>
      Plotted: every known isotope of {e.name.toLowerCase()} by neutron number N; bar height is the half-life on a
      logarithmic scale, stable isotopes reach the top, and the texture and colour give the main
      decay mode. Dots above the bars show the natural abundance{natural.length ? "" : " (none occurs in nature)"}.
      Dashed lines mark magic neutron numbers. Data: IAEA LiveChart of Nuclides (ENSDF, AME). Select a bar, or use
      the list below, to see an isotope's record.
    </>
  );
  const table = {
    columns: ["Isotope", "N", "Spin and parity", "Half-life", "Main decay", "Natural abundance"],
    rows: isotopes.map((i) => {
      const d = dominantDecay(i);
      return {
        key: String(i.A),
        cells: [
          isotopeLabel(i.A, e.symbol),
          `${i.N}${isMagic(i.N) ? " (magic)" : ""}`,
          spinParity(i),
          halfLifeText(i),
          i.stable ? "stable" : d ? modeLabel(d.mode) : "not known",
          isMissing(i.abundance) ? "none" : `${sci(i.abundance.value, i.abundance.unc)} %`,
        ],
      };
    }),
  };
  return (
    <ChartFrame title="Every known isotope" caption={caption} table={table} testId="isotope-strip">
      {({ width, captionId }) => {
        const H = 270;
        const M = { top: 48, right: 12, bottom: 40, left: 92 };
        // Bars at most 28 px wide, centred: an element with one or two known isotopes gets slim bars.
        const plotW = width - M.left - M.right;
        const slot = Math.min(28, plotW / (nMax - nMin + 1));
        const x0 = M.left + (plotW - slot * (nMax - nMin + 1)) / 2;
        const x = (n: number) => x0 + (n - nMin) * slot;
        const y = scaleLinear().domain([lo, hi]).range([H - M.bottom, M.top + 8]);
        const top = M.top + 2;
        const base = H - M.bottom;
        const named = GUIDES.filter(([, s]) => Math.log10(s) > lo && Math.log10(s) < hi);
        // A narrow range (one short-lived isotope) gets every power of ten instead.
        const guides = named.length >= 3 ? named : DECADES.filter(([, s]) => Math.log10(s) > lo && Math.log10(s) < hi);
        let last = Infinity;
        const shown = guides.filter(([, s]) => {
          const py = y(Math.log10(s));
          if (last - py < 15) return false;
          last = py;
          return true;
        });
        const ns = isotopes.map((i) => i.N);
        const round = ns.filter((n) => n % (slot < 14 ? 10 : 5) === 0);
        const nTicks = round.length >= 2 ? round : slot >= 22 ? ns : [...new Set([nMin, nMax])];
        const maxAb = Math.max(1, ...natural.map((i) => (i.abundance as { value: number }).value));
        const geometry = (i: Isotope) => {
          const t = halfLifeSeconds(i);
          const inset = Math.min(1, slot * 0.08);
          const yTop = i.stable ? top : t !== null ? y(Math.log10(t)) : base - 6;
          return { t, bx: x(i.N) + inset, bw: Math.max(1, slot - 2 * inset), yTop, h: Math.max(2, base - yTop) };
        };
        const sel = isotopes.find((i) => i.A === selected);
        let lastLabel = -Infinity;
        const pick = (ev: MouseEvent<SVGSVGElement>) => {
          const r = ev.currentTarget.getBoundingClientRect();
          const n = nMin + Math.floor((ev.clientX - r.left - x0) / slot);
          const hit = isotopes.find((i) => i.N === n);
          if (hit) onSelect(hit.A);
        };
        return (
          // A pointer shortcut for the labelled "Isotope" list below, which is the keyboard and
          // screen-reader route; the chart itself is an image with a table alternative.
          <svg width={width} height={H} role="img" aria-labelledby={captionId} onClick={pick} className={styles.strip}>
            <Patterns prefix={prefix} />
            <g className={viz.axis}>
              {shown.map(([label, s]) => (
                <g key={label} transform={`translate(0 ${y(Math.log10(s))})`}>
                  <line x1={M.left} x2={width - M.right} className={viz.grid} />
                  <text x={M.left - 6} dy="0.32em" textAnchor="end">
                    {label}
                  </text>
                </g>
              ))}
              {nTicks.map((n) => (
                <text key={n} x={x(n) + slot / 2} y={base + 21} textAnchor="middle">
                  {n}
                </text>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              Neutron number N
            </text>
            <text className={viz.axisTitle} x={4} y={14}>
              Half-life
            </text>
            <text className={viz.axisTitle} x={4} y={28}>
              (log scale)
            </text>
            {MAGIC_NUMBERS.filter((m) => m >= nMin && m <= nMax).map((m) => {
              const lx = x(m) + slot / 2;
              const anchor = lx > width - M.right - 30 ? "end" : lx < M.left + 30 ? "start" : "middle";
              // Labels that would touch the previous one are left out; the dashed line stays.
              const labelled = lx - lastLabel >= 52;
              if (labelled) lastLabel = lx;
              return (
                <g key={m}>
                  <line x1={lx} x2={lx} y1={M.top - 2} y2={base} className={styles.magic} />
                  {labelled && (
                    <text className={viz.label} x={lx} y={M.top - 6} textAnchor={anchor}>
                      N = {m}
                    </text>
                  )}
                </g>
              );
            })}
            {isotopes.map((i) => {
              const { t, bx, bw, yTop, h } = geometry(i);
              const fam = isotopeFamily(i);
              const unknown = !i.stable && t === null;
              return (
                <g key={i.A} data-a={i.A}>
                  <rect
                    x={bx}
                    y={yTop}
                    width={bw}
                    height={h}
                    style={{ fill: unknown ? "none" : `url(#${prefix}-${fam})` }}
                    className={unknown ? styles.unknownBar : styles.bar}
                  >
                    <title>{`${isotopeLabel(i.A, e.symbol)}: ${halfLifeText(i)}${i.stable ? "" : `, ${FAMILY[fam].label.toLowerCase()}`}`}</title>
                  </rect>
                  {i.stable && slot >= 9 && (
                    <text className={styles.stableMark} x={bx + bw / 2} y={top + 10} textAnchor="middle">
                      S
                    </text>
                  )}
                  {!isMissing(i.abundance) && (
                    <circle cx={bx + bw / 2} cy={16} r={1.5 + 5 * Math.sqrt(i.abundance.value / maxAb)} className={styles.abundance}>
                      <title>{`${isotopeLabel(i.A, e.symbol)}: ${sci(i.abundance.value, i.abundance.unc)} % of natural ${e.name.toLowerCase()}`}</title>
                    </circle>
                  )}
                </g>
              );
            })}
            {sel &&
              (() => {
                const { bx, bw, yTop, h } = geometry(sel);
                return (
                  <g aria-hidden="true">
                    <rect x={bx - 1} y={yTop - 1} width={bw + 2} height={h + 2} className={styles.selectedBar} />
                    <path d={`M${bx + bw / 2} ${base + 2}l-4 6h8z`} className={styles.selectedMark} />
                  </g>
                );
              })()}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function Legend({ prefix, families, unmeasured, natural }: { prefix: string; families: Family[]; unmeasured: boolean; natural: boolean }) {
  return (
    <ul className={styles.legend} aria-label="Key to the isotope chart">
      {FAMILIES.filter((f) => families.includes(f.id)).map((f) => (
        <li key={f.id}>
          <Swatch prefix={prefix} family={f.id} />
          {f.label}
          {f.id === "stable" ? " (full height, marked S where there is room)" : ""}
        </li>
      ))}
      {unmeasured && (
        <li>
          <svg width={18} height={12} aria-hidden="true" className={styles.swatch}>
            <rect x={1} y={6} width={16} height={5} className={styles.unknownBar} style={{ fill: "none" }} />
          </svg>
          Half-life not measured (dashed stub)
        </li>
      )}
      {natural && (
        <li>
          <svg width={18} height={12} aria-hidden="true" className={styles.swatch}>
            <circle cx={9} cy={6} r={4} className={styles.abundance} />
          </svg>
          Natural abundance (dot size)
        </li>
      )}
    </ul>
  );
}

// --- Survival ------------------------------------------------------------------------------------

function Survival({ iso, e }: { iso: Isotope; e: ElementIndexEntry }) {
  const t12 = halfLifeSeconds(iso) as number;
  const [unit, setUnit] = useState<TimeUnit>(() => naturalUnit(t12));
  const [text, setText] = useState(() => String(Number((t12 / TIME_UNITS[naturalUnit(t12)].seconds).toPrecision(4))));
  const ids = useId();
  const t = Number(text) * TIME_UNITS[unit].seconds;
  const valid = Number.isFinite(t) && t >= 0;
  const p = valid ? survivingFraction(t, t12) : NaN;
  const pText = !valid ? "—" : p >= 1e-4 ? `${p.toPrecision(4)} (${(100 * p).toPrecision(4)} %)` : `${sci(p)}`;
  const label = isotopeLabel(iso.A, e.symbol);
  const unitSec = TIME_UNITS[unit].seconds;
  const caption = (
    <>
      Plotted: the fraction of {label} nuclei left after time t, N(t)/N₀ = exp(−λt) with λ = ln 2 / t½, over five
      half-lives; the same curve is the chance that one given nucleus is still there. Half-life from the IAEA LiveChart
      of Nuclides.
    </>
  );
  const samples = Array.from({ length: 6 }, (_, k) => k);
  const table = {
    columns: ["Time", "Fraction left"],
    rows: samples.map((k) => ({
      key: String(k),
      cells: [`${k} half-li${k === 1 ? "fe" : "ves"} = ${sci((k * t12) / unitSec)} ${TIME_UNITS[unit].label}`, `${(0.5 ** k).toPrecision(4)}`],
    })),
  };
  return (
    <div>
      <p>
        <Formula tex={String.raw`\frac{N(t)}{N_0} = e^{-\lambda t},\quad \lambda = \frac{\ln 2}{t_{1/2}}`} />
        <span className={shared.muted}>
          {" "}
          — here λ = {sci(decayConstant(t12))} s⁻¹; mean lifetime τ = 1/λ = {sci(meanLifetime(t12) / unitSec)} {TIME_UNITS[unit].label}.
        </span>
      </p>
      <div className={styles.readout}>
        <label htmlFor={`${ids}-t`}>Probability that a given {label} nucleus survives</label>
        <input
          id={`${ids}-t`}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          className={styles.number}
        />
        <label htmlFor={`${ids}-u`} className="visually-hidden">
          Time unit
        </label>
        <select id={`${ids}-u`} value={unit} onChange={(ev) => setUnit(ev.target.value as TimeUnit)} className={styles.select}>
          {(Object.keys(TIME_UNITS) as TimeUnit[]).map((u) => (
            <option key={u} value={u}>
              {TIME_UNITS[u].label}
            </option>
          ))}
        </select>
        <span>:</span>
        <output htmlFor={`${ids}-t ${ids}-u`} aria-live="polite" className={styles.result} data-testid="survival-readout">
          {pText}
        </output>
      </div>
      <ChartFrame caption={caption} table={table} testId="survival-curve">
        {({ width, captionId }) => {
          const H = 180;
          const M = { top: 10, right: 14, bottom: 34, left: 48 };
          const span = 5 * t12;
          const x = scaleLinear().domain([0, span / unitSec]).range([M.left, width - M.right]);
          const y = scaleLinear().domain([0, 1]).range([H - M.bottom, M.top]);
          const pts = Array.from({ length: 121 }, (_, k) => (k / 120) * span);
          const d = line<number>()
            .x((s) => x(s / unitSec))
            .y((s) => y(survivingFraction(s, t12)))(pts);
          const marker = valid && t <= span ? t : null;
          return (
            <svg width={width} height={H} role="img" aria-labelledby={captionId}>
              <g className={viz.axis}>
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <g key={v} transform={`translate(0 ${y(v)})`}>
                    <line x1={M.left} x2={width - M.right} className={viz.grid} />
                    <text x={M.left - 6} dy="0.32em" textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}
                {samples.map((k) => (
                  <text key={k} x={x((k * t12) / unitSec)} y={H - M.bottom + 16} textAnchor="middle">
                    {k === 0 ? "0" : `${k} t½`}
                  </text>
                ))}
              </g>
              <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
                Time ({TIME_UNITS[unit].label}; t½ = {sci(t12 / unitSec)})
              </text>
              {d && <path d={d} className={styles.curve} />}
              {marker !== null && (
                <circle cx={x(marker / unitSec)} cy={y(survivingFraction(marker, t12))} r={4.5} className={styles.marker} />
              )}
            </svg>
          );
        }}
      </ChartFrame>
    </div>
  );
}

function Decays({ iso, e, sources }: { iso: Isotope; e: ElementIndexEntry; sources: Sources }) {
  if (iso.stable) return <MissingValue m={NOTHING_TO_DECAY} />;
  return (
    <>
      {iso.decays.length ? (
        <ul className={styles.decays} data-testid="decay-modes">
          {iso.decays.map((d) => (
            <li key={d.mode}>
              {modeLabel(d.mode)}
              {modeLabel(d.mode) !== d.mode ? <span className={shared.muted}> ({d.mode})</span> : null}: <Branching q={d.branching} />
            </li>
          ))}
        </ul>
      ) : (
        <p>
          <MissingValue m={{ missing: true, reason: "not_measured", note: "The IAEA table lists no decay mode for this nuclide." }} />
        </p>
      )}
      {halfLifeSeconds(iso) !== null ? (
        <Survival key={iso.A} iso={iso} e={e} />
      ) : (
        <p>
          Survival curve: <MissingValue m={{ missing: true, reason: "not_measured", note: "It needs a half-life, and this nuclide's is not known." }} />
        </p>
      )}
      <p className={shared.muted}>
        Branching ratios from the IAEA LiveChart of Nuclides <SourceChip id="iaea_livechart" sources={sources} />.
      </p>
    </>
  );
}

// --- Binding energy -------------------------------------------------------------------------------

function Binding({ e, isotopes, fe, ni }: { e: ElementIndexEntry; isotopes: Isotope[]; fe: IsotopesFile; ni: IsotopesFile }) {
  const pts = isotopes
    .filter((i) => !isMissing(i.bindingPerNucleon))
    .map((i) => {
      const q = i.bindingPerNucleon as { value: number; flag?: string };
      return { a: i.A, mev: q.value / 1000, estimated: q.flag === "estimated" };
    });
  const ni62 = ni.isotopes.find((i) => i.A === 62)?.bindingPerNucleon;
  const fe56 = fe.isotopes.find((i) => i.A === 56)?.bindingPerNucleon;
  const ref = ni62 && !isMissing(ni62) ? ni62.value / 1000 : null;
  const feV = fe56 && !isMissing(fe56) ? fe56.value / 1000 : null;
  if (!pts.length) {
    return <MissingValue m={{ missing: true, reason: "not_measured", note: "The IAEA table gives no binding energies for this element's isotopes." }} />;
  }
  const caption = (
    <>
      Plotted: binding energy per nucleon (MeV) against mass number A for {e.name.toLowerCase()}'s isotopes; hollow
      points are Atomic Mass Evaluation estimates from systematics. The dashed line is nickel-62
      {ref !== null ? ` (${ref.toFixed(4)} MeV)` : ""}, the most tightly bound nucleus per nucleon; iron-56
      {feV !== null ? ` (${feV.toFixed(4)} MeV)` : ""}, just below it, has the lowest mass per nucleon. Data: IAEA
      LiveChart of Nuclides (AME).
    </>
  );
  const table = {
    columns: ["Mass number A", "Binding energy per nucleon (MeV)"],
    rows: pts.map((p) => ({ key: String(p.a), cells: [`${isotopeLabel(p.a, e.symbol)}`, `${p.mev.toFixed(4)}${p.estimated ? " (estimated)" : ""}`] })),
  };
  return (
    <ChartFrame title="Binding energy per nucleon" caption={caption} table={table} testId="binding-chart">
      {({ width, captionId }) => {
        const H = 200;
        const M = { top: 12, right: 14, bottom: 34, left: 48 };
        const as = pts.map((p) => p.a);
        const aLo = Math.min(...as);
        const aHi = Math.max(...as);
        const showFe = feV !== null && aLo <= 56 && aHi >= 56;
        const vs = [...pts.map((p) => p.mev), ...(ref !== null ? [ref] : [])];
        const x = scaleLinear()
          .domain([Math.min(aLo - 1, (aLo + aHi) / 2 - 4), Math.max(aHi + 1, (aLo + aHi) / 2 + 4)])
          .range([M.left, width - M.right]);
        const y = scaleLinear()
          .domain([Math.max(0, Math.min(...vs) - 0.3), Math.max(...vs) + 0.3])
          .range([H - M.bottom, M.top]);
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0 ${y(t)})`}>
                  <line x1={M.left} x2={width - M.right} className={viz.grid} />
                  <text x={M.left - 6} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {x.ticks(6).filter(Number.isInteger).map((t) => (
                <text key={t} x={x(t)} y={H - M.bottom + 16} textAnchor="middle">
                  {t}
                </text>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              Mass number A
            </text>
            {ref !== null && (
              <g>
                <line x1={M.left} x2={width - M.right} y1={y(ref)} y2={y(ref)} className={styles.reference} />
                <text className={viz.label} x={width - M.right} y={y(ref) - 4} textAnchor="end">
                  ⁶²Ni, the maximum
                </text>
              </g>
            )}
            {pts.map((p) => (
              <circle key={p.a} cx={x(p.a)} cy={y(p.mev)} r={3} className={p.estimated ? styles.hollow : styles.dot}>
                <title>{`${isotopeLabel(p.a, e.symbol)}: ${p.mev.toFixed(4)} MeV${p.estimated ? " (estimated)" : ""}`}</title>
              </circle>
            ))}
            {showFe && feV !== null && (
              <g>
                <rect x={x(56) - 4.5} y={y(feV) - 4.5} width={9} height={9} transform={`rotate(45 ${x(56)} ${y(feV)})`} className={styles.fe} />
                <text className={viz.label} x={x(56) + 8} y={y(feV) + 14}>
                  ⁵⁶Fe
                </text>
              </g>
            )}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

// --- Cosmic origin --------------------------------------------------------------------------------

const ORIGIN_IDS: Record<keyof CosmicOrigin["fractions"], string> = {
  bigBang: "bigbang",
  cosmicRays: "cosmic-rays",
  agb: "agb",
  massiveStars: "massive-stars",
  neutronStarMergers: "neutron-star-mergers",
  whiteDwarfs: "white-dwarfs",
};

function Origin({ e, origin, trends, sources }: { e: ElementIndexEntry; origin: CosmicOrigin | Missing; trends: TrendsFile; sources: Sources }) {
  if (isMissing(origin)) return <MissingValue m={origin} />;
  const classes = trends.maps.find((m) => m.id === "origin")?.classes ?? [];
  const parts = (Object.keys(ORIGIN_IDS) as Array<keyof CosmicOrigin["fractions"]>)
    .map((k) => {
      const share = origin.fractions[k];
      const cls = classes.find((c) => c.id === ORIGIN_IDS[k]);
      // A recycled share is material those stars returned in their winds, not material they made.
      const recycled = origin.recycled?.includes(k) ?? false;
      return share
        ? {
            key: k,
            share,
            label: `${cls?.label ?? k}${recycled ? ", returned, not made" : ""}`,
            description: recycled
              ? `Returned to space in these stars' winds; they did not make it (see the note below).`
              : (cls?.description ?? ""),
            tone: cls?.tone ?? 8,
            short: `${cls?.short ?? ""}${recycled ? " (returned)" : ""}`,
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const caption = (
    <>
      Plotted: the share of the {e.name.toLowerCase()} present when the Solar System formed that each process made,
      {origin.flag === "paper_statement" ? " as the paper states it (not a modelled fraction)" : " read off Fig. 39 of the paper in 5 % steps"}.
      Data: Kobayashi, Karakas &amp; Lugaro (2020), a model of the Galaxy's chemical evolution.
    </>
  );
  const table = {
    columns: ["Process", "Share", "What it is"],
    rows: parts.map((p) => ({ key: p.key, cells: [p.label, `${Math.round(p.share * 100)} %`, p.description] })),
  };
  return (
    <>
      <Badge>
        An approximation: these shares come from a model, not a measurement, and were read off a published figure.{" "}
        <SourceChip id={origin.source} sources={sources} />
      </Badge>
      <ChartFrame caption={caption} table={table} testId="origin-bar">
        {({ width, captionId }) => {
          const H = 40;
          let acc = 0;
          return (
            <svg width={width} height={H} role="img" aria-labelledby={captionId}>
              {parts.map((p) => {
                const x0 = acc * width;
                const w = p.share * width;
                acc += p.share;
                return (
                  <g key={p.key}>
                    <rect x={x0} y={0} width={Math.max(0, w - 1)} height={H} style={{ fill: `var(--map-${p.tone})` }} />
                    {w > 70 && (
                      <text x={x0 + 6} y={H / 2} dy="0.32em" className={styles.onTone}>
                        {p.short} {Math.round(p.share * 100)} %
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        }}
      </ChartFrame>
      <dl className={shared.facts}>
        {parts.map((p) => (
          <div key={p.key} className={styles.row}>
            <dt>
              {p.label} ({p.short})
            </dt>
            <dd>
              {Math.round(p.share * 100)} % — {p.description}
            </dd>
          </div>
        ))}
      </dl>
      <p className={shared.muted}>{origin.note}</p>
    </>
  );
}

// --- Thorium-229 ----------------------------------------------------------------------------------

const thoriumClock = (m: MetrologyFile) => m.clocks.find((c) => c.Z === 90 && c.kind === "nuclear");
const thoriumEvents = (m: MetrologyFile): Timeline => m.timeline.filter((t) => /thorium|th-229/i.test(t.text));
/** A CODATA value as printed there, with the power of ten written out: 6.626 070 15 × 10⁻³⁴. */
const codata = (text: string) => text.replace(/\s*e([+-]?\d+)$/, (_, x: string) => ` × 10${sup(String(Number(x)))}`);

function Thorium({ metrology, sources }: { metrology: MetrologyFile; sources: Sources }) {
  const clock = thoriumClock(metrology);
  const events = thoriumEvents(metrology);
  if (!clock) return null;
  const f = clock.frequency;
  const ev = photonEnergyEv(f.value);
  const evUnc = f.unc ? photonEnergyEv(f.unc) : undefined;
  return (
    <Section title="Thorium-229: a nuclear clock" id="thorium">
      <p>
        {clock.transition}. Its frequency: <Quantity q={f} sources={sources} />
        {f.doi && (
          <>
            {" "}
            (<a href={`https://doi.org/${f.doi}`}>doi:{f.doi}</a>)
          </>
        )}
        .
      </p>
      <p>
        <Formula tex={String.raw`E = h\nu`} /> = {sci(ev, evUnc)} eV, about {ev.toFixed(2)} eV{" "}
        <span className={shared.muted}>
          (computed here with the exact h and e of the SI: h = {codata(CODATA.h.text)} J s, e = {codata(CODATA.e.text)} C{" "}
          <SourceChip id="nist_codata" sources={sources} />) — the lowest excited state of any atomic nucleus, low enough
          for a laser to reach.
        </span>
      </p>
      {events.length > 0 && (
        <ul className={styles.timeline}>
          {events.map((t) => (
            <li key={`${t.year}-${t.text}`}>
              <strong>{t.year}</strong> — {t.text}{" "}
              {t.doi ? <a href={`https://doi.org/${t.doi}`}>doi:{t.doi}</a> : t.arxiv ? <a href={`https://arxiv.org/abs/${t.arxiv}`}>arXiv:{t.arxiv}</a> : null}{" "}
              <SourceChip id={t.source} sources={sources} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// --- The panel ------------------------------------------------------------------------------------

function Content({
  e,
  d,
  file,
  fe,
  ni,
  trends,
  metrology,
  sources,
}: {
  e: ElementIndexEntry;
  d: ElementDetailFile;
  file: IsotopesFile;
  fe: IsotopesFile;
  ni: IsotopesFile;
  trends: TrendsFile;
  metrology: MetrologyFile;
  sources: Sources;
}) {
  const isotopes = [...file.isotopes].sort((a, b) => a.A - b.A);
  const [selectedA, setSelectedA] = useState(() => defaultIsotope(isotopes, d.probability.referenceIsotope).A);
  const iso = isotopes.find((i) => i.A === selectedA) ?? (isotopes[0] as Isotope);
  const prefix = `nuc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const families = [...new Set(isotopes.map(isotopeFamily))];
  const ids = useId();
  const zMagic = isMagic(e.Z);
  const doubly = isotopes.filter((i) => magicKind(e.Z, i.N) === "doubly");
  const thorium = e.Z === 90 ? [thoriumClock(metrology), thoriumEvents(metrology), { source: "nist_codata" }] : [];
  return (
    <div className={styles.panel}>
      {(zMagic || doubly.length > 0) && (
        <p className={styles.magicNote} data-testid="magic-note">
          {zMagic && <>Z = {e.Z} is a magic number: {e.name.toLowerCase()}'s nuclei have a closed proton shell and are unusually stable. </>}
          {doubly.length > 0 && <>Doubly magic (closed proton and neutron shells): {doubly.map((i) => isotopeLabel(i.A, e.symbol)).join(", ")}.</>}
        </p>
      )}
      <Section title="Isotopes" id="isotopes">
        <Strip e={e} isotopes={isotopes} selected={iso.A} onSelect={setSelectedA} prefix={prefix} />
        <Legend
          prefix={prefix}
          families={families}
          unmeasured={isotopes.some((i) => !i.stable && halfLifeSeconds(i) === null)}
          natural={isotopes.some((i) => !isMissing(i.abundance))}
        />
        <p className={styles.pickRow}>
          <label htmlFor={`${ids}-iso`}>Isotope</label>{" "}
          <select id={`${ids}-iso`} value={iso.A} onChange={(ev) => setSelectedA(Number(ev.target.value))} className={styles.select} data-testid="isotope-select">
            {isotopes.map((i) => (
              <option key={i.A} value={i.A}>
                {isotopeLabel(i.A, e.symbol)} — {halfLifeText(i)}
                {isMissing(i.abundance) ? "" : `, ${sci(i.abundance.value)} % natural`}
              </option>
            ))}
          </select>
        </p>
        <Record iso={iso} e={e} source={file.source} sources={sources} />
      </Section>
      <Section title={`How ${isotopeLabel(iso.A, e.symbol)} decays`} id="decay">
        <Decays iso={iso} e={e} sources={sources} />
      </Section>
      <Section title="How tightly the nucleus is bound" id="binding">
        <Binding e={e} isotopes={isotopes} fe={fe} ni={ni} />
      </Section>
      <Section title="Spin and parity" id="spin">
        <details className={styles.details}>
          <summary>
            {isotopes.length === 1 ? "Spin and parity of the one known isotope" : `Spin and parity of all ${isotopes.length} isotopes`} (ENSDF;
            brackets mark tentative assignments)
          </summary>
          <table className={viz.table} data-testid="spin-parity">
            <thead>
              <tr>
                <th scope="col">Isotope</th>
                <th scope="col">Spin and parity</th>
              </tr>
            </thead>
            <tbody>
              {isotopes.map((i) => (
                <tr key={i.A}>
                  <th scope="row">{isotopeLabel(i.A, e.symbol)}</th>
                  <td>{spinParity(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>
      <Section title="Where it was made" id="origin">
        <Origin e={e} origin={d.nucleus.origin} trends={trends} sources={sources} />
      </Section>
      {e.Z === 90 && <Thorium metrology={metrology} sources={sources} />}
      <SourcesFooter
        ids={collectSources(file, d.nucleus.origin, thorium, trends.maps.find((m) => m.id === "origin"))}
        sources={sources}
      />
    </div>
  );
}

function WithIsotopes({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const file = useIsotopes(e.Z, d.files.isotopes);
  const fe = useJson<IsotopesFile>("isotopes/26.json");
  const ni = useJson<IsotopesFile>("isotopes/28.json");
  const trends = useTrends();
  const metrology = useMetrology();
  if (!d.files.isotopes) {
    return (
      <p>
        <MissingValue m={{ missing: true, reason: "not_measured", note: "The IAEA LiveChart of Nuclides lists no isotopes for this element." }} />
      </p>
    );
  }
  return (
    <WhenLoaded files={[file, fe, ni, trends, metrology]}>
      {(f, feF, niF, tr, met) => <Content e={e} d={d} file={f} fe={feF} ni={niF} trends={tr} metrology={met} sources={sources} />}
    </WhenLoaded>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <WithIsotopes e={e} d={d} sources={sources} />}</WhenLoaded>;
}
