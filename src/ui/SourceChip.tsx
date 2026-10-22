// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// A source chip that opens its registry entry (SPEC §10 common contract, §15.4): the source's name
// linked to it, the licence linked to its text, the retrieval date and the citation. The popover is
// rendered next to the chip rather than in a portal, so it stays inside an open modal <dialog>
// (the element sheet), where the rest of the page is inert.

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { useEffect, useId, useRef, useState } from "react";
import type { SourcesFile } from "../data/types";
import styles from "./ui.module.css";

type Sources = SourcesFile["sources"];

export function SourceChip({ id, sources }: { id: string; sources: Sources }) {
  const s = sources[id];
  const [open, setOpen] = useState(false);
  const popId = useId();
  const button = useRef<HTMLButtonElement | null>(null);
  const { refs, floatingStyles } = useFloating<HTMLElement>({
    open,
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const pop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    // Capture phase, so Esc closes the popover before the sheet around it sees the key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!s) return <span className={styles.chip}>{id}</span>;

  return (
    <span className={styles.chipWrap}>
      <button
        ref={(el) => {
          button.current = el;
          refs.setReference(el);
        }}
        type="button"
        className={styles.chip}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {s.title}
      </button>
      {open && (
        <div
          ref={(el) => {
            pop.current = el;
            refs.setFloating(el);
          }}
          id={popId}
          role="dialog"
          aria-label={`Source: ${s.title}`}
          className={styles.popover}
          style={floatingStyles}
        >
          <p className={styles.popTitle}>
            <a href={s.url}>{s.title}</a>
          </p>
          <p>
            Licence: <a href={s.licenceUrl} rel="license">{s.licence}</a>
            {s.retrieved ? ` · retrieved ${s.retrieved}` : ""}
          </p>
          <p className={styles.popCitation}>{s.citation}</p>
        </div>
      )}
    </span>
  );
}
