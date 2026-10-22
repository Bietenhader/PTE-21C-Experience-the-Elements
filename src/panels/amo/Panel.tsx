// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// AMO & metrology (SPEC §10.6), "the Phillips panel": hyperfine structure with its F levels, nuclear
// moments, the element's clock transitions from the BIPM list, laser cooling with the Doppler and
// recoil limits computed from the stored line data, the element's place in the SI, and the shared
// timeline of the second.

import { Fragment, useId } from "react";
import { useColourTable, useElementDetail, useIsotopes, useMetrology, type Loaded } from "../../data/load";
import { concise, fraction, isMissing } from "../../data/format";
import type {
  Citation,
  ColourMatchingFile,
  ElementDetailFile,
  ElementIndexEntry,
  IsotopesFile,
  LaserCooling,
  MetrologyFile,
  Q,
  SourcesFile,
} from "../../data/types";
import { toHex, wavelengthColour } from "../../physics/color/cie";
import { Formula } from "../../ui/Formula";
import { MissingValue, Quantity } from "../../ui/Quantity";
import { SideScroll } from "../../ui/SideScroll";
import { SourceChip } from "../../ui/SourceChip";
import { isotopeLabel, jpText, sci } from "../nucleus/model";
import { Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./amo.module.css";
import {
  coolingKind,
  coolingLimits,
  coolingMass,
  type HyperfineView,
  hyperfineViews,
  levelText,
  momentRows,
  noHyperfine,
  relativeUncertainty,
  secondTimeline,
  speciesLabel,
  transitionText,
  unlistedSpins,
  withPrefix,
} from "./model";

type Sources = SourcesFile["sources"];

const doiLink = (doi?: string, arxiv?: string) =>
  doi ? <a href={`https://doi.org/${doi}`}>doi:{doi}</a> : arxiv ? <a href={`https://arxiv.org/abs/${arxiv}`}>arXiv:{arxiv}</a> : null;

// --- Hyperfine ----------------------------------------------------------------------------------------

/** The level of total electronic angular momentum J split into its F levels, to scale. */
function FDiagram({ v, term }: { v: HyperfineView; term: string }) {
  const H = 150;
  const W = 300;
  const energies = v.levels.map((l) => l.energy);
  const lo = Math.min(...energies);
  const hi = Math.max(...energies);
  const y = (e: number) => (hi === lo ? H / 2 : 18 + ((hi - e) / (hi - lo)) * (H - 36));
  const top = v.levels.reduce((a, b) => (b.energy > a.energy ? b : a));
  const bottom = v.levels.reduce((a, b) => (b.energy < a.energy ? b : a));
  const head = useId();
  const label = `F levels of ${v.label}: ${v.levels.map((l) => `F = ${fraction(l.F)}`).join(", ")}; F = ${fraction(top.F)} lies highest, ${withPrefix(
    (top.energy - bottom.energy) * 1e6,
    "Hz",
    4,
  )} above F = ${fraction(bottom.F)}.`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={styles.diagram}>
      <line x1={10} x2={90} y1={H / 2} y2={H / 2} className={styles.level} />
      <text x={50} y={H / 2 - 6} textAnchor="middle" className={styles.levelLabel}>
        {term}
      </text>
      {v.levels.map((l) => (
        <g key={l.F}>
          <line x1={90} x2={150} y1={H / 2} y2={y(l.energy)} className={styles.connector} />
          <line x1={150} x2={230} y1={y(l.energy)} y2={y(l.energy)} className={styles.level} />
          <text x={236} y={y(l.energy)} dy="0.32em" className={styles.levelLabel}>
            F = {fraction(l.F)}
          </text>
        </g>
      ))}
      {v.levels.length > 1 && (
        <g>
          <line x1={190} x2={190} y1={y(top.energy) + 3} y2={y(bottom.energy) - 3} className={styles.arrow} markerEnd={`url(#${head})`} markerStart={`url(#${head})`} />
          <text x={196} y={(y(top.energy) + y(bottom.energy)) / 2} dy="0.32em" className={styles.small}>
            {withPrefix((top.energy - bottom.energy) * 1e6, "Hz", 4)}
          </text>
        </g>
      )}
      <Arrowhead id={head} />
    </svg>
  );
}

function Arrowhead({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" className={styles.head} />
      </marker>
    </defs>
  );
}

function HyperfineCard({ v, e, sources }: { v: HyperfineView; e: ElementIndexEntry; sources: Sources }) {
  const term = v.row.charge === 0 && !isMissing(e.groundTerm) ? termText(e.groundTerm.term) : v.J !== null ? `J = ${fraction(v.J)}` : "";
  return (
    <article className={styles.card} data-testid="hyperfine-row">
      <h5 className={styles.cardTitle}>
        {v.label}
        {v.row.charge > 0 ? " (ion)" : ""}
        {v.headline && <span className={styles.chip}>shown on the tile</span>}
      </h5>
      <div className={styles.cardBody}>
        <dl className={shared.facts}>
          <dt>Ground-state splitting</dt>
          <dd>
            <Quantity q={v.row.splitting} sources={sources} />
            {v.row.splitting.note && <span className={shared.muted}> — {v.row.splitting.note}</span>}
          </dd>
          <dt>Nuclear spin I</dt>
          <dd>{v.I === null ? <i>not given</i> : fraction(v.I)}</dd>
          <dt>Electronic J</dt>
          <dd>
            {v.J === null ? <i>not given</i> : fraction(v.J)}
            {v.row.charge === 0 && v.row.J === undefined && v.J !== null ? <span className={shared.muted}> (ground term, NIST)</span> : null}
          </dd>
          <dt>Magnetic dipole constant A</dt>
          <dd>
            {v.row.A_MHz ? (
              <Quantity q={v.row.A_MHz} sources={sources} />
            ) : v.aMHz !== null ? (
              <>
                {sci(v.aMHz)} MHz <span className={shared.muted}>(computed: splitting ÷ (I + ½); its sign is not given)</span>
              </>
            ) : (
              <i>not given</i>
            )}
          </dd>
          {v.row.B_MHz && (
            <>
              <dt>Electric quadrupole constant B</dt>
              <dd>
                <Quantity q={v.row.B_MHz} sources={sources} />
              </dd>
            </>
          )}
        </dl>
        {v.levels.length > 1 && <FDiagram v={v} term={term} />}
      </div>
    </article>
  );
}

/** NIST's term designation with the spin multiplicity and J set as in print: 2S1/2 → ²S₁/₂. */
function termText(t: string): string {
  const m = /^(\d+)([A-Z])(\*?)(.*)$/.exec(t);
  if (!m) return t;
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "/": "/" };
  const mult = (m[1] ?? "").replace(/\d/g, (d) => SUP[Number(d)] ?? d);
  const j = (m[4] ?? "").replace(/[\d/]/g, (c) => SUB[c] ?? c);
  return `${mult}${m[2] ?? ""}${m[3] ? "°" : ""}${j}`;
}

function Hyperfine({ e, d, isotopes, sources }: { e: ElementIndexEntry; d: ElementDetailFile; isotopes: IsotopesFile | null; sources: Sources }) {
  const isos = isotopes?.isotopes ?? [];
  const views = hyperfineViews(e, d, isos);
  const unlisted = unlistedSpins(e, isos, d.amo.hyperfine);
  return (
    <Section title="Hyperfine structure" id="hyperfine">
      <p className={shared.muted}>
        The nucleus's spin I and the electrons' angular momentum J couple to a total F = |I − J| … I + J; each F is a
        slightly different energy. The levels below are the ground level split by its magnetic-dipole constant A and
        electric-quadrupole constant B; for J = ½ the splitting is A(I + ½).
      </p>
      <div className={styles.formulas}>
        <Formula
          display
          tex={String.raw`\begin{aligned} E_F &= \tfrac{A}{2}K \\ &\quad + B\,\frac{\tfrac32 K(K+1) - 2I(I+1)J(J+1)}{4I(2I-1)J(2J-1)} \end{aligned}`}
        />
        <Formula display tex={String.raw`K = F(F+1) - I(I+1) - J(J+1)`} />
      </div>
      {views.length === 0 ? (
        <p data-testid="no-hyperfine">
          Ground-state hyperfine splitting: <MissingValue m={noHyperfine(e)} />
        </p>
      ) : (
        views.map((v) => <HyperfineCard key={`${v.row.A}-${v.row.charge}`} v={v} e={e} sources={sources} />)
      )}
      {unlisted.length > 0 && (
        <p className={shared.muted}>
          Other natural isotopes with a nuclear spin, whose splitting is not yet in our curated table:{" "}
          {unlisted.map((i) => `${isotopeLabel(i.A, e.symbol)} (I = ${fraction(i.I as number)})`).join(", ")}.
        </p>
      )}
    </Section>
  );
}

// --- Nuclear moments ------------------------------------------------------------------------------

/** A table cell's number with its uncertainty and source, when the column heading already names the unit. */
function Bare({ q, sources }: { q: Q; sources: Sources }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  return (
    <>
      <span className={styles.num}>{concise(q.value, q.unc)}</span>
      {q.flag && q.flag !== "measured" && <span className={shared.muted}> ({q.flag})</span>} <SourceChip id={q.source} sources={sources} />
    </>
  );
}

function Moments({ e, isotopes, sources }: { e: ElementIndexEntry; isotopes: IsotopesFile | null; sources: Sources }) {
  const rows = isotopes ? momentRows(isotopes.isotopes) : [];
  if (rows.length === 0) {
    return (
      <Section title="Nuclear moments" id="moments">
        <p>
          <MissingValue
            m={{ missing: true, reason: "not_measured", note: "The IAEA LiveChart lists no measured nuclear moment for an isotope of this element." }}
          />
        </p>
      </Section>
    );
  }
  const natural = rows.filter((i) => !isMissing(i.abundance));
  const others = rows.filter((i) => isMissing(i.abundance));
  const table = (list: typeof rows, caption: string) => (
    <SideScroll className={styles.tableWrap} label={caption}>
      <table className={styles.table}>
        <caption className={shared.muted}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Isotope</th>
            <th scope="col">
              Spin, parity I<sup>π</sup>
            </th>
            <th scope="col">
              Magnetic moment μ (μ<sub>N</sub>)
            </th>
            <th scope="col">Quadrupole moment Q (b)</th>
          </tr>
        </thead>
        <tbody>
          {list.map((i) => (
            <tr key={i.A}>
              <th scope="row">{isotopeLabel(i.A, e.symbol)}</th>
              <td>{jpText(i.jp) || <i>not known</i>}</td>
              <td>
                <Bare q={i.mu} sources={sources} />
              </td>
              <td>
                <Bare q={i.Q} sources={sources} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SideScroll>
  );
  return (
    <Section title="Nuclear moments" id="moments">
      <p className={shared.muted}>
        The magnetic dipole moment μ (in nuclear magnetons) sets the size of A; the electric quadrupole moment Q (in
        barns) sets B, and is zero for spin 0 and ½. From the IAEA LiveChart of Nuclides (ground states).
      </p>
      {natural.length > 0 && table(natural, `Natural isotopes of ${e.name} with a measured moment`)}
      {others.length > 0 && (
        <details className={styles.more}>
          <summary>
            {natural.length > 0 ? "Radioactive isotopes" : "Isotopes"} with a measured moment ({others.length})
          </summary>
          {table(others, `Radioactive isotopes of ${e.name} with a measured moment`)}
        </details>
      )}
    </Section>
  );
}

// --- Clocks ---------------------------------------------------------------------------------------

function Clocks({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const clocks = d.amo.clocks;
  return (
    <Section title="Clock transitions" id="clocks">
      {clocks.length === 0 ? (
        <p data-testid="no-clock">
          None: no transition of {e.name.toLowerCase()} is in the BIPM list of recommended standard frequencies, and it
          has no nuclear clock.
        </p>
      ) : (
        <>
          <p className={shared.muted}>
            {clocks.some((c) => !c.definesSecond && c.kind !== "nuclear") &&
              "Recommended frequencies from the BIPM list of standard frequencies, with their relative standard uncertainty. "}
            {clocks.some((c) => c.definesSecond) && "Caesium's frequency is exact: since 1967 it defines the second. "}
            {clocks.some((c) => c.kind === "nuclear") &&
              "The nuclear transition's frequency comes from the measurement linked in its row, not from the BIPM list. "}
          </p>
          <SideScroll className={styles.tableWrap} label={`Clock transitions of ${e.name}`}>
            <table className={styles.table} data-testid="clock-table">
              <caption className={shared.muted}>Clock transitions of {e.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Species</th>
                  <th scope="col">Transition</th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Relative uncertainty</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {clocks.map((c) => {
                  const rel = relativeUncertainty(c.frequency);
                  return (
                    <tr key={`${c.species}-${c.transition}`}>
                      <th scope="row">{speciesLabel(e.symbol, c.A, c.charge)}</th>
                      <td>{transitionText(c.transition)}</td>
                      <td>
                        <Quantity q={c.frequency} sources={sources} />
                        {c.frequency.doi && <> {doiLink(c.frequency.doi, c.frequency.arxiv)}</>}
                      </td>
                      <td>{rel === null ? <i>not given</i> : rel === 0 ? "exact" : sci(rel, undefined, 2)}</td>
                      <td>
                        {[
                          c.definesSecond && "defines the SI second (1967–)",
                          c.srs && "secondary representation of the second",
                          c.metre && "realizes the metre",
                          c.kind === "nuclear" && "nuclear transition",
                        ]
                          .filter((role): role is string => Boolean(role))
                          .map((role) => (
                            <Fragment key={role}>
                              <span className={styles.chip}>{role}</span>{" "}
                            </Fragment>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SideScroll>
        </>
      )}
    </Section>
  );
}

// --- Laser cooling --------------------------------------------------------------------------------

/** The diagram labels a level by its term alone ("²S₁/₂"); the card prints the whole label. */
const termOf = (level: string) => levelText(level).split(" ").at(-1) ?? level;

const KIND_TEXT = { neutral: "neutral atom, ground state", metastable: "neutral atom, metastable state", ion: "ion" } as const;

/** The two levels of the cycling transition: the laser drives it up, spontaneous emission brings it back. */
function CyclingDiagram({ row, label, cie }: { row: LaserCooling; label: string; cie: ColourMatchingFile }) {
  const nm = row.wavelength.value;
  const rgb = nm >= 380 && nm <= 780 ? wavelengthColour(nm, cie) : null;
  const band = nm < 380 ? "ultraviolet" : nm > 780 ? "infrared" : "visible";
  const gammaText = isMissing(row.gamma) ? "linewidth not given" : `Γ/2π = ${sci(row.gamma.value)} MHz`;
  const H = 150;
  const W = 300;
  const head = useId();
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cycling transition of ${label}: the laser at ${sci(nm)} nm (${band}) drives ${levelText(row.lower)} up to ${levelText(row.upper)}; it decays back by spontaneous emission (${gammaText}).`}
      className={styles.diagram}
    >
      <line x1={20} x2={220} y1={H - 22} y2={H - 22} className={styles.level} />
      <line x1={20} x2={220} y1={26} y2={26} className={styles.level} />
      <text x={226} y={H - 22} dy="0.32em" className={styles.small}>
        {termOf(row.lower)}
      </text>
      <text x={226} y={26} dy="0.32em" className={styles.small}>
        {termOf(row.upper)}
      </text>
      <line
        x1={80}
        x2={80}
        y1={H - 24}
        y2={30}
        className={styles.laser}
        style={rgb ? { stroke: toHex(rgb) } : undefined}
        strokeDasharray={rgb ? undefined : "5 3"}
        markerEnd={`url(#${head})`}
      />
      <text x={74} y={H / 2} textAnchor="end" dy="0.32em" className={styles.small}>
        {sci(nm)} nm
      </text>
      <path d={`M 150 30 ${Array.from({ length: 8 }, (_, i) => `q ${i % 2 ? -8 : 8} 6 0 ${(H - 56) / 8}`).join(" ")}`} className={styles.decay} markerEnd={`url(#${head})`} />
      <text x={162} y={H / 2} dy="0.32em" className={styles.small}>
        {isMissing(row.gamma) ? "decay" : `${sci(row.gamma.value)} MHz`}
      </text>
      <Arrowhead id={head} />
    </svg>
  );
}

function Milestone({ what, c, sources }: { what: string; c: Citation | undefined; sources: Sources }) {
  if (!c) return null;
  return (
    <>
      <dt>{what}</dt>
      <dd>
        {c.year} {doiLink(c.doi)} <SourceChip id={c.source} sources={sources} />
      </dd>
    </>
  );
}

function CoolingCard({ row, e, isotopes, cie, sources }: { row: LaserCooling; e: ElementIndexEntry; isotopes: IsotopesFile | null; cie: ColourMatchingFile; sources: Sources }) {
  const label = speciesLabel(e.symbol, row.A, row.charge);
  const mass = coolingMass(row, e, isotopes?.isotopes ?? []);
  const lim = coolingLimits(row, mass);
  const kind = coolingKind(row);
  const computed = (v: number | null, unit: string, what: string) =>
    v === null ? (
      <MissingValue m={{ missing: true, reason: "not_measured", note: `NIST gives no linewidth for this line, so the ${what} cannot be computed.` }} />
    ) : (
      <>
        {withPrefix(v, unit)} <span className={shared.muted}>(computed)</span>
      </>
    );
  return (
    <article className={styles.card} data-testid="cooling-row">
      <h5 className={styles.cardTitle}>
        {label} <span className={styles.chip}>{KIND_TEXT[kind]}</span>
      </h5>
      <div className={styles.cardBody}>
        <dl className={shared.facts}>
          <dt>Transition</dt>
          <dd>
            {levelText(row.lower)} → {levelText(row.upper)}
          </dd>
          <dt>Wavelength (vacuum)</dt>
          <dd>
            <Quantity q={row.wavelength} sources={sources} />
          </dd>
          <dt>Linewidth Γ/2π</dt>
          <dd>
            <Quantity q={row.gamma} sources={sources} />
          </dd>
          {row.repump && (
            <>
              <dt>Repump</dt>
              <dd>
                <Quantity q={row.repump} sources={sources} />
              </dd>
            </>
          )}
          <dt>
            Doppler limit T<sub>D</sub>
          </dt>
          <dd>{computed(lim.doppler, "K", "Doppler limit")}</dd>
          <dt>
            Recoil temperature T<sub>r</sub>
          </dt>
          <dd>
            {lim.recoil === null ? <MissingValue m={{ missing: true, reason: "not_measured", note: "No mass is stored for this isotope." }} /> : computed(lim.recoil, "K", "")}
          </dd>
          <dt>
            Recoil velocity v<sub>r</sub>
          </dt>
          <dd>{lim.recoilVelocity === null ? <i>no mass</i> : computed(lim.recoilVelocity, "m/s", "")}</dd>
          <dt>
            Saturation intensity I<sub>sat</sub>
          </dt>
          <dd>{lim.saturation === null ? computed(null, "", "saturation intensity") : <>{withPrefix(lim.saturation / 1e4, "W/cm²")} <span className={shared.muted}>(computed, cycling transition)</span></>}</dd>
          <Milestone what="First laser-cooled" c={row.firstCooled} sources={sources} />
          <Milestone what="First magneto-optical trap" c={row.firstMOT} sources={sources} />
          <Milestone what="Bose–Einstein condensate" c={row.BEC} sources={sources} />
          <Milestone what="Degenerate Fermi gas" c={row.DFG} sources={sources} />
        </dl>
        <CyclingDiagram row={row} label={label} cie={cie} />
      </div>
      <p className={shared.muted}>
        {mass?.basis === "atomic weight" ? "The recoil limits use the standard atomic weight (the natural mixture). " : ""}
        {row.note} <SourceChip id={row.source} sources={sources} />
      </p>
    </article>
  );
}

function Cooling({ e, d, isotopes, cie, sources }: { e: ElementIndexEntry; d: ElementDetailFile; isotopes: IsotopesFile | null; cie: ColourMatchingFile; sources: Sources }) {
  const rows = d.amo.laserCooling;
  return (
    <Section title="Laser cooling" id="cooling">
      {rows.length === 0 ? (
        <p data-testid="no-cooling">
          Not laser-cooled: {e.name} is not in the catalogue of laser-cooled atoms and ions{" "}
          <SourceChip id="olmschenk_catalog" sources={sources} />.
        </p>
      ) : (
        <>
          <p className={shared.muted}>
            Limits computed here from the line's wavelength λ (with k = 2π/λ), its linewidth Γ and the atom's mass m: the
            Doppler limit, the recoil temperature and velocity, and the saturation intensity of a closed two-level (cycling)
            transition. Constants from CODATA 2022.
          </p>
          <div className={styles.formulas}>
            <Formula display tex={String.raw`T_\mathrm{D} = \frac{\hbar\Gamma}{2k_\mathrm{B}}`} />
            <Formula display tex={String.raw`T_\mathrm{r} = \frac{\hbar^2k^2}{m k_\mathrm{B}}`} />
            <Formula display tex={String.raw`v_\mathrm{r} = \frac{\hbar k}{m}`} />
            <Formula display tex={String.raw`I_\mathrm{sat} = \frac{\pi h c\,\Gamma}{3\lambda^3}`} />
          </div>
          {rows.map((r) => (
            <CoolingCard key={`${r.A}-${r.charge}-${r.lower}-${r.upper}`} row={r} e={e} isotopes={isotopes} cie={cie} sources={sources} />
          ))}
        </>
      )}
    </Section>
  );
}

// --- SI and the second ------------------------------------------------------------------------------

function InTheSI({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const rows = [...d.amo.siHistory].sort((a, b) => (a.from ?? Number(a.validFrom?.slice(0, 4) ?? 9999)) - (b.from ?? Number(b.validFrom?.slice(0, 4) ?? 9999)));
  return (
    <Section title="In the SI" id="si">
      {rows.length === 0 ? (
        <p>{e.name} has no role in defining or realizing the SI units.</p>
      ) : (
        <ol className={styles.timeline} data-testid="si-history">
          {rows.map((r) => (
            <li key={`${r.unit}-${r.role}-${r.text}`}>
              {/* Rows from the BIPM list carry the date of the value now in force, not of the first listing. */}
              <strong>{r.from !== undefined ? `${r.from}–${r.to ?? ""}` : "BIPM list"}</strong> <span className={styles.chip}>{r.unit}</span>{" "}
              {r.text}
              {r.from === undefined && r.validFrom ? ` (value in force since ${r.validFrom})` : ""} {doiLink(r.doi)}{" "}
              <SourceChip id={r.source} sources={sources} />
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function SecondTimeline({ e, d, metrology, sources }: { e: ElementIndexEntry; d: ElementDetailFile; metrology: MetrologyFile; sources: Sources }) {
  const items = secondTimeline(metrology, e, d);
  const mine = items.filter((t) => t.mine).length;
  const id = useId();
  return (
    <Section title="The timeline of the second" id="second">
      <p className={shared.muted} id={id}>
        From caesium's definition (1967) to the redefinition planned for 2030, for every element.
        {mine > 0 ? ` The ${mine === 1 ? "entry marked ◆ concerns" : `${mine} entries marked ◆ concern`} ${e.name.toLowerCase()}.` : ""}
      </p>
      <ol className={styles.timeline} aria-describedby={id} data-testid="second-timeline">
        {items.map((t) => (
          <li key={`${t.year}-${t.text}`} data-mine={t.mine || undefined}>
            <strong>
              {t.mine ? "◆ " : ""}
              {t.year}
            </strong>{" "}
            {t.text} {doiLink(t.doi, t.arxiv)} <SourceChip id={t.source} sources={sources} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

// --- The panel ------------------------------------------------------------------------------------

const NONE: Loaded<IsotopesFile | null> = { state: "ready", value: null };

function WithData({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const iso = useIsotopes(e.Z, d.files.isotopes);
  const metrology = useMetrology();
  const cie = useColourTable();
  return (
    <WhenLoaded files={[d.files.isotopes ? iso : NONE, metrology, cie]}>
      {(isotopes, m, c) => (
        <div className={styles.panel}>
          <Hyperfine e={e} d={d} isotopes={isotopes} sources={sources} />
          <Moments e={e} isotopes={isotopes} sources={sources} />
          <Clocks e={e} d={d} sources={sources} />
          <Cooling e={e} d={d} isotopes={isotopes} cie={c} sources={sources} />
          <InTheSI e={e} d={d} sources={sources} />
          <SecondTimeline e={e} d={d} metrology={m} sources={sources} />
          <SourcesFooter
            ids={collectSources(
              d.amo,
              isotopes ? momentRows(isotopes.isotopes) : [],
              d.amo.laserCooling.length ? [{ source: "nist_codata" }] : [],
              m.timeline,
              isMissing(e.groundTerm) ? [] : [e.groundTerm],
            )}
            sources={sources}
          />
        </div>
      )}
    </WhenLoaded>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <WithData e={e} d={d} sources={sources} />}</WhenLoaded>;
}
