// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The About page (SPEC §6.4, §12, §15.4): what PTE-21C is, the privacy statement, how complete the
// data is (public/data/coverage.json, written by tools/report.py), every data source with its
// licence, retrieval date and citation, and where the photo credits are. Opened from the header or
// the footer, and by the link #/about.

import { useEffect, useId, useRef } from "react";
import { useCoverage } from "../data/load";
import { MISSING_TEXT } from "../data/format";
import type { ElementIndexEntry, MissingReason, Source, SourcesFile } from "../data/types";
import { closeAbout } from "./actions";
import { useView } from "./store";
import styles from "./AboutDialog.module.css";

const REPO = "https://github.com/Bietenhader/PTE-21C-Experience-the-Elements";
const KIND_ORDER: Record<Source["kind"], number> = { fetched: 0, curated: 1, reference: 2 };
const KIND_TEXT: Record<Source["kind"], string> = {
  fetched: "downloaded by the pipeline",
  curated: "compiled by hand, row by row",
  reference: "reference",
};

interface Props {
  elements: ElementIndexEntry[];
  sources: SourcesFile["sources"];
}

export function AboutDialog({ elements, sources }: Props) {
  const open = useView((s) => s.aboutOpen);
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${ids}-title`}
      onClose={closeAbout}
      data-testid="about"
      {...{ closedby: "any" }}
    >
      {open && <AboutBody titleId={`${ids}-title`} elements={elements} sources={sources} />}
    </dialog>
  );
}

function AboutBody({ titleId, elements, sources }: Props & { titleId: string }) {
  const used = Object.values(sources)
    .filter((s) => s.status !== "not_yet_used")
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
  const later = Object.values(sources).filter((s) => s.status === "not_yet_used");
  const images = elements.flatMap((e) => e.images);
  const photos = images.filter((i) => i.kind !== "placeholder").length;
  const placeholders = elements.filter((e) => e.images.every((i) => i.kind === "placeholder")).length;

  return (
    <div className={styles.body}>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          About PTE-21C
        </h2>
        <form method="dialog">
          <button type="submit" className={styles.close} aria-label="Close About">
            <span aria-hidden="true">×</span>
          </button>
        </form>
      </header>

      <p>
        PTE-21C is a periodic table that tries to be honest about what is measured and what is not. Every number
        carries its source; a value nobody has measured is shown as missing, with the reason, never as zero; and
        where the table uses an approximation, it says so.
      </p>

      <section aria-labelledby={`${titleId}-privacy`}>
        <h3 id={`${titleId}-privacy`}>Privacy</h3>
        <p data-testid="privacy">
          No cookies, no analytics, no fonts or scripts from other sites; your settings are kept in this browser’s
          local storage and nothing is sent anywhere.
        </p>
      </section>

      <section aria-labelledby={`${titleId}-coverage`}>
        <h3 id={`${titleId}-coverage`}>How complete the data is</h3>
        <Coverage />
      </section>

      <section aria-labelledby={`${titleId}-sources`}>
        <h3 id={`${titleId}-sources`}>Data sources</h3>
        <p className={styles.muted}>
          {used.length} sources are used in this build. Downloaded sources show the date of the copy the data was built
          from. The same list, with versions, is in{" "}
          <a href={`${REPO}/blob/main/PROVENANCE.md`}>PROVENANCE.md</a>.
        </p>
        <ul className={styles.sources}>
          {used.map((s) => (
            <SourceItem key={s.id} s={s} />
          ))}
        </ul>
        {later.length > 0 && (
          <details className={styles.later}>
            <summary>Registered for later milestones ({later.length})</summary>
            <ul className={styles.sources}>
              {later.map((s) => (
                <SourceItem key={s.id} s={s} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby={`${titleId}-photos`}>
        <h3 id={`${titleId}-photos`}>Photographs</h3>
        <p>
          {photos} photographs show {elements.length - placeholders} elements; the other {placeholders} have never
          been seen in a visible amount or have no free photograph, and show an honest placeholder instead. Each photo
          is credited where it appears (title, author, licence and source); the full list is in{" "}
          <a href={`${REPO}/blob/main/CREDITS.md`}>CREDITS.md</a>. Photos under share-alike licences are shown
          unmodified.
        </p>
      </section>

      <section aria-labelledby={`${titleId}-licence`}>
        <h3 id={`${titleId}-licence`}>Licence</h3>
        <p>
          PTE-21C by Bietenhader (Fin) is licensed under{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>. Data and photographs keep
          their own licences, listed above and with each photo. <a href={REPO}>Source code</a>.
        </p>
      </section>
    </div>
  );
}

function SourceItem({ s }: { s: Source }) {
  return (
    <li className={styles.source} data-source={s.id}>
      <a href={s.url} className={styles.sourceTitle}>
        {s.title}
      </a>
      <span className={styles.muted}>
        {" "}
        — {KIND_TEXT[s.kind]}
        {s.retrieved ? `, retrieved ${s.retrieved}` : ""}
        {s.status === "unavailable" ? ", unavailable when this data was built" : ""}
      </span>
      <br />
      <span className={styles.citation}>{s.citation}</span>{" "}
      <a href={s.licenceUrl} rel="license" className={styles.licence}>
        {s.licence}
      </a>
    </li>
  );
}

function Coverage() {
  const coverage = useCoverage(true);
  if (coverage.state === "loading") return <p className={styles.muted}>Loading the coverage table…</p>;
  if (coverage.state === "failed") {
    return <p className={styles.muted}>The coverage table could not be loaded ({coverage.message}).</p>;
  }
  const { total, fields } = coverage.value;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-testid="coverage">
        <caption>
          For each field, how many of the {total} elements have a value. Generated by tools/report.py from the
          committed data; the reasons for missing values are counted where the field records them.
        </caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Elements</th>
            <th scope="col">Why the rest are missing</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.label}>
              <th scope="row">{f.label}</th>
              <td className={styles.count}>
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ inlineSize: `${(100 * f.count) / total}%` }} />
                </span>
                {f.count} / {total}
              </td>
              <td className={styles.reasons}>
                {Object.entries(f.missing)
                  .map(([reason, n]) => `${MISSING_TEXT[reason as MissingReason]?.long ?? reason}: ${n}`)
                  .join(" · ") || (f.count === total ? "" : "reasons not recorded for this field")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
