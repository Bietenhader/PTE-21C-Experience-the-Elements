// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The frame every chart sits in (SPEC §10 common contract): a caption that says what is plotted and
// from where, the chart itself (measured to the available width), and a "Show as table" toggle that
// lists the same numbers, for screen readers and for anyone who wants them.

import { type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import styles from "./viz.module.css";

export interface TableSpec {
  columns: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
}

interface Props {
  title?: string;
  caption: ReactNode;
  table: TableSpec;
  /** Draws the chart at the measured width; the SVG should be labelled by `captionId`. */
  children: (ctx: { width: number; captionId: string }) => ReactNode;
  minWidth?: number;
  testId?: string;
}

export function ChartFrame({ title, caption, table, children, minWidth = 260, testId }: Props) {
  const captionId = useId();
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(minWidth, Math.floor(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);

  return (
    <figure className={styles.frame} data-testid={testId}>
      {title && <h4 className={styles.title}>{title}</h4>}
      <figcaption id={captionId} className={styles.caption}>
        {caption}
      </figcaption>
      <div ref={box} className={styles.plot}>
        {width > 0 && children({ width, captionId })}
      </div>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((t) => !t)}
      >
        {showTable ? "Hide table" : "Show as table"}
      </button>
      <div id={tableId} className={styles.tableWrap}>
        {showTable && (
          <table className={styles.table}>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.key}>
                  {r.cells.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {c}
                      </th>
                    ) : (
                      <td key={i}>{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </figure>
  );
}
