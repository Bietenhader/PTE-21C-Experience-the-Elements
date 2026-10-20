// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// One element tile (SPEC §7.1). Progressive disclosure is pure CSS (container queries in
// Tile.module.css): ≥ 110 px every reference-table field, 60–110 px Z/symbol/name/configuration,
// < 60 px Z and symbol. The accessible name and description always carry every field.
// While a heatmap or map is active the tile shows its value instead (a "face", see face.ts).

import { type CSSProperties, Fragment, memo, useId } from "react";
import type { ElementIndexEntry, SourcesFile } from "../data/types";
import { L_LETTERS } from "../physics/madelung";
import type { EnergyUnit } from "../physics/units";
import type { Face } from "./face";
import styles from "./Tile.module.css";
import { tileText } from "./tileText";

interface TileProps {
  element: ElementIndexEntry;
  sources: SourcesFile["sources"];
  style?: CSSProperties;
  /** "key" renders a non-interactive copy for the "how to read a tile" legend. */
  variant?: "table" | "key";
  energyUnit?: EnergyUnit;
  face?: Face | undefined;
  /** Search: true = matches, false = does not, undefined = no search. */
  match?: boolean | undefined;
}

export const Tile = memo(function Tile({ element: e, sources, style, variant = "table", energyUnit = "kJ/mol", face, match }: TileProps) {
  const t = tileText(e, sources, energyUnit);
  const descId = useId();
  const faceId = useId();
  const oxCount = t.ox.states.length;
  const oxRows = oxCount > 7 ? Math.ceil(oxCount / 2) : Math.max(1, oxCount);
  const body = (
    <span className={styles.inner} aria-hidden="true" style={{ "--ox-rows": oxRows } as CSSProperties}>
      <span className={styles.weight} data-field="weight" data-missing={t.weight.missing || undefined} title={t.weight.title}>
        {t.weight.text}
      </span>
      <span className={styles.z} data-field="z">
        {e.radioactive && <Trefoil />}
        {e.Z}
      </span>
      <span className={styles.ieen}>
        <span data-field="ie1" data-missing={t.ie.missing || undefined} title={t.ie.title}>
          {t.ie.text}
        </span>
        <span data-field="en" data-missing={t.en.missing || undefined} title={t.en.title}>
          {t.en.text}
        </span>
      </span>
      <span className={styles.ox} data-field="ox" title={t.ox.title}>
        {t.ox.states.map((s) => (s.common ? <b key={s.text}>{s.text}</b> : <span key={s.text}>{s.text}</span>))}
      </span>
      <span className={styles.symbol} data-field="symbol">{e.symbol}</span>
      <span className={styles.name} data-field="name">{e.name}</span>
      <span className={styles.config} data-field="config" title={t.config.title} data-predicted={t.config.predicted || undefined}>
        {t.config.core && <span className={styles.core}>[{t.config.core}]</span>}
        {t.config.subshells.map((s) => (
          <Fragment key={`${s.n}${s.l}`}>
            {s.n}
            {L_LETTERS[s.l]}
            <sup>{s.occupancy}</sup>
          </Fragment>
        ))}
        {t.config.anomalous && <span className={styles.anomaly}>◆</span>}
        {t.config.predicted && <span className={styles.anomaly}>†</span>}
      </span>
      <span className={styles.hfs} data-field="hfs" data-missing={t.hfs.missing || undefined} title={t.hfs.title}>
        {t.hfs.missing ? (
          t.hfs.text
        ) : (
          <>
            <i>ν</i>
            <sub>hfs</sub> {t.hfs.text} · <sup>{t.hfs.isotope}</sup>
            {e.symbol}
          </>
        )}
      </span>
      <span className={styles.block}>{e.block}</span>
      {face && (
        <span className={styles.value} data-field="value" data-missing={face.missing || undefined}>
          {face.text}
        </span>
      )}
    </span>
  );

  if (variant === "key") {
    return (
      <div className={styles.tile} data-category={e.category} data-block={e.block} style={style} role="img" aria-label={`${t.label} ${t.description}`}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={styles.tile}
      data-category={e.category}
      data-block={e.block}
      data-z={e.Z}
      data-face={face?.kind}
      data-face-missing={face?.missing || undefined}
      data-match={match === undefined ? undefined : String(match)}
      style={face ? ({ ...style, "--fill": face.fill, "--face-ink": face.ink } as CSSProperties) : style}
      title={face ? face.description : undefined}
      aria-label={`${t.label} Press Enter for details.`}
      aria-describedby={face ? `${descId} ${faceId}` : descId}
    >
      {body}
      <span id={descId} hidden>
        {t.description}
      </span>
      {face && (
        <span id={faceId} hidden>
          {face.description}
        </span>
      )}
    </button>
  );
});

/** Radiation trefoil, drawn rather than taken from a font so it renders everywhere. */
export function Trefoil() {
  return (
    <svg className={styles.trefoil} viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
      <circle r="1.6" fill="currentColor" />
      {[90, 210, 330].map((a) => (
        <path
          key={a}
          fill="currentColor"
          transform={`rotate(${a})`}
          d="M 2.6 -1.5 A 3 3 0 0 0 2.6 1.5 L 8.2 4.7 A 9.5 9.5 0 0 0 8.2 -4.7 Z"
        />
      ))}
    </svg>
  );
}
