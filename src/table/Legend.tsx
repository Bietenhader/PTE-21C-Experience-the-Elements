// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Below the table (SPEC §7.1): category legend, block legend redrawn from the active layout,
// the tile key, and notes on notation.

import type { CSSProperties } from "react";
import { groupDigits } from "../data/format";
import type { Category, ElementIndexEntry, LayoutVariant, SourcesFile } from "../data/types";
import { EV_IN_KJ_PER_MOL } from "../physics/constants";
import type { EnergyUnit } from "../physics/units";
import { Quantity, SourceChip } from "../ui/Quantity";
import { gridGeometry } from "./grid";
import styles from "./Legend.module.css";
import { Tile, Trefoil } from "./Tile";
import { CATEGORY_NAME } from "./tileText";

const CATEGORIES = Object.keys(CATEGORY_NAME) as Category[];
const BLOCK_NAME = { s: "s-block", p: "p-block", d: "d-block", f: "f-block" } as const;

interface Props {
  elements: ElementIndexEntry[];
  variant: LayoutVariant;
  sources: SourcesFile["sources"];
  energyUnit?: EnergyUnit;
  keySymbol?: string;
}

export function Legend({ elements, variant, sources, energyUnit = "kJ/mol", keySymbol = "Cs" }: Props) {
  const keyElement = elements.find((e) => e.symbol === keySymbol) ?? elements[0];
  return (
    <section className={styles.legend} aria-labelledby="legend-heading">
      <h2 id="legend-heading" className="visually-hidden">
        Legend
      </h2>

      <div className={styles.row}>
        <section aria-labelledby="cat-heading" className={styles.panel}>
          <h3 id="cat-heading">Categories</h3>
          <ul className={styles.swatches}>
            {CATEGORIES.map((c) => (
              <li key={c}>
                <span className={styles.swatch} style={{ "--fill": `var(--cat-${c})`, "--edge": `var(--accent-${c})` } as CSSProperties} />
                {CATEGORY_NAME[c]}
              </li>
            ))}
          </ul>
          <p className={styles.small}>
            From PubChem's group-block field; halogens are counted as reactive nonmetals, and every element from
            meitnerium (Z = 109) on is “unknown properties”, since its chemistry has not been measured.
          </p>
        </section>

        <section aria-labelledby="block-heading" className={styles.panel}>
          <h3 id="block-heading">Blocks</h3>
          <BlockMap elements={elements} variant={variant} />
          <ul className={styles.blockKey}>
            {(Object.keys(BLOCK_NAME) as Array<keyof typeof BLOCK_NAME>).map((b) => (
              <li key={b}>
                <span className={styles.bar} style={{ background: `var(--block-${b})` }} />
                {BLOCK_NAME[b]}
              </li>
            ))}
          </ul>
          <p className={styles.small}>The thin bar along the bottom of each tile names its block.</p>
        </section>
      </div>

      {keyElement && (
        <section aria-labelledby="key-heading" className={styles.keySection}>
          <h3 id="key-heading">How to read a tile</h3>
          <div className={styles.key}>
            <div className={styles.keyTile}>
              <Tile
                element={keyElement}
                sources={sources}
                energyUnit={energyUnit}
                variant="key"
                style={{ inlineSize: "100%", blockSize: "100%" }}
              />
            </div>
            <dl className={styles.fields}>
              <dt>Top left</dt>
              <dd>
                Standard atomic weight — for {keyElement.name}:{" "}
                {"value" in keyElement.atomicWeight ? <Quantity q={keyElement.atomicWeight} sources={sources} /> : null}.
                Elements without one show the mass number of their longest-lived isotope in parentheses, e.g.{" "}
                <b>(97)</b> for technetium.
              </dd>
              <dt>Top right</dt>
              <dd>
                Atomic number Z. The trefoil <Trefoil /> marks an element with no stable isotope.
              </dd>
              <dt>Second line</dt>
              <dd>
                First ionization energy in {energyUnit} (<Quantity q={keyElement.ie1} sources={sources} />), then the
                Pauling electronegativity (<Quantity q={keyElement.electronegativityPauling} sources={sources} />).
              </dd>
              <dt>Right edge</dt>
              <dd>
                Oxidation states, highest first; the common ones in bold. <SourceChip id="pubchem" sources={sources} />{" "}
                — bold states are Jefferson Lab's list of main states, the others come from Los Alamos National
                Laboratory's full list.
              </dd>
              <dt>Middle</dt>
              <dd>Symbol and name (IUPAC spelling).</dd>
              <dt>Configuration</dt>
              <dd>
                Measured ground-state configuration in noble-gas notation (
                <SourceChip id="nist_gsie" sources={sources} />
                ). <b>◆</b> means it differs from the Aufbau (Madelung) prediction; <b className="system-glyph">†</b> marks a prediction for
                elements no one has measured.
              </dd>
              <dt>Bottom line</dt>
              <dd>
                Ground-state hyperfine splitting <i className="system-glyph">ν</i>
                <sub>hfs</sub> of the reference isotope — for caesium-133 it
                defines the SI second. Otherwise the reason it is absent: <i>no hfs (I = 0)</i> or{" "}
                <i>no hfs (J = 0)</i> when physics forbids it, <i>hfs: no stable isotope</i>, or <i>hfs n/m</i>{" "}
                when the value is not yet in our curated table.
              </dd>
            </dl>
          </div>
        </section>
      )}

      <section aria-labelledby="notes-heading" className={styles.panel}>
        <h3 id="notes-heading">Notes</h3>
        <ul className={styles.notes}>
          <li>
            Energies: 1 eV ≈ {groupDigits(EV_IN_KJ_PER_MOL.toFixed(6))} kJ/mol (exactly e·N<sub>A</sub>, from the
            CODATA 2022 defining constants). Hover any value to see it with its uncertainty and source.
          </li>
          <li>
            Ionization energies in <b>[ ]</b> are semi-empirical (interpolated or extrapolated) and in <b>( )</b>{" "}
            theoretical, exactly as NIST marks them.
          </li>
          <li>
            Missing values are never shown as 0 or a dash: <i>n/m</i> not measured, <i>n/a</i> not applicable,{" "}
            <i>pred. only</i> only theoretical predictions exist.
          </li>
          <li>
            Small tiles show fewer fields. Zoom in — pinch, Ctrl/⌘ + scroll, double-tap the background, or the
            “Full-size tiles” button — and every field appears.
          </li>
        </ul>
      </section>
    </section>
  );
}

function BlockMap({ elements, variant }: { elements: ElementIndexEntry[]; variant: LayoutVariant }) {
  const g = gridGeometry(variant);
  return (
    <div
      className={styles.blockMap}
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${g.columns.length}, 1fr)`, gridTemplateRows: `repeat(${g.rows.length}, 1fr)` }}
    >
      {elements.map((e) => {
        const c = variant.cells[String(e.Z)];
        return c ? (
          <span key={e.Z} style={{ gridColumn: g.col(c.col), gridRow: g.row(c.row), background: `var(--block-${e.block})` }} />
        ) : null;
      })}
    </div>
  );
}
