// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// A sourced sentence of the biology panel: the text in our own words, its source chip and, where the row
// gives one, a link to the paper or book chapter.

import type { SourcedText, SourcesFile } from "../../data/types";
import { SourceChip } from "../../ui/SourceChip";
import styles from "./biology.module.css";

type Sources = SourcesFile["sources"];

export function Doi({ doi }: { doi?: string | undefined }) {
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

export function Said({ t, sources }: { t: SourcedText; sources: Sources }) {
  return (
    <>
      {t.text} <SourceChip id={t.source} sources={sources} />
      <Doi doi={t.doi} />
    </>
  );
}
