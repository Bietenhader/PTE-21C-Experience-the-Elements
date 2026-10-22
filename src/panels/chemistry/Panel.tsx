// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Chemistry & bonding (SPEC §10.9): the oxidation states (common ones bold, as on the tile) with an
// example compound for each; a size ladder of the atom's radii and its common ions' radii; the
// electronegativity recap; how the element itself bonds; well-known compounds; reactions with air,
// water and acids in our own words; and the coordination numbers Shannon lists for its ions.

import { scaleLinear } from "d3-scale";
import { useElementDetail } from "../../data/load";
import { isMissing, signed } from "../../data/format";
import type {
  Chemistry,
  ChemistryCompound,
  ChemistryIonicRadius,
  ChemistryOxidationExample,
  ElementDetailFile,
  ElementIndexEntry,
  Missing,
  Q,
  SourcedText,
  SourcesFile,
} from "../../data/types";
import { MissingValue, Quantity } from "../../ui/Quantity";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./chemistry.module.css";
import { BONDING_TEXT, coordinationByIon, coordinationText, formulaText, ionLabel, ladderRadii, SPIN_TEXT } from "./model";

type Sources = SourcesFile["sources"];

const NOT_BUILT: Missing = {
  missing: true,
  reason: "source_unavailable_at_build",
  note: "This element's data file has no chemistry section; the pipeline has not built it yet.",
};

function Doi({ doi }: { doi?: string | undefined }) {
  if (!doi) return null;
  return (
    <>
      {" "}
      <a href={`https://doi.org/${doi}`} rel="noreferrer" target="_blank">
        doi:{doi}
      </a>
    </>
  );
}

function CompoundName({ c, sources }: { c: ChemistryCompound | ChemistryOxidationExample; sources: Sources }) {
  return (
    <>
      <span className={styles.formula}>{formulaText(c.formula)}</span>, {c.name}
      {"note" in c && c.note ? <span className={shared.muted}> — {c.note}</span> : null} <SourceChip id={c.source} sources={sources} />
      <Doi doi={c.doi} />
    </>
  );
}

function OxidationStates({ e, chem, sources }: { e: ElementIndexEntry; chem: Chemistry; sources: Sources }) {
  const ox = e.oxidationStates;
  const all = [...ox.common, ...ox.other].sort((a, b) => b - a);
  const listed = [...new Set([...ox.common, ...chem.oxidationExamples.map((x) => x.state)])].sort((a, b) => b - a);
  return (
    <>
      {all.length > 0 ? (
        <p className={styles.states} data-testid="oxidation-states">
          {all.map((s, i) => (
            <span key={s}>
              {i > 0 && ", "}
              {ox.common.includes(s) ? <strong>{signed(s)}</strong> : signed(s)}
            </span>
          ))}{" "}
          <span className={shared.muted}>
            ({ox.common.length > 0 ? "common ones in bold" : "none listed as common"}
            {ox.flag === "predicted" ? "; predicted" : ""})
          </span>{" "}
          <SourceChip id={ox.source} sources={sources} />
        </p>
      ) : (
        <p className={shared.muted}>No oxidation states are listed for this element.</p>
      )}
      {listed.length > 0 && (
        <ul className={styles.list} data-testid="oxidation-examples">
          {listed.map((s) => {
            const examples = chem.oxidationExamples.filter((x) => x.state === s);
            return (
              <li key={s} data-state={s}>
                <strong className={styles.state}>{signed(s)}</strong>{" "}
                {examples.length > 0 ? (
                  examples.map((x, i) => (
                    <span key={x.formula}>
                      {i > 0 && "; "}
                      <CompoundName c={x} sources={sources} />
                    </span>
                  ))
                ) : s === 0 ? (
                  <span>the element itself</span>
                ) : (
                  <span className={shared.muted}>no example compound in PTE-21C's table</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {chem.oxidationNote && <p className={shared.muted}>{chem.oxidationNote}</p>}
    </>
  );
}

interface Rung {
  key: string;
  label: string;
  kind: "ionic" | "covalent" | "vdw";
  value: number;
  source: string;
}

const KIND_CLASS: Record<Rung["kind"], string | undefined> = { ionic: styles.ionic, covalent: styles.covalent, vdw: styles.vdw };

function ionicLabel(symbol: string, r: ChemistryIonicRadius): string {
  return `${ionLabel(symbol, r.charge)} ionic, ${coordinationText(r.coordination)}-coordinate${r.spin ? `, ${SPIN_TEXT[r.spin]}` : ""}`;
}

function SizeLadder({ e, d, chem, sources }: { e: ElementIndexEntry; d: ElementDetailFile; chem: Chemistry; sources: Sources }) {
  const { covalent, vdw } = d.orbitals.radii;
  const rungs: Rung[] = ladderRadii(chem.ionicRadii).map((r) => ({
    key: `${r.charge}${r.spin ?? ""}${r.coordination}`,
    label: ionicLabel(e.symbol, r),
    kind: "ionic",
    value: r.radius.value,
    source: r.radius.source,
  }));
  if (!isMissing(covalent)) rungs.push({ key: "covalent", label: `${e.symbol} covalent (single bond)`, kind: "covalent", value: covalent.value, source: covalent.source });
  if (!isMissing(vdw)) rungs.push({ key: "vdw", label: `${e.symbol} van der Waals`, kind: "vdw", value: vdw.value, source: vdw.source });
  rungs.sort((a, b) => a.value - b.value);
  const absent: Array<[string, Q]> = [
    ["Covalent radius", covalent],
    ["Van der Waals radius", vdw],
  ];
  const missingRows = absent.filter(([, q]) => isMissing(q)) as Array<[string, Missing]>;
  const title = (id: string) => sources[id]?.title ?? id;
  const name = e.name.toLowerCase();
  const caption = (
    <>
      Plotted: how big {name} is by three different measures, smallest first, in picometres. Ionic radii are Shannon's
      effective radii of the ions in {name}'s common oxidation states, six-coordinate where Shannon lists them (Shannon
      1976); they are a convention that sets the oxide ion at 140 pm and splits each measured bond length between the two
      ions. The covalent radius is half a single bond between two atoms (Cordero et al. 2008, via PubChem); the van der Waals
      radius is how close two atoms that are not bonded come (via PubChem). The metallic radius is not shown: PTE-21C has no
      documented source for it yet.
    </>
  );
  const table = {
    columns: ["Radius", "Value (pm)", "Source"],
    rows: rungs.map((r) => ({ key: r.key, cells: [r.label, r.value, title(r.source)] })),
  };
  return (
    <>
      {rungs.length > 0 && (
        <Badge>
          An atom has no sharp edge: each radius below is a convention tied to one kind of measurement, so only radii of the
          same kind can be compared across elements.
        </Badge>
      )}
      {rungs.length > 0 && (
        <ChartFrame title="Size ladder" caption={caption} table={table} testId="size-ladder">
          {({ width, captionId }) => {
            const rowH = 34;
            const M = { top: 4, right: 64, bottom: 22, left: 4 };
            const H = M.top + rungs.length * rowH + M.bottom;
            const max = Math.max(...rungs.map((r) => r.value));
            const x = scaleLinear()
              .domain([0, max * 1.05])
              .range([M.left, width - M.right]);
            return (
              <svg width={width} height={H} role="img" aria-labelledby={captionId}>
                <g className={viz.axis}>
                  {x.ticks(width < 420 ? 3 : 5).map((t) => (
                    <g key={t} transform={`translate(${x(t)} 0)`}>
                      <line y1={M.top} y2={H - M.bottom} className={viz.grid} />
                      <text y={H - 6} textAnchor="middle">
                        {t}
                      </text>
                    </g>
                  ))}
                </g>
                {rungs.map((r, i) => {
                  const y = M.top + i * rowH;
                  return (
                    <g key={r.key} data-kind={r.kind}>
                      <text className={styles.rungLabel} x={M.left} y={y + 12}>
                        {r.label}
                      </text>
                      <rect x={M.left} y={y + 17} width={Math.max(1, x(r.value) - M.left)} height={11} className={KIND_CLASS[r.kind]} />
                      <text className={viz.label} x={x(r.value) + 5} y={y + 26}>
                        {r.value} pm
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          }}
        </ChartFrame>
      )}
      {(missingRows.length > 0 || chem.ionicRadii.length === 0) && (
        <dl className={shared.facts}>
          {missingRows.map(([label, m]) => (
            <div key={label} className={styles.row}>
              <dt>{label}</dt>
              <dd>
                <MissingValue m={m} />
              </dd>
            </div>
          ))}
          {chem.ionicRadii.length === 0 && (
            <div className={styles.row}>
              <dt>Ionic radii</dt>
              <dd>
                <MissingValue
                  m={{
                    missing: true,
                    reason: "not_measured",
                    note: "Shannon's table (1976) lists no ion of this element in its common oxidation states.",
                  }}
                />
              </dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

function Coordination({ e, chem, sources }: { e: ElementIndexEntry; chem: Chemistry; sources: Sources }) {
  const ions = coordinationByIon(chem.ionicRadii);
  if (ions.length === 0) {
    return (
      <p>
        <MissingValue
          m={{ missing: true, reason: "not_measured", note: "Shannon's table lists no ion of this element in its common oxidation states." }}
        />
      </p>
    );
  }
  return (
    <>
      <p className={shared.muted}>
        How many neighbours each common ion of {e.name.toLowerCase()} has in the crystals Shannon compiled; kept here are 4, 6 and 8 and the
        rows Shannon marks as most reliable, so this shows typical surroundings, not every one possible.{" "}
        <SourceChip id="shannon1976" sources={sources} />
      </p>
      <dl className={shared.facts} data-testid="coordination">
        {ions.map((g) => (
          <div key={g.key} className={styles.row}>
            <dt>
              {ionLabel(e.symbol, g.charge)}
              {g.spin ? `, ${SPIN_TEXT[g.spin]}` : ""}
            </dt>
            <dd>
              {orList(g.rows.map((r) => coordinationText(r.coordination)))} neighbours
              {g.rows.some((r) => r.mostReliable) && (
                <span className={shared.muted}>
                  {" "}
                  (Shannon's most reliable radius: with{" "}
                  {orList(
                    g.rows.filter((r) => r.mostReliable).map((r) => coordinationText(r.coordination)),
                    "and",
                  )}
                  )
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** ["4", "6", "8"] → "4, 6 or 8". */
function orList(items: string[], word = "or"): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1] ?? ""}`;
}

function Text({ t, sources }: { t: SourcedText | Missing; sources: Sources }) {
  if (isMissing(t)) return <MissingValue m={t} />;
  return (
    <span>
      {t.text} <SourceChip id={t.source} sources={sources} />
      <Doi doi={t.doi} />
    </span>
  );
}

function Reactivity({ chem, sources }: { chem: Chemistry; sources: Sources }) {
  const { air, water, acids } = chem.reactivity;
  const same =
    isMissing(air) && isMissing(water) && isMissing(acids) && air.note === water.note && water.note === acids.note && air.reason === acids.reason;
  const cited = new Set([air, water, acids].flatMap((t) => (isMissing(t) ? [] : [t.source])));
  const fromPubchem = cited.has("hsdb") || cited.has("cameo_chemicals");
  return (
    <>
      {cited.size > 0 && (
        <p className={shared.muted}>
          Qualitative notes in our own words, each with its source
          {fromPubchem && chem.pubchemCid ? ` (the HSDB and CAMEO records are those of PubChem compound ${chem.pubchemCid})` : ""}.
          They describe chemistry, not how to handle the element safely.
        </p>
      )}
      <dl className={shared.facts} data-testid="reactivity">
        {same ? (
          <div className={styles.row}>
            <dt>With air, water and acids</dt>
            <dd>
              <MissingValue m={air} />
            </dd>
          </div>
        ) : (
          (
            [
              ["With air", air],
              ["With water", water],
              ["With acids", acids],
            ] as const
          ).map(([label, t]) => (
            <div key={label} className={styles.row}>
              <dt>{label}</dt>
              <dd>
                <Text t={t} sources={sources} />
              </dd>
            </div>
          ))
        )}
      </dl>
    </>
  );
}

function Body({ e, d, chem, sources }: { e: ElementIndexEntry; d: ElementDetailFile; chem: Chemistry; sources: Sources }) {
  const bonding = chem.bonding;
  const compounds = chem.compounds;
  return (
    <>
      <Section title="Oxidation states" id="oxidation">
        <OxidationStates e={e} chem={chem} sources={sources} />
      </Section>
      <Section title="How big is it?" id="radii">
        <SizeLadder e={e} d={d} chem={chem} sources={sources} />
      </Section>
      <Section title="Electronegativity" id="en">
        <dl className={shared.facts}>
          <dt>Pauling scale</dt>
          <dd>
            <Quantity q={d.em.en.pauling} sources={sources} />
          </dd>
          <dt>Allen (configuration energy)</dt>
          <dd>
            <Quantity q={d.em.en.allen} sources={sources} />
          </dd>
        </dl>
        <p className={shared.muted}>
          The higher the electronegativity, the harder an atom pulls shared electrons towards itself; a large difference between
          two elements makes their bond ionic, a small one covalent.
        </p>
      </Section>
      <Section title="Typical bonding" id="bonding">
        {isMissing(bonding) ? (
          <p>
            In the element itself: <MissingValue m={bonding} />
          </p>
        ) : (
          <p data-bonding={bonding.type}>
            In the element itself — {BONDING_TEXT[bonding.type]}
            {bonding.note ? ` ${bonding.note}` : ""} <SourceChip id={bonding.source} sources={sources} />
          </p>
        )}
      </Section>
      <Section title="Well-known compounds" id="compounds">
        {isMissing(compounds) ? (
          <p>
            <MissingValue m={compounds} />
          </p>
        ) : (
          <ul className={styles.list} data-testid="compounds">
            {compounds.map((c) => (
              <li key={c.formula}>
                <CompoundName c={c} sources={sources} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Reactions with air, water and acids" id="reactivity">
        <Reactivity chem={chem} sources={sources} />
      </Section>
      <Section title="Valence and coordination" id="coordination">
        <Coordination e={e} chem={chem} sources={sources} />
      </Section>
    </>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return (
    <WhenLoaded files={[detail]}>
      {(d) => {
        const chem = d.chemistry;
        return (
          <div className={styles.panel}>
            {chem ? (
              <Body e={e} d={d} chem={chem} sources={sources} />
            ) : (
              <p>
                <MissingValue m={NOT_BUILT} />
              </p>
            )}
            <SourcesFooter ids={collectSources(chem, e.oxidationStates, d.orbitals.radii, d.em.en)} sources={sources} />
          </div>
        );
      }}
    </WhenLoaded>
  );
}
