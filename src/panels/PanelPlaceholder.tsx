// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Honest placeholder for a panel that a later milestone builds: says what is coming and when,
// and shows no number it cannot source.

import styles from "./PanelPlaceholder.module.css";
import type { PanelProps } from "./types";

interface Props extends PanelProps {
  milestone: "M3" | "M4";
  planned: string[];
}

export function PanelPlaceholder({ element, milestone, planned }: Props) {
  return (
    <div className={styles.placeholder}>
      <p className={styles.badge}>Coming in milestone {milestone}</p>
      <p>For {element.name}, this panel will show:</p>
      <ul>
        {planned.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <footer className={styles.footer}>Sources used on this panel: none yet — it shows no data so far.</footer>
    </div>
  );
}
