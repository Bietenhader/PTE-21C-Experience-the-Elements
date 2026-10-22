// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Probability & statistics (SPEC §10.3): where the electron probably is (the radial probability and
// its cumulative distribution), whether each isotope is a boson or a fermion, the Maxwell–Boltzmann
// speeds of the gas from 1000 K down to the laser-cooling limits with the density a Bose–Einstein
// condensate would need, the isotope mixture behind the atomic weight, and uncertainty itself.

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useId, useMemo, useState } from "react";
import { useElementDetail, useIsotopes, type Loaded } from "../../data/load";
import { concise, isInterval, isMissing } from "../../data/format";
import type { ElementDetailFile, ElementIndexEntry, Isotope, IsotopesFile, SourcesFile } from "../../data/types";
import { enclosedProbability, radialDistribution } from "../../physics/hydrogenic";
import { statistics } from "../../physics/nuclear";
import { condensationDensity, maxwellBoltzmann, meanSpeed, mostProbableSpeed, rmsSpeed, thermalWavelength } from "../../physics/thermal";
import { Formula } from "../../ui/Formula";
import { MissingValue, Quantity, Unit } from "../../ui/Quantity";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { withPrefix } from "../amo/model";
import { isotopeLabel, sci } from "../nucleus/model";
import { A0_PM, type SubshellInfo, subshells } from "../orbitals/model";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import {
  coolingLimitsFor,
  precisionExtremes,
  precisionList,
  referenceIsotope,
  isotopeMassKg,
  statisticsRows,
  T_MAX,
  tMin,
} from "./model";
import styles from "./probability.module.css";

type Sources = SourcesFile["sources"];
const SAMPLES = 240;

/** Temperatures: plain kelvin from 1 K up ("300 K", "1000 K"), with a prefix below ("146 μK"). */
const kelvin = (t: number): string => (t >= 1 ? `${Number(t.toPrecision(3))} K` : withPrefix(t, "K", 3));

// --- Where is the electron? ------------------------------------------------------------------------

function Radial({ e, d }: { e: ElementIndexEntry; d: ElementDetailFile }) {
  const list = useMemo(() => subshells(e, d), [e, d]);
  const initial = [...list].reverse().find((s) => s.valence) ?? list[list.length - 1];
  const [key, setKey] = useState(initial ? `${initial.n},${initial.l}` : "");
  const s = list.find((x) => `${x.n},${x.l}` === key) ?? initial;
  const [within, setWithin] = useState<number | null>(null);
  const sliderId = useId();
  if (!s) return null;
  const rMax = s.meanPm + 5 * s.spreadPm;
  const r = within ?? Math.round(s.meanPm);
  const pWithin = enclosedProbability(s.n, s.l, s.zeff.value, r / A0_PM);
  const slater = list.some((x) => x.zeff.method === "slater");
  return (
    <Section title="Where is the electron?" id="radial">
      <Badge>
        Hydrogenic approximation with Clementi–Raimondi Z<sub>eff</sub>
        {slater ? " (Slater's rules where their table has no value)" : ""}. Angular shapes are exact for one electron;
        radial scale is approximate for many-electron atoms. Tier B (Hartree–Fock radial functions) planned.
      </Badge>
      <div className={styles.choices} role="group" aria-label="Subshell">
        {list.map((x) => (
          <button
            key={`${x.n},${x.l}`}
            type="button"
            aria-pressed={x === s}
            onClick={() => {
              setKey(`${x.n},${x.l}`);
              setWithin(null);
            }}
            className={styles.choice}
          >
            {x.label}
            {x.valence ? " (valence)" : ""}
          </button>
        ))}
      </div>
      <RadialChart s={s} rMax={rMax} mark={r} />
      <div className={styles.slider}>
        <label htmlFor={sliderId}>Within a radius of</label>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={Math.max(2, Math.round(rMax))}
          step={1}
          value={r}
          onChange={(ev) => setWithin(Number(ev.target.value))}
          aria-valuetext={`${r} pm`}
        />
        <output htmlFor={sliderId} aria-live="polite" data-testid="within-readout">
          {r} pm: the {s.label} electron is inside with probability {(pWithin * 100).toFixed(1)} %
        </output>
      </div>
    </Section>
  );
}

function RadialChart({ s, rMax, mark }: { s: SubshellInfo; rMax: number; mark: number }) {
  const points = useMemo(() => {
    const out: Array<{ r: number; p: number; c: number }> = [];
    let c = 0;
    let prev = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const r = (rMax * i) / SAMPLES;
      const p = radialDistribution(s.n, s.l, s.zeff.value, r / A0_PM) / A0_PM; // per pm
      if (i > 0) c += ((p + prev) / 2) * (rMax / SAMPLES);
      prev = p;
      out.push({ r, p, c });
    }
    return out;
  }, [s, rMax]);
  const pMax = Math.max(...points.map((x) => x.p));
  const caption = (
    <>
      Plotted for the {s.label} subshell (hydrogenic, effective charge {s.zeff.value.toFixed(2)}): the radial
      probability density P(r) = r²R²(r) per picometre (solid) and the probability that the electron is within r (dashed,
      right axis). Marked: the most probable radius r* = {s.mostProbablePm.toFixed(1)} pm and the mean radius ⟨r⟩ ={" "}
      {s.meanPm.toFixed(1)} pm.
    </>
  );
  const table = {
    columns: ["r (pm)", "P(r) (1/pm)", "Probability within r"],
    rows: points
      .filter((_, i) => i % 24 === 0)
      .map((x) => ({ key: String(x.r), cells: [x.r.toFixed(1), x.p.toPrecision(3), `${(x.c * 100).toFixed(1)} %`] })),
  };
  return (
    <ChartFrame caption={caption} table={table} testId="radial-chart">
      {({ width, captionId }) => {
        const H = 250;
        // The markers' labels sit in two rows above the plot, clear of the curves.
        const M = { top: 34, right: 48, bottom: 38, left: 56 };
        const x = scaleLinear().domain([0, rMax]).range([M.left, width - M.right]);
        const y = scaleLinear().domain([0, pMax * 1.1]).range([H - M.bottom, M.top]);
        const yc = scaleLinear().domain([0, 1]).range([H - M.bottom, M.top]);
        const pd = line<{ r: number; p: number }>()
          .x((q) => x(q.r))
          .y((q) => y(q.p))(points);
        const cd = line<{ r: number; c: number }>()
          .x((q) => x(q.r))
          .y((q) => yc(q.c))(points);
        const vmark = (v: number, text: string, row: number) => (
          <g className={styles.mark}>
            <line x1={x(v)} x2={x(v)} y1={14 + row * 12} y2={H - M.bottom} />
            <text className={viz.label} x={x(v) + 3} y={12 + row * 12}>
              {text}
            </text>
          </g>
        );
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {x.ticks(6).map((t) => (
                <g key={t} transform={`translate(${x(t)} 0)`}>
                  <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                  <text y={H - M.bottom + 16} textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
              {[0, 0.5, 1].map((t) => (
                <text key={t} x={width - M.right + 6} y={yc(t)} dy="0.32em">
                  {t === 1 ? "100 %" : t === 0.5 ? "50 %" : "0"}
                </text>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              r (pm)
            </text>
            <text className={viz.axisTitle} transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
              P(r)
            </text>
            {pd && <path d={pd} className={styles.density} />}
            {cd && <path d={cd} className={styles.cumulative} />}
            {vmark(s.mostProbablePm, "r*", 0)}
            {vmark(s.meanPm, "⟨r⟩", 1)}
            <circle cx={x(Math.min(mark, rMax))} cy={yc(enclosedProbability(s.n, s.l, s.zeff.value, mark / A0_PM))} r={4} className={styles.dot} />
          </svg>
        );
      }}
    </ChartFrame>
  );
}

// --- Bosons and fermions --------------------------------------------------------------------------

function Statistics({ e, d, isotopes, sources }: { e: ElementIndexEntry; d: ElementDetailFile; isotopes: readonly Isotope[]; sources: Sources }) {
  const rows = statisticsRows(e, isotopes, d.amo.laserCooling);
  return (
    <Section title="Bosons and fermions" id="statistics">
      <p className={shared.muted}>
        A neutral atom is made of A nucleons and Z = {e.Z} electrons, all fermions. An even total makes the atom a boson
        (integer spin: many can share one state, as in a Bose–Einstein condensate); an odd total makes it a fermion (no
        two in the same state, as in a degenerate Fermi gas).
      </p>
      {rows.length === 0 ? (
        <p>
          <MissingValue m={{ missing: true, reason: "no_stable_isotope", note: "No natural isotope, and none has been brought to quantum degeneracy." }} />
        </p>
      ) : (
        <ul className={styles.statList} data-testid="statistics">
          {rows.map((r) => (
            <li key={r.A}>
              <strong>{r.label}</strong>: {r.A} + {e.Z} = {r.A + e.Z} fermions → <span className={styles.kind}>{r.kind}</span>
              {r.natural ? "" : " (not natural)"}
              {r.bec && (
                <span className={styles.badge}>
                  Bose–Einstein condensate {r.bec.year} <a href={`https://doi.org/${r.bec.doi}`}>doi:{r.bec.doi}</a>{" "}
                  <SourceChip id={r.bec.source} sources={sources} />
                </span>
              )}
              {r.dfg && (
                <span className={styles.badge}>
                  degenerate Fermi gas {r.dfg.year} <a href={`https://doi.org/${r.dfg.doi}`}>doi:{r.dfg.doi}</a>{" "}
                  <SourceChip id={r.dfg.source} sources={sources} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// --- Thermal motion -------------------------------------------------------------------------------

function Thermal({ e, d, isotopes, sources }: { e: ElementIndexEntry; d: ElementDetailFile; isotopes: readonly Isotope[]; sources: Sources }) {
  const iso = referenceIsotope(d, isotopes);
  const mass = iso ? isotopeMassKg(iso) : null;
  const limits = iso ? coolingLimitsFor(d.amo.laserCooling, iso.A, mass) : null;
  const lo = Math.log10(tMin(limits));
  const hi = Math.log10(T_MAX);
  const [logT, setLogT] = useState(Math.log10(300));
  const sliderId = useId();
  if (!iso || mass === null) {
    return (
      <Section title="Thermal motion" id="thermal">
        <p>
          <MissingValue m={{ missing: true, reason: "not_measured", note: "No isotope with a known mass to compute the speeds for." }} />
        </p>
      </Section>
    );
  }
  const T = 10 ** logT;
  const name = isotopeLabel(iso.A, e.symbol);
  const lambda = thermalWavelength(mass, T);
  const nBec = condensationDensity(mass, T);
  const jump = (t: number | null, text: string) =>
    t === null ? null : (
      <button type="button" className={styles.choice} onClick={() => setLogT(Math.min(hi, Math.max(lo, Math.log10(t))))}>
        {text}
      </button>
    );
  return (
    <Section title="Thermal motion" id="thermal">
      <p className={shared.muted}>
        A gas of {name} atoms at temperature T: their speeds follow the Maxwell–Boltzmann distribution f(v), and each atom
        is a wave packet about as long as the thermal de Broglie wavelength λ<sub>dB</sub>. When the packets overlap, a gas
        of bosons condenses. Mass of {name}: <Quantity q={iso.mass} sources={sources} />.
      </p>
      <div className={styles.formulas}>
        <Formula display tex={String.raw`f(v) = 4\pi\left(\frac{m}{2\pi k_\mathrm{B}T}\right)^{3/2} v^2\, e^{-mv^2/2k_\mathrm{B}T}`} />
        <Formula display tex={String.raw`\lambda_\mathrm{dB} = \frac{h}{\sqrt{2\pi m k_\mathrm{B}T}}`} />
        <Formula display tex={String.raw`n\,\lambda_\mathrm{dB}^3 \geq \zeta(3/2) \approx 2.612`} />
      </div>
      <div className={styles.slider}>
        <label htmlFor={sliderId}>Temperature</label>
        <input
          id={sliderId}
          type="range"
          min={lo}
          max={hi}
          step={0.01}
          value={logT}
          onChange={(ev) => setLogT(Number(ev.target.value))}
          aria-valuetext={kelvin(T)}
          data-testid="temperature"
        />
        <output htmlFor={sliderId} aria-live="polite" data-testid="temperature-readout">
          {kelvin(T)}
        </output>
      </div>
      <div className={styles.choices} role="group" aria-label="Go to a temperature">
        {jump(300, "Room temperature (300 K)")}
        {limits && jump(limits.doppler, `Doppler limit of the ${limits.line} line`)}
        {limits && jump(limits.recoil, "Recoil limit")}
      </div>
      <dl className={`${shared.facts} ${styles.readouts}`} data-testid="thermal-readouts">
        <dt>Most probable speed</dt>
        <dd>{withPrefix(mostProbableSpeed(mass, T), "m/s", 3)}</dd>
        <dt>Mean speed</dt>
        <dd>{withPrefix(meanSpeed(mass, T), "m/s", 3)}</dd>
        <dt>Root-mean-square speed</dt>
        <dd>{withPrefix(rmsSpeed(mass, T), "m/s", 3)}</dd>
        <dt>Thermal de Broglie wavelength</dt>
        <dd>{withPrefix(lambda, "m", 3)}</dd>
        <dt>Density for a condensate</dt>
        <dd>
          at this temperature you would need {sci(nBec, undefined, 3)} atoms per m³ ({sci(nBec / 1e6, undefined, 3)} per cm³) for a
          Bose–Einstein condensate{statistics(iso.A, e.Z) === "fermion" ? ` — but ${name} is a fermion, which does not condense on its own` : ""}.
        </dd>
        {limits && (
          <>
            <dt>Laser-cooling limits</dt>
            <dd>
              {limits.doppler !== null ? `Doppler ${kelvin(limits.doppler)}` : "Doppler limit not computable"}
              {limits.recoil !== null ? `, recoil ${kelvin(limits.recoil)}` : ""} (the {limits.line} line, computed; see the AMO
              panel)
            </dd>
          </>
        )}
      </dl>
      <SpeedChart mass={mass} T={T} name={name} />
    </Section>
  );
}

function SpeedChart({ mass, T, name }: { mass: number; T: number; name: string }) {
  const vp = mostProbableSpeed(mass, T);
  const vMax = 3.5 * vp;
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const v = (vMax * i) / SAMPLES;
    return { v, f: maxwellBoltzmann(v, mass, T) };
  });
  const unit = vp >= 1 ? { k: 1, u: "m/s" } : { k: 1e3, u: "mm/s" };
  const fMax = Math.max(...pts.map((p) => p.f));
  const caption = (
    <>
      Plotted: the share of {name} atoms per unit speed at {kelvin(T)}, from the Maxwell–Boltzmann distribution (computed
      with CODATA constants). The dashed lines mark the most probable, mean and root-mean-square speeds.
    </>
  );
  const table = {
    columns: [`Speed (${unit.u})`, "Share per unit speed (relative)"],
    rows: pts.filter((_, i) => i % 24 === 0).map((p) => ({ key: String(p.v), cells: [(p.v * unit.k).toPrecision(3), (p.f / fMax).toFixed(3)] })),
  };
  return (
    <ChartFrame caption={caption} table={table} testId="speed-chart">
      {({ width, captionId }) => {
        const H = 230;
        // Three label rows above the plot for the three speeds.
        const M = { top: 46, right: 16, bottom: 38, left: 40 };
        const x = scaleLinear().domain([0, vMax * unit.k]).range([M.left, width - M.right]);
        const y = scaleLinear().domain([0, fMax * 1.1]).range([H - M.bottom, M.top]);
        const path = line<{ v: number; f: number }>()
          .x((p) => x(p.v * unit.k))
          .y((p) => y(p.f))(pts);
        const mark = (v: number, text: string, row: number) => (
          <g className={styles.mark}>
            <line x1={x(v * unit.k)} x2={x(v * unit.k)} y1={14 + row * 12} y2={H - M.bottom} />
            <text className={viz.label} x={x(v * unit.k) + 3} y={12 + row * 12}>
              {text}
            </text>
          </g>
        );
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {x.ticks(6).map((t) => (
                <g key={t} transform={`translate(${x(t)} 0)`}>
                  <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                  <text y={H - M.bottom + 16} textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              Speed ({unit.u})
            </text>
            <text className={viz.axisTitle} transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
              f(v)
            </text>
            {path && <path d={path} className={styles.density} />}
            {mark(vp, "most probable", 0)}
            {mark(meanSpeed(mass, T), "mean", 1)}
            {mark(rmsSpeed(mass, T), "rms", 2)}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

// --- Isotope mixture ------------------------------------------------------------------------------

function Mixture({ e, isotopes, sources }: { e: ElementIndexEntry; isotopes: readonly Isotope[]; sources: Sources }) {
  const natural = isotopes.filter((i) => !isMissing(i.abundance));
  const w = e.atomicWeight;
  return (
    <Section title="A mixture of isotopes" id="mixture">
      {natural.length === 0 ? (
        <p>
          <MissingValue m={{ missing: true, reason: "no_stable_isotope", note: "No isotope of this element occurs in nature in measurable amounts." }} />
        </p>
      ) : (
        <ul className={styles.bars} data-testid="abundance-bars" aria-label={`Natural isotopic composition of ${e.name}`}>
          {natural.map((i) => {
            const a = i.abundance;
            const share = isMissing(a) ? 0 : a.value;
            return (
              <li key={i.A}>
                <span className={styles.barLabel}>{isotopeLabel(i.A, e.symbol)}</span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span className={styles.barFill} style={{ inlineSize: `${Math.max(0.5, share)}%` }} />
                </span>
                <span className={styles.barValue}>
                  <Quantity q={a} sources={sources} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p>
        Standard atomic weight:{" "}
        {isMissing(w) ? (
          <MissingValue m={w} />
        ) : isInterval(w) ? (
          <>
            an <strong>interval</strong>, [{w.low}, {w.high}] u <SourceChip id={w.source} sources={sources} />
            {w.conventional && (
              <>
                {" "}
                (for everyday use: <Quantity q={w.conventional} sources={sources} />)
              </>
            )}
          </>
        ) : (
          <Quantity q={w} sources={sources} />
        )}
      </p>
      {!isMissing(w) && (
        <p className={shared.muted}>
          {isInterval(w) &&
            `The isotope mix of ${e.name.toLowerCase()} varies between terrestrial samples (minerals, waters, living things), so IUPAC gives the range rather than one number. `}
          The atomic weight is a statistic: the abundance-weighted mean of the isotope masses over normal terrestrial samples,
          not the mass of any one atom.
        </p>
      )}
    </Section>
  );
}

// --- Uncertainty ----------------------------------------------------------------------------------

/** A value with its uncertainty and source; very large or very small ones in powers of ten. */
function Precise({ q, sources }: { q: ReturnType<typeof precisionList>["items"][number]["q"]; sources: Sources }) {
  const exp = Math.floor(Math.log10(Math.abs(q.value)));
  if (exp >= -3 && exp < 6) return <Quantity q={q} sources={sources} />;
  return (
    <span>
      {sci(q.value, q.unc)}
      {q.unit && (
        <>
          {" "}
          <Unit unit={q.unit} />
        </>
      )}{" "}
      <SourceChip id={q.source} sources={sources} />
    </span>
  );
}

function Uncertainty({ e, d, isotopes, sources }: { e: ElementIndexEntry; d: ElementDetailFile; isotopes: readonly Isotope[]; sources: Sources }) {
  const { items, exact } = precisionList(e, d, isotopes);
  const { most, least } = precisionExtremes(items);
  const describe = (p: typeof most) =>
    p && (
      <>
        the {p.label}, <Precise q={p.q} sources={sources} /> — a relative uncertainty of {sci(p.relative, undefined, 2)}
      </>
    );
  return (
    <Section title="Uncertainty, written the NIST way" id="uncertainty">
      <p>
        Every number here carries its standard uncertainty in brackets, in units of its last digits:{" "}
        <strong>{concise(1.00784, 0.00002)}</strong> means 1.007 84 ± 0.000 02, and <strong>{concise(9192631770, 0)}</strong>{" "}
        with "(exact)" is fixed by definition.
      </p>
      {items.length === 0 ? (
        <p>
          <MissingValue m={{ missing: true, reason: "not_measured", note: "No stored value of this element comes with an uncertainty." }} />
        </p>
      ) : (
        <dl className={shared.facts} data-testid="precision">
          <dt>Most precisely known</dt>
          <dd>{describe(most)}.</dd>
          {least && least !== most && (
            <>
              <dt>Least precisely known</dt>
              <dd>
                {describe(least)}{" "}
                <span className={shared.muted}>(among values larger than their uncertainty)</span>.
              </dd>
            </>
          )}
          <dt>Values compared</dt>
          <dd>
            {items.length} with an uncertainty{exact.length ? `; ${exact.length} more are exact by definition (${exact.map((x) => x.label).join(", ")})` : ""}.
          </dd>
        </dl>
      )}
    </Section>
  );
}

// --- The panel ------------------------------------------------------------------------------------

const NONE: Loaded<IsotopesFile | null> = { state: "ready", value: null };

function WithData({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const iso = useIsotopes(e.Z, d.files.isotopes);
  return (
    <WhenLoaded files={[d.files.isotopes ? iso : NONE]}>
      {(file) => {
        const isotopes = file?.isotopes ?? [];
        return (
          <div className={styles.panel}>
            <Radial e={e} d={d} />
            <Statistics e={e} d={d} isotopes={isotopes} sources={sources} />
            <Thermal e={e} d={d} isotopes={isotopes} sources={sources} />
            <Mixture e={e} isotopes={isotopes} sources={sources} />
            <Uncertainty e={e} d={d} isotopes={isotopes} sources={sources} />
            <SourcesFooter
              ids={collectSources(
                d.orbitals.zeff,
                subshells(e, d).map((s) => ({ source: s.zeff.source })),
                d.amo.laserCooling,
                file,
                e.atomicWeight,
                precisionList(e, d, isotopes).items.map((p) => p.q),
                { source: "nist_codata" },
              )}
              sources={sources}
            />
          </div>
        );
      }}
    </WhenLoaded>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <WithData e={e} d={d} sources={sources} />}</WhenLoaded>;
}
