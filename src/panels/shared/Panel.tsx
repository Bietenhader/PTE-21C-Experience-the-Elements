// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Building blocks shared by the panels (SPEC §10): sections with headings, the approximation badge,
// the loading and failure states of a panel's data file, and the footer that lists every source the
// panel used, as chips that open the registry entry.

import type { ReactNode } from "react";
import type { Loaded } from "../../data/load";
import type { SourcesFile } from "../../data/types";
import { SourceChip } from "../../ui/SourceChip";
import styles from "./panel.module.css";

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className={styles.section} aria-label={title} data-section={id}>
      <h4 className={styles.heading}>{title}</h4>
      {children}
    </section>
  );
}

/** A note that names an approximation where it is used (SPEC §2.3). */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <p className={styles.badge} role="note">
      {children}
    </p>
  );
}

export function SourcesFooter({ ids, sources }: { ids: string[]; sources: SourcesFile["sources"] }) {
  return (
    <footer className={styles.footer} data-testid="panel-sources">
      Sources used on this panel:{" "}
      {ids.length === 0
        ? "none."
        : ids.map((id, i) => (
            <span key={id}>
              {i > 0 && " "}
              <SourceChip id={id} sources={sources} />
            </span>
          ))}
    </footer>
  );
}

/** Renders `children(value)` once every file has arrived; says so plainly while waiting or on failure. */
export function WhenLoaded<T extends unknown[]>({
  files,
  children,
}: {
  files: { [K in keyof T]: Loaded<T[K]> };
  children: (...values: T) => ReactNode;
}) {
  const failed = files.find((f) => f.state === "failed");
  if (failed && failed.state === "failed") {
    return <p className={styles.muted}>This panel's data could not be loaded ({failed.message}). Reload the page to try again.</p>;
  }
  if (files.some((f) => f.state === "loading")) return <p className={styles.muted}>Loading…</p>;
  return <>{children(...(files.map((f) => (f.state === "ready" ? f.value : undefined)) as T))}</>;
}
