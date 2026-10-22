// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// <Quantity>, <MissingValue> and <SourceChip> (SPEC §10 common contract): every number shows its
// unit, its uncertainty in NIST notation and its source; every absent value shows its reason.

import { MISSING_TEXT, formatQuantity, isMissing } from "../data/format";
import type { Missing, Q, SourcesFile } from "../data/types";
import { SourceChip } from "./SourceChip";
import styles from "./ui.module.css";

export { SourceChip };

type Sources = SourcesFile["sources"];

export function MissingValue({ m }: { m: Missing }) {
  return (
    <span className={styles.missing}>
      <span className={styles.reason}>{MISSING_TEXT[m.reason].long}</span>
      {m.note && <span className={styles.note}> — {m.note}</span>}
    </span>
  );
}

export function Quantity({ q, sources }: { q: Q; sources: Sources }) {
  if (isMissing(q)) return <MissingValue m={q} />;
  return (
    <span className={styles.quantity}>
      <span className={styles.value}>{formatQuantity(q)}</span>
      {q.flag && q.flag !== "measured" && <span className={styles.flag}>{q.flag}</span>}{" "}
      <SourceChip id={q.source} sources={sources} />
    </span>
  );
}
