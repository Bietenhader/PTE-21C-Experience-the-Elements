// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// <Quantity>, <MissingValue> and <SourceChip> (SPEC §10 common contract): every number shows its
// unit, its uncertainty in NIST notation and its source; every absent value shows its reason.

import { MISSING_TEXT, concise, isMissing } from "../data/format";
import type { Missing, Q, SourcesFile } from "../data/types";
import { SourceChip } from "./SourceChip";
import styles from "./ui.module.css";

export { SourceChip };

type Sources = SourcesFile["sources"];

export function MissingValue({ m }: { m: Missing }) {
  return (
    <span className={styles.missing} data-missing={m.reason}>
      <span className={styles.reason}>{MISSING_TEXT[m.reason].long}</span>
      {m.note && <span className={styles.note}> — {m.note}</span>}
    </span>
  );
}

/** A stored unit as written: "μ_N" (the nuclear magneton) is μ with a subscript N. */
export function Unit({ unit }: { unit: string }) {
  const sub = /^(.+)_(.+)$/.exec(unit);
  if (!sub) return <>{unit}</>;
  return (
    <>
      {sub[1]}
      <sub>{sub[2]}</sub>
    </>
  );
}

export function Quantity({ q, sources }: { q: Q; sources: Sources }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  return (
    <span className={styles.quantity}>
      <span className={styles.value}>
        {concise(q.value, q.unc)}
        {q.unit && (
          <>
            {" "}
            <Unit unit={q.unit} />
          </>
        )}
        {q.unc === 0 && " (exact)"}
      </span>
      {q.flag && q.flag !== "measured" && <span className={styles.flag}>{q.flag}</span>}{" "}
      <SourceChip id={q.source} sources={sources} />
    </span>
  );
}
