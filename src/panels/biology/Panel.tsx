// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Biology & ecology (SPEC §10.10): whether plants and people need the element and what for, how much
// a body holds, what it does in soils and food webs, how it can harm, and its isotopes in biology and
// medicine. Every sentence is our own wording from tools/curated/biology.toml, which Fin, a plant
// scientist, reviews; the carcinogen groups are IARC's, read from the IARC list by the pipeline.

import { useElementDetail } from "../../data/load";
import { isMissing } from "../../data/format";
import type { Biology, ElementDetailFile, ElementIndexEntry, Missing, SourcedText, SourcesFile } from "../../data/types";
import { MissingValue, Quantity } from "../../ui/Quantity";
import { SourceChip } from "../../ui/SourceChip";
import { Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./biology.module.css";

type Sources = SourcesFile["sources"];
type IsotopeUse = NonNullable<Biology["isotopeUses"]>[number];
type Iarc = NonNullable<Biology["iarc"]>[number];

const PLANT_STATUS: Record<Biology["essentialPlant"], string> = {
  yes: "Essential",
  beneficial: "Beneficial",
  no: "Not essential",
};
const HUMAN_STATUS: Record<Biology["essentialHuman"], string> = {
  yes: "Essential",
  probable: "Possibly essential",
  no: "Not essential",
};
const PLANT_CLASS: Record<NonNullable<Biology["plantClass"]>, string> = {
  structural: "Taken up as carbon dioxide and water, not as a mineral nutrient.",
  macronutrient: "A macronutrient: plants need it in large amounts, so it is a main ingredient of fertilisers.",
  micronutrient: "A micronutrient: plants need only traces, but without them they fail.",
  beneficial: "Beneficial: it helps some or many plants, but not every plant needs it.",
};
const FIELD: Record<IsotopeUse["field"], string> = {
  medicine: "Medicine",
  tracer: "Tracer in research",
  dating: "Dating",
  environment: "Environment and climate",
};
const FIELD_ORDER: IsotopeUse["field"][] = ["medicine", "tracer", "dating", "environment"];
// IARC's own names for its groups.
const IARC_GROUP: Record<string, string> = {
  "1": "Group 1: carcinogenic to humans",
  "2A": "Group 2A: probably carcinogenic to humans",
  "2B": "Group 2B: possibly carcinogenic to humans",
  "3": "Group 3: not classifiable as to its carcinogenicity to humans",
};

function Doi({ doi }: { doi?: string | undefined }) {
  if (!doi) return null;
  return (
    <>
      {" "}
      <a href={`https://doi.org/${doi}`} className={styles.doi}>
        doi:{doi}
      </a>
    </>
  );
}

function Said({ t, sources }: { t: SourcedText; sources: Sources }) {
  return (
    <>
      {t.text} <SourceChip id={t.source} sources={sources} />
      <Doi doi={t.doi} />
    </>
  );
}

function Need({
  who,
  status,
  statusText,
  role,
  extra,
  sources,
}: {
  who: string;
  status: string;
  statusText: string;
  role: SourcedText | undefined;
  extra?: string | undefined;
  sources: Sources;
}) {
  return (
    <div className={styles.need} data-status={status} data-testid={`need-${who.toLowerCase()}`}>
      <h5 className={styles.needTitle}>
        {who}: <span className={styles.status}>{statusText}</span>
      </h5>
      {role ? (
        <p>
          <Said t={role} sources={sources} />
        </p>
      ) : (
        <p className={shared.muted}>No known role.</p>
      )}
      {extra && <p className={shared.muted}>{extra}</p>}
    </div>
  );
}

/** "¹⁴C" for the eye, "carbon-14" for the ear. */
function IsotopeLabel({ e, use }: { e: ElementIndexEntry; use: IsotopeUse }) {
  if (use.A === undefined) return <>{e.name} (not one isotope)</>;
  const mass = `${use.A}${use.isomer ?? ""}`;
  return (
    <>
      <span aria-hidden="true">
        <sup>{mass}</sup>
        {e.symbol}
      </span>
      <span className="visually-hidden">
        {e.name.toLowerCase()}-{mass}
      </span>
    </>
  );
}

/** The physical panel's GHS hazard record (physical.hazards), if this build has one. */
function hazardsOf(d: ElementDetailFile): unknown {
  const h = (d.physical as { hazards?: unknown }).hazards;
  return h && typeof h === "object" && !isMissing(h) ? h : null;
}

function label(p: unknown): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    const o = p as { name?: unknown; code?: unknown };
    return typeof o.name === "string" ? o.name : typeof o.code === "string" ? o.code : "";
  }
  return "";
}

/** The signal word and pictograms of the GHS record, read leniently; null when there is nothing to say. */
function ghs(h: unknown): { signal?: string; pictograms: string[] } | null {
  if (!h) return null;
  const o = h as Record<string, unknown>;
  const list = Array.isArray(o.pictograms) ? o.pictograms : [];
  const pictograms = list.map(label).filter(Boolean);
  const signal = typeof o.signalWord === "string" ? o.signalWord : undefined;
  if (!pictograms.length && !signal) return null;
  return signal ? { signal, pictograms } : { pictograms };
}

function IarcTable({ rows, sources }: { rows: Iarc[]; sources: Sources }) {
  return (
    <table className={styles.table} data-testid="iarc">
      <caption className={shared.muted}>
        Carcinogen classifications by the International Agency for Research on Cancer (IARC); the group says how strong
        the evidence is that the agent can cause cancer, not how potent it is.{" "}
        <SourceChip id={rows[0]?.source ?? "iarc_classifications"} sources={sources} />
      </caption>
      <thead>
        <tr>
          <th scope="col">Agent</th>
          <th scope="col">IARC group</th>
          <th scope="col">Monographs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.agent}>
            <th scope="row">{r.agent}</th>
            <td>{isMissing(r.group) ? <MissingValue m={r.group as Missing} /> : (IARC_GROUP[r.group] ?? r.group)}</td>
            <td>{r.volumes?.join(", ") ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Body({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const b = d.biology;
  const body = d.physical.abundance.body;
  const hazardRecord = hazardsOf(d);
  const hazards = ghs(hazardRecord);
  const uses = [...(b.isotopeUses ?? [])].sort((x, y) => FIELD_ORDER.indexOf(x.field) - FIELD_ORDER.indexOf(y.field));
  const toxic = b.toxicity ?? [];
  const iarc = b.iarc ?? [];
  return (
    <div className={styles.panel}>
      <Section title="Does life need it?" id="essential">
        <div className={styles.needs}>
          <Need
            who="Plants"
            status={b.essentialPlant}
            statusText={PLANT_STATUS[b.essentialPlant]}
            role={b.plantRole}
            extra={b.plantClass ? PLANT_CLASS[b.plantClass] : undefined}
            sources={sources}
          />
          <Need
            who="Humans"
            status={b.essentialHuman}
            statusText={HUMAN_STATUS[b.essentialHuman]}
            role={b.humanRole}
            sources={sources}
          />
        </div>
        {b.note && <p className={shared.muted}>{b.note}</p>}
      </Section>

      <Section title="How much is in a human body" id="body">
        <p data-testid="body-content">
          {isMissing(body) ? (
            <MissingValue m={body} />
          ) : (
            <>
              <Quantity q={body} sources={sources} />
              {body.note ? <span className={shared.muted}> {body.note}</span> : null}
            </>
          )}
        </p>
      </Section>

      <Section title="Toxicity and hazards" id="toxicity">
        {toxic.length > 0 ? (
          <ul className={styles.notes} data-testid="toxicity">
            {toxic.map((t) => (
              <li key={t.text}>
                <Said t={t} sources={sources} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.muted} data-testid="toxicity">
            We have no curated note on how {e.name.toLowerCase()} harms living things. That does not mean it is safe.
          </p>
        )}
        {iarc.length > 0 && <IarcTable rows={iarc} sources={sources} />}
        {hazards && (
          <p data-testid="ghs">
            GHS hazard labels (more on the Physical &amp; engineering panel): {hazards.signal && <b>{hazards.signal}</b>}
            {hazards.signal && hazards.pictograms.length > 0 ? "; " : ""}
            {hazards.pictograms.join(", ")}.{" "}
            {typeof (hazardRecord as { source?: unknown }).source === "string" && (
              <SourceChip id={(hazardRecord as { source: string }).source} sources={sources} />
            )}
          </p>
        )}
      </Section>

      {(b.environment ?? []).length > 0 && (
        <Section title="In soils, waters and food webs" id="environment">
          <ul className={styles.notes} data-testid="environment">
            {(b.environment ?? []).map((t) => (
              <li key={t.text}>
                <Said t={t} sources={sources} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Isotopes in biology and medicine" id="isotopes">
        {uses.length > 0 ? (
          <ul className={styles.uses} data-testid="isotope-uses">
            {uses.map((u) => (
              <li key={u.text} data-field={u.field}>
                <span className={styles.useHead}>
                  <b className={styles.isotope}>
                    <IsotopeLabel e={e} use={u} />
                  </b>{" "}
                  <span className={styles.field}>{FIELD[u.field]}</span>
                </span>
                <span>
                  {u.text} <SourceChip id={u.source} sources={sources} />
                  <Doi doi={u.doi} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.muted} data-testid="isotope-uses">
            No use of {e.name.toLowerCase()}'s isotopes in biology or medicine is recorded in our table.
          </p>
        )}
      </Section>

      <SourcesFooter ids={collectSources(b, body, hazards ? hazardRecord : null)} sources={sources} />
    </div>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <Body e={e} d={d} sources={sources} />}</WhenLoaded>;
}
