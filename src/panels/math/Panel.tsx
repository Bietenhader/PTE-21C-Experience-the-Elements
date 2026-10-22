// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Mathematical & theoretical (SPEC §10.5): the valence electrons' quantum numbers, the ground term and
// Hund's rules step by step, the Landé factor, the Madelung rule against NIST, Slater's screening with
// its arithmetic, relativity for the 1s electron, and a note on the symmetry behind the table. Every
// number on this panel is computed here from the configuration, the ground term and CODATA, next to
// the measured value it estimates; the rules are named as rules of thumb.

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useSettings } from "../../app/store";
import { useElementDetail, useLevels, useRelativity } from "../../data/load";
import { isMissing } from "../../data/format";
import type { ElementDetailFile, ElementIndexEntry, LevelsFile, Missing, RelativityFile, SourcesFile } from "../../data/types";
import { L_LETTER } from "../../physics/hydrogenic";
import { capacity } from "../../physics/madelung";
import { termParts } from "../../physics/terms";
import { convertEnergy, type EnergyUnit, kjPerMolToEv } from "../../physics/units";
import { Formula } from "../../ui/Formula";
import { MissingValue } from "../../ui/Quantity";
import { SideScroll } from "../../ui/SideScroll";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./math.module.css";
import {
  ANOMALY_TEXT,
  anomalyFor,
  G_S,
  hundFor,
  hydrogenicEnergy,
  landeFor,
  POINT_NUCLEUS_LIMIT,
  relativityFor,
  slaterFor,
  slaterNStar,
  valenceElectrons,
} from "./model";

type Sources = SourcesFile["sources"];
const fmt = (x: number, digits = 3) => Number(x.toPrecision(digits)).toString();
const halfText = (x: number) => (Number.isInteger(x) ? String(x) : `${Math.round(2 * x)}/2`);
const SPIN_WORDS = ["singlet", "doublet", "triplet", "quartet", "quintet", "sextet", "septet", "octet", "nonet"];

/** ²S₁/₂ with the multiplicity raised, J lowered and ° for odd parity; read aloud in words. */
function TermSymbol({ S, L, J, odd }: { S: number; L: number; J: number; odd: boolean }) {
  const t = termParts(S, L, J, odd);
  const spoken = `${SPIN_WORDS[t.multiplicity - 1] ?? `multiplicity ${t.multiplicity}`} ${t.letter}${odd ? ", odd" : ""}, J = ${t.J}`;
  return (
    <span className={styles.term} role="img" aria-label={spoken}>
      <sup>{t.multiplicity}</sup>
      {t.letter}
      {odd && <sup>o</sup>}
      <sub>{t.J}</sub>
    </span>
  );
}

/** NIST's jj-coupled term, (1/2,1/2)0, with J lowered: (½,½)₀. */
function JjTerm({ term }: { term: string }) {
  const m = /^(\(.*\))(.+)$/.exec(term);
  if (!m) return <span className={styles.term}>{term}</span>;
  return (
    <span className={styles.term}>
      {m[1]}
      <sub>{m[2]}</sub>
    </span>
  );
}

function OrbitalBoxes({ e }: { e: ElementIndexEntry }) {
  const shells = valenceElectrons(e);
  return (
    <div className={styles.boxes}>
      {shells.map((s) => {
        const ms = Array.from({ length: 2 * s.l + 1 }, (_, i) => s.l - i);
        return (
          <figure key={`${s.n},${s.l}`} className={styles.shell}>
            <div className={styles.boxRow} aria-hidden="true">
              {ms.map((ml) => {
                const here = s.electrons.filter((x) => x.ml === ml);
                return (
                  <span key={ml} className={styles.box}>
                    <span className={styles.arrows}>
                      {here.some((x) => x.ms > 0) ? "↑" : ""}
                      {here.some((x) => x.ms < 0) ? "↓" : ""}
                    </span>
                    <span className={styles.ml}>{ml > 0 ? `+${ml}` : ml < 0 ? `−${-ml}` : "0"}</span>
                  </span>
                );
              })}
            </div>
            <figcaption>
              {s.n}
              {L_LETTER[s.l]}
              <sup>{s.occupancy}</sup>
              <span className={shared.muted}>{s.closed ? " full" : ` ${s.occupancy} of ${capacity(s.l)}`}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function QuantumNumbers({ e }: { e: ElementIndexEntry }) {
  const shells = valenceElectrons(e);
  const rows = shells.flatMap((s) => s.electrons.map((x, i) => ({ key: `${s.n},${s.l},${i}`, ...x })));
  return (
    <>
      <p className={shared.muted}>
        Each box is one orbital, labelled by its magnetic quantum number m<sub>l</sub>; each arrow is one electron, ↑ for m
        <sub>s</sub> = +½ and ↓ for −½. The electrons go in one per orbital with parallel spins before any pair up (Hund's
        first rule), which is why the open subshell below has as many unpaired spins as it can.
      </p>
      <OrbitalBoxes e={e} />
      <details className={styles.details}>
        <summary>The four quantum numbers of every valence electron ({rows.length})</summary>
        <SideScroll className={styles.tableWrap} label={`Quantum numbers of ${e.name}'s valence electrons`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Subshell</th>
                <th scope="col">n</th>
                <th scope="col">l</th>
                <th scope="col">
                  m<sub>l</sub>
                </th>
                <th scope="col">
                  m<sub>s</sub>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">
                    {r.n}
                    {L_LETTER[r.l]}
                  </th>
                  <td>{r.n}</td>
                  <td>{r.l}</td>
                  <td>{r.ml > 0 ? `+${r.ml}` : r.ml < 0 ? `−${-r.ml}` : "0"}</td>
                  <td>{r.ms > 0 ? "+½" : "−½"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SideScroll>
      </details>
    </>
  );
}

function GroundTerm({ e, levels, sources }: { e: ElementIndexEntry; levels: LevelsFile | null; sources: Sources }) {
  const g = e.groundTerm;
  const h = hundFor(e);
  const hundTerm = <TermSymbol S={h.S} L={h.L} J={h.J} odd={h.parity === "odd"} />;
  const nistLS = !isMissing(g) && g.coupling === "LS" && g.S !== undefined && g.L !== undefined;
  const agree = nistLS && g.S === h.S && g.L === h.L && g.J === h.J && g.parity === h.parity;
  const ground = levels?.levels.find((l) => l.eV === 0);
  // The LS formula is applied to the measured term where NIST gives one in LS coupling (like with
  // like), otherwise to the term Hund's rules give.
  const forLS = nistLS ? { S: g.S ?? 0, L: g.L ?? 0, J: g.J, odd: g.parity === "odd", what: "the measured term" } : { S: h.S, L: h.L, J: h.J, odd: h.parity === "odd", what: "Hund's term" };
  const jZero = (isMissing(g) ? h.J : g.J) === 0;
  const measuredG = jZero ? undefined : ground?.gJ;
  const lsG = landeFor(forLS.S, forLS.L, forLS.J);
  return (
    <>
      <dl className={shared.facts}>
        <dt>Ground term (NIST)</dt>
        <dd>
          {isMissing(g) ? (
            <MissingValue m={g} />
          ) : nistLS ? (
            <>
              <TermSymbol S={g.S ?? 0} L={g.L ?? 0} J={g.J} odd={g.parity === "odd"} />: total spin S = {halfText(g.S ?? 0)}, orbital
              angular momentum L = {g.L} ({termParts(0, g.L ?? 0, 0, false).letter}), total angular momentum J = {halfText(g.J)}
              {g.parity === "odd" ? ", odd parity (°)" : ", even parity"}
              {g.flag === "predicted" ? " — a prediction, not a measurement" : ""} <SourceChip id={g.source} sources={sources} />
            </>
          ) : (
            <>
              <JjTerm term={g.term} /> in {g.coupling === "jj" ? "jj coupling" : "J only"}: J = {halfText(g.J)}{" "}
              <SourceChip id={g.source} sources={sources} />
              <p className={shared.muted}>
                In an atom this heavy, each electron's spin couples to its own orbit more strongly than electrons couple to
                one another, so NIST gives the level in jj coupling and the S and L of Hund's rules are not good quantum
                numbers.
              </p>
            </>
          )}
        </dd>
      </dl>
      <h5 className={styles.subheading}>Hund's rules, step by step</h5>
      {h.open.length === 0 ? (
        <p>
          Every subshell is full: the spins pair up to S = 0, the orbital momenta cancel to L = 0, and J = 0 — the term is{" "}
          {hundTerm}.
        </p>
      ) : (
        <ol className={styles.steps}>
          <li>
            <b>Largest total spin.</b>{" "}
            {h.open.map((o, i) => (
              <span key={`${o.n},${o.l}`}>
                {i > 0 && "; "}
                {o.n}
                {L_LETTER[o.l]}
                <sup>{o.count}</sup>: {o.electrons.filter((x) => x.ms > 0).length} up, {o.electrons.filter((x) => x.ms < 0).length} down →
                S = {halfText(o.S)}
              </span>
            ))}
            {h.open.length > 1 ? `; together S = ${halfText(h.S)}` : ""}.
          </li>
          <li>
            <b>Largest L for that spin.</b> L = |Σm<sub>l</sub>| ={" "}
            {h.open.map((o) => `${o.L}`).join(" + ")}
            {h.open.length > 1 ? ` = ${h.L}` : ""} ({termParts(0, h.L, 0, false).letter}).
          </li>
          <li>
            <b>J from the filling.</b> {h.rule3}: J = {halfText(h.J)}.
          </li>
        </ol>
      )}
      <p>
        Hund's rules give {hundTerm}.{" "}
        {isMissing(g) ? null : agree ? (
          <span className={styles.agree}>✓ The same as the measured term.</span>
        ) : nistLS ? (
          <span className={styles.disagree}>
            ✗ Not the measured term: Hund's rules are a guide, and with several open subshells the electrons can couple
            differently.
          </span>
        ) : (
          <span className={shared.muted}>The measured level is in jj coupling, so the comparison does not apply.</span>
        )}
      </p>
      <h5 className={styles.subheading}>Landé g-factor of the ground level</h5>
      <p>
        <Formula
          tex={String.raw`g_J = 1 + (g_s - 1)\,\frac{J(J+1) + S(S+1) - L(L+1)}{2J(J+1)}`}
          display
        />
      </p>
      <dl className={shared.facts}>
        <dt>
          LS coupling, for {forLS.what} <TermSymbol S={forLS.S} L={forLS.L} J={forLS.J} odd={forLS.odd} />
        </dt>
        <dd>
          {lsG === null ? (
            <MissingValue m={{ missing: true, reason: "not_applicable", note: "J = 0: the formula is undefined and the level has no electronic magnetic moment." }} />
          ) : (
            <>
              g<sub>J</sub> = {lsG.toFixed(5)}{" "}
              <span className={shared.muted}>
                (with g<sub>s</sub> = {G_S.toFixed(6)}, the electron's g-factor from CODATA, and g<sub>L</sub> = 1)
              </span>
            </>
          )}
        </dd>
        <dt>Measured (NIST)</dt>
        <dd>
          {measuredG !== undefined ? (
            <>
              g<sub>J</sub> = {measuredG} <SourceChip id="nist_levels" sources={sources} />
            </>
          ) : (
            <MissingValue m={NO_LANDE(levels === null, jZero ? 0 : 1)} />
          )}
        </dd>
      </dl>
    </>
  );
}

function NO_LANDE(noLevels: boolean, J: number): Missing {
  if (J === 0) return { missing: true, reason: "not_applicable", note: "J = 0: there is no Landé factor for this level." };
  return {
    missing: true,
    reason: "not_measured",
    note: noLevels ? "NIST lists no energy levels for this atom." : "NIST lists no Landé factor for the ground level.",
  };
}

function Aufbau({ e, sources }: { e: ElementIndexEntry; sources: Sources }) {
  const kind = anomalyFor(e);
  return (
    <>
      <dl className={shared.facts}>
        <dt>Madelung rule (n + l, then n)</dt>
        <dd className={styles.config}>{e.configuration.aufbau}</dd>
        <dt>Measured (NIST)</dt>
        <dd className={styles.config}>
          {e.configuration.measured} <SourceChip id={e.configuration.source} sources={sources} />
        </dd>
      </dl>
      {kind ? (
        <p>
          <span className={styles.disagree}>They differ.</span> {ANOMALY_TEXT[kind]}{" "}
          <span className={styles.label}>Explanation, not derivation</span>
        </p>
      ) : (
        <p>
          <span className={styles.agree}>✓ They agree:</span> {e.name} fills its subshells in the order the rule predicts. Twenty
          elements do not (chromium, copper, gadolinium, gold, lawrencium and others); for them this panel says why, in short.
        </p>
      )}
    </>
  );
}

function Screening({ e, d, unit, sources }: { e: ElementIndexEntry; d: ElementDetailFile; unit: EnergyUnit; sources: Sources }) {
  const s = slaterFor(e);
  const label = `${s.n}${L_LETTER[s.l]}`;
  const clementi = d.orbitals.zeff.find((z) => z.n === s.n && z.l === s.l);
  const nStar = slaterNStar(s.n);
  const ie = e.ie1;
  const ieEv = isMissing(ie) ? null : ie.unit === "eV" ? ie.value : kjPerMolToEv(ie.value);
  const show = (ev: number) => `${fmt(convertEnergy(ev, "eV", unit), 3)} ${unit}`;
  return (
    <>
      <p className={shared.muted}>
        Slater's rules (1930) estimate how much the other electrons shield the nucleus from one electron — here the
        outermost, {label}, the one the first ionization removes. Each other electron subtracts a fixed share of a charge.
      </p>
      <SideScroll className={styles.tableWrap} label={`Slater's rules for ${e.name}'s ${label} electron`}>
        <table className={styles.table} data-testid="slater-steps">
          <caption className={shared.muted}>
            Slater's rules for one {label} electron of {e.name} <SourceChip id="slater1930" sources={sources} />
          </caption>
          <thead>
            <tr>
              <th scope="col">Shielding electrons</th>
              <th scope="col">Number</th>
              <th scope="col">Each</th>
              <th scope="col">Shielding</th>
            </tr>
          </thead>
          <tbody>
            {s.steps.length === 0 ? (
              <tr>
                <th scope="row">none (one electron)</th>
                <td>0</td>
                <td>—</td>
                <td>0</td>
              </tr>
            ) : (
              s.steps.map((st) => (
                <tr key={st.label}>
                  <th scope="row">{st.label}</th>
                  <td>{st.count}</td>
                  <td>× {st.each.toFixed(2)}</td>
                  <td>= {fmt(st.total, 4)}</td>
                </tr>
              ))
            )}
            <tr className={styles.total}>
              <th scope="row">
                Z<sub>eff</sub> = Z − Σ
              </th>
              <td colSpan={3}>
                {e.Z} − {fmt(s.shielding, 4)} = <b>{fmt(s.zeff, 4)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </SideScroll>
      <p>
        For comparison, Clementi and Raimondi's self-consistent-field value for {label}:{" "}
        {clementi ? (
          <>
            Z<sub>eff</sub> = {clementi.value.toFixed(4)} <SourceChip id={clementi.source} sources={sources} />
          </>
        ) : (
          <MissingValue m={{ missing: true, reason: "not_measured", note: "Their table stops at radon and covers only the configurations they computed." }} />
        )}
        .
      </p>
      <h5 className={styles.subheading}>A hydrogen-like estimate of the first ionization energy</h5>
      <p>
        <Formula tex={String.raw`\mathrm{IE} \approx R_\infty hc\,\frac{Z_\mathrm{eff}^2}{n^2}, \quad R_\infty hc = \tfrac12 E_\mathrm{h}`} />
      </p>
      <dl className={shared.facts}>
        <dt>Slater's Z<sub>eff</sub>, n = {s.n}</dt>
        <dd>{show(hydrogenicEnergy(s.zeff, s.n))}</dd>
        {nStar !== null && nStar !== s.n && (
          <>
            <dt>Slater's Z<sub>eff</sub>, n* = {nStar}</dt>
            <dd>
              {show(hydrogenicEnergy(s.zeff, nStar))}{" "}
              <span className={shared.muted}>(Slater's own effective quantum number for n ≥ 4)</span>
            </dd>
          </>
        )}
        {clementi && (
          <>
            <dt>Clementi–Raimondi Z<sub>eff</sub>, n = {s.n}</dt>
            <dd>{show(hydrogenicEnergy(clementi.value, s.n))}</dd>
          </>
        )}
        <dt>Measured IE₁</dt>
        <dd>
          {ieEv === null ? <MissingValue m={ie as Missing} /> : <>{show(ieEv)} <SourceChip id={isMissing(ie) ? "" : ie.source} sources={sources} /></>}
        </dd>
      </dl>
      <p className={shared.muted}>
        The estimates treat the electron as alone with a reduced nuclear charge. They catch the scale, not the detail: the
        other electrons do not shield like a fixed charge.
      </p>
    </>
  );
}

function RelativityChart({ e }: { e: ElementIndexEntry }) {
  const zs = Array.from({ length: 118 }, (_, i) => i + 1);
  const mine = relativityFor(e.Z);
  const table = {
    columns: ["Z", "v/c = Zα", "γ", "1s radius ÷ non-relativistic"],
    rows: [1, 10, 20, 30, 40, 50, 55, 60, 70, 79, 80, 82, 87, 90, 100, 110, 118].map((z) => {
      const r = relativityFor(z);
      return { key: String(z), cells: [z, r.beta.toFixed(4), r.gamma.toFixed(4), r.contraction.toFixed(4)] };
    }),
  };
  const caption = (
    <>
      Plotted: the Lorentz factor γ = 1/√(1 − (Zα)²) of a 1s electron moving at v = Zα·c (the Bohr-model estimate) for
      Z = 1 … 118, with {e.name} marked. Computed from the fine-structure constant α (CODATA 2022).
    </>
  );
  return (
    <ChartFrame caption={caption} table={table} testId="relativity-chart">
      {({ width, captionId }) => {
        const H = 200;
        const M = { top: 12, right: 16, bottom: 34, left: 44 };
        const x = scaleLinear().domain([1, 118]).range([M.left, width - M.right]);
        const y = scaleLinear().domain([1, 2.1]).range([H - M.bottom, M.top]);
        const path = line<number>()
          .x((z) => x(z))
          .y((z) => y(relativityFor(z).gamma))(zs);
        return (
          <svg width={width} height={H} role="img" aria-labelledby={captionId}>
            <g className={viz.axis}>
              {[1, 1.25, 1.5, 1.75, 2].map((t) => (
                <g key={t} transform={`translate(0 ${y(t)})`}>
                  <line x1={M.left} x2={width - M.right} className={viz.grid} />
                  <text x={M.left - 6} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {[1, 20, 40, 60, 80, 100, 118].map((z) => (
                <text key={z} x={x(z)} y={H - M.bottom + 16} textAnchor="middle">
                  {z}
                </text>
              ))}
            </g>
            <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 4} textAnchor="middle">
              Atomic number Z
            </text>
            <text className={viz.axisTitle} transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
              γ of the 1s electron
            </text>
            {path && <path d={path} className={styles.curve} />}
            <circle cx={x(e.Z)} cy={y(mine.gamma)} r={5} className={styles.mine} />
            <text className={viz.label} x={x(e.Z)} y={y(mine.gamma) - 9} textAnchor="middle">
              {e.symbol}
            </text>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function Relativity({
  e,
  elements,
  rel,
  unit,
  sources,
}: {
  e: ElementIndexEntry;
  elements: ElementIndexEntry[];
  rel: RelativityFile;
  unit: EnergyUnit;
  sources: Sources;
}) {
  const r = relativityFor(e.Z);
  const finite = rel.limits.find((l) => l.name === "finite nucleus");
  const ieOf = (sym: string) => {
    const x = elements.find((el) => el.symbol === sym)?.ie1;
    if (!x || isMissing(x)) return null;
    return convertEnergy(x.unit === "eV" ? x.value : kjPerMolToEv(x.value), "eV", unit);
  };
  return (
    <>
      <Badge>
        A Bohr-model estimate: it treats the 1s electron as a single electron in the full nuclear charge. Real relativistic
        effects come from the Dirac equation; the trends are right, the numbers are approximate.
      </Badge>
      <dl className={shared.facts}>
        <dt>Speed of the 1s electron</dt>
        <dd>
          v/c ≈ Zα = {e.Z} × α = {r.beta.toFixed(4)}
        </dd>
        <dt>Lorentz factor</dt>
        <dd>
          <Formula tex={String.raw`\gamma = 1/\sqrt{1-(Z\alpha)^2}`} /> = {r.gamma.toFixed(4)}
        </dd>
        <dt>1s contraction</dt>
        <dd>
          the 1s radius shrinks to {(r.contraction * 100).toFixed(1)} % of its non-relativistic size (a₀ ∝ 1/m, and the
          electron's mass grows by γ)
        </dd>
      </dl>
      <RelativityChart e={e} />
      <h5 className={styles.subheading}>Where the table ends</h5>
      <p>
        For a point nucleus the 1s state of the Dirac equation exists only while Zα &lt; 1, that is up to Z = 1/α ={" "}
        {POINT_NUCLEUS_LIMIT.toFixed(3)} (CODATA). {finite ? finite.text : ""}{" "}
        {finite && <SourceChip id={finite.source} sources={sources} />}
      </p>
      <h5 className={styles.subheading}>Where relativity changes chemistry</h5>
      <ul className={styles.notes}>
        {rel.notes.map((n) => (
          <li key={n.Z} data-current={n.Z === e.Z || undefined}>
            <b>{n.topic}</b> ({elements.find((x) => x.Z === n.Z)?.name}). {n.text}{" "}
            {n.Z === 87 && ieOf("Cs") !== null && ieOf("Fr") !== null && (
              <span className={shared.muted}>
                IE₁ (NIST): caesium {fmt(ieOf("Cs") ?? 0, 5)} {unit}, francium {fmt(ieOf("Fr") ?? 0, 5)} {unit}.{" "}
              </span>
            )}
            <SourceChip id={n.source} sources={sources} />
            {n.reference && <span className={shared.muted}> — {n.reference}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

function Symmetry({ sources }: { sources: Sources }) {
  return (
    <div className={styles.prose}>
      <p>
        In hydrogen the energy depends on n alone, so each shell holds <Formula tex={String.raw`\sum_{l=0}^{n-1} 2(2l+1) = 2n^2`} />{" "}
        electrons' worth of states: 2, 8, 18, 32 — the lengths of the periods, each appearing twice. That degeneracy is
        larger than rotations alone explain. Fock showed in 1935 that hydrogen's bound states have a hidden
        four-dimensional rotation symmetry, <Formula tex={String.raw`\mathrm{SO}(4)`} />, which joins the different l of one
        shell into a single family <SourceChip id="fock1935" sources={sources} />. Enlarging it to the "dynamical group"{" "}
        <Formula tex={String.raw`\mathrm{SO}(4,2)`} /> puts every shell into one representation, with operators that step
        from one n to the next <SourceChip id="barut1967" sources={sources} />.
      </p>
      <p>
        In many-electron atoms that symmetry is broken — the electrons repel one another and screen the nucleus — and the
        Madelung order n + l takes over, filling 4s before 3d. Read this way, the periodic table is the pattern left behind
        by a broken symmetry of the hydrogen atom: an idea that explains the shape of the table, not a derivation of
        every configuration.
      </p>
    </div>
  );
}

export default function Panel({ element: e, elements, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  const rel = useRelativity();
  const unit = useSettings((s) => s.energyUnit);
  const levelsExist = detail.state === "ready" && detail.value.files.levels;
  const levels = useLevels(e.Z, levelsExist);
  const levelsFile = levels.state === "ready" ? levels.value : null;
  return (
    <WhenLoaded files={[detail, rel]}>
      {(d, r) => (
        <div className={styles.panel}>
          <Badge>
            Hund's rules, the Madelung rule and Slater's rules are rules of thumb, and the energies and speeds below are
            hydrogen-like or Bohr-model estimates. Each is shown next to the measured value it approximates.
          </Badge>
          <Section title="Quantum numbers of the valence electrons" id="quantum">
            <QuantumNumbers e={e} />
          </Section>
          <Section title="The ground term" id="term">
            <GroundTerm e={e} levels={levelsFile} sources={sources} />
          </Section>
          <Section title="Aufbau against reality" id="aufbau">
            <Aufbau e={e} sources={sources} />
          </Section>
          <Section title="Screening" id="screening">
            <Screening e={e} d={d} unit={unit} sources={sources} />
          </Section>
          <Section title="Relativity" id="relativity">
            <Relativity e={e} elements={elements} rel={r} unit={unit} sources={sources} />
          </Section>
          <Section title="Symmetry: why the periods are 2, 8, 18, 32" id="symmetry">
            <Symmetry sources={sources} />
          </Section>
          <SourcesFooter
            ids={collectSources(
              e.configuration,
              e.groundTerm,
              e.ie1,
              levelsFile?.levels.find((l) => l.eV === 0)?.gJ !== undefined ? { source: "nist_levels" } : {},
              d.orbitals.zeff,
              { source: "slater1930" },
              { source: "nist_codata" },
              r.notes,
              r.limits,
              { source: "fock1935" },
              { source: "barut1967" },
            )}
            sources={sources}
          />
        </div>
      )}
    </WhenLoaded>
  );
}
