// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The pinned sheet (SPEC §9.2): a modal <dialog> — centred on desktop, a full-height bottom sheet
// on phones — with a header and the panel strip. The strip is a horizontal scroll-snap container,
// one panel per snap point, so trackpad and touch swipes work without script; tabs, the arrow
// buttons, ←/→ and the dots move it too, and the current panel is written to the URL (#/Cs/amo).
// Panels mount when they come within one snap of view. Esc closes and returns focus to the tile.

import { type KeyboardEvent, type MouseEvent, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { closeSheet, setPanel } from "../app/actions";
import { useReducedMotion } from "../app/motion";
import { useView } from "../app/store";
import { isTyping } from "../app/useShortcuts";
import { useElementDetail } from "../data/load";
import type { ElementIndexEntry, SourcesFile } from "../data/types";
import { PANELS } from "../panels/registry";
import type { PanelSlug } from "../panels/slugs";
import { CATEGORY_NAME } from "../table/tileText";
import { ElementImages } from "../ui/ElementImages";
import { SourceChip } from "../ui/Quantity";
import styles from "./ElementSheet.module.css";

interface Props {
  elements: ElementIndexEntry[];
  sources: SourcesFile["sources"];
}

const supportsClosedBy = typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;

export function ElementSheet({ elements, sources }: Props) {
  const symbol = useView((s) => s.element);
  const panel = useView((s) => s.panel) ?? PANELS[0]?.slug ?? "orbitals";
  const current = symbol ? elements.find((e) => e.symbol === symbol) : undefined;
  // Keep showing the last element while the dialog closes.
  const [shown, setShown] = useState<ElementIndexEntry | undefined>(current);
  if (current && current !== shown) setShown(current);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  const onClose = () => {
    const z = shown?.Z;
    closeSheet();
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`button[data-z="${z}"]`)?.focus());
  };

  // Light dismiss where `closedby` is not supported (Safari): a click on the backdrop.
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (supportsClosedBy || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) e.currentTarget.close();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- backdrop light-dismiss fallback; Esc and the Close button are the keyboard routes
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={onDialogClick}
      data-testid="sheet"
      {...{ closedby: "any" }}
    >
      {shown && <SheetBody
          key={shown.Z}
          element={shown}
          elements={elements}
          panel={panel}
          sources={sources}
          onDismiss={() => dialog.current?.close()}
        />}
    </dialog>
  );
}

/** Our own short text from public/data/elements/{Z}.json, with the sources consulted for it. */
function Description({ z, sources }: { z: number; sources: SourcesFile["sources"] }) {
  const detail = useElementDetail(z);
  if (detail.state === "loading") return <p className={styles.muted}>Loading the description…</p>;
  if (detail.state === "failed") {
    return <p className={styles.muted}>The description could not be loaded ({detail.message}).</p>;
  }
  const prose = detail.value.prose;
  if (!prose) return null;
  return (
    <p data-testid="sheet-prose">
      {prose.text}{" "}
      <span className={styles.consulted}>
        Sources consulted:{" "}
        {prose.sources.map((id, i) => (
          <span key={id}>
            {i > 0 && ", "}
            <SourceChip id={id} sources={sources} />
          </span>
        ))}
        .
      </span>
    </p>
  );
}

interface BodyProps {
  element: ElementIndexEntry;
  elements: ElementIndexEntry[];
  panel: PanelSlug;
  sources: SourcesFile["sources"];
  onDismiss: () => void;
}

/** Scrolls the tab row so that the current tab is in sight (on a phone most tabs are off to the side). */
function revealTab(list: HTMLElement | null, index: number, behavior: ScrollBehavior) {
  const tab = list?.querySelector<HTMLElement>(`[data-slug="${PANELS[index]?.slug ?? ""}"]`);
  if (!list || !tab || list.clientWidth === 0) return;
  const lr = list.getBoundingClientRect();
  const tr = tab.getBoundingClientRect();
  if (tr.left < lr.left || tr.right > lr.right) list.scrollBy({ left: tr.left - lr.left - (lr.width - tr.width) / 2, behavior });
}

function SheetBody({ element: e, elements, panel, sources, onDismiss }: BodyProps) {
  const ids = useId();
  const strip = useRef<HTMLDivElement>(null);
  const tablist = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const index = Math.max(0, PANELS.findIndex((p) => p.slug === panel));
  // Panels mount once they come within one snap of the current one, and stay mounted.
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([index - 1, index, index + 1]));
  if (!(mounted.has(index - 1) && mounted.has(index) && mounted.has(index + 1))) {
    setMounted(new Set([...mounted, index - 1, index, index + 1]));
  }
  const first = useRef(true);

  // Bring the strip to the current panel (instantly on open or with reduced motion).
  const indexRef = useRef(index);
  // The panel the app is scrolling the strip to, or null while the reader moves it.
  const scrollingTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    indexRef.current = index;
    const s = strip.current;
    if (!s || s.clientWidth === 0) return;
    const left = index * s.clientWidth;
    const behavior = first.current || reduced ? "instant" : "smooth";
    if (Math.abs(s.scrollLeft - left) > 2) {
      scrollingTo.current = index;
      s.scrollTo({ left, behavior });
    }
    first.current = false;
    revealTab(tablist.current, index, behavior);
  }, [index, reduced]);

  // On a phone the header (photographs, summary) would leave little room for the panel: it folds to
  // a name bar once the reader scrolls into a panel that is long enough, and opens again at its top.
  const header = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const s = strip.current;
    if (!s) return;
    const onScroll = (ev: Event) => {
      const panel = ev.target as HTMLElement;
      if (!(panel instanceof HTMLElement) || panel.parentElement !== s || !panel.hasAttribute("data-current")) return;
      const room = (header.current?.offsetHeight ?? 0) + 24;
      if (panel.scrollTop <= 0) setCompact(false);
      else if (panel.scrollTop > 24 && panel.scrollHeight - panel.clientHeight > room) setCompact(true);
    };
    s.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => s.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // When the strip first gets a size (the dialog has just opened) or changes size (a phone turned
  // sideways), snap straight to the current panel.
  useEffect(() => {
    const s = strip.current;
    if (!s) return;
    let width = s.clientWidth;
    const ro = new ResizeObserver(() => {
      if (s.clientWidth === width) return;
      width = s.clientWidth;
      scrollingTo.current = indexRef.current;
      s.scrollTo({ left: indexRef.current * width, behavior: "instant" });
      revealTab(tablist.current, indexRef.current, "instant");
      first.current = false;
    });
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  // A swipe (or trackpad scroll) that settles on another panel selects it. Only a strip at rest on a
  // panel counts, and only while the sheet is open: WebKit also fires scroll events mid-animation and
  // when the closing dialog resets the strip to 0, which must not select the first panel. While the
  // app itself scrolls the strip (a tab, a key), only arriving at its target counts: the end of an
  // earlier scroll can land after the next panel was chosen, and must not undo it (two quick → presses
  // bounced back a panel). Touch, a pointer press or the wheel hands the strip back to the reader.
  useEffect(() => {
    const s = strip.current;
    if (!s) return;
    let timer: number | undefined;
    const settle = () => {
      const width = s.clientWidth;
      if (!useView.getState().element || width === 0) return;
      const i = Math.round(s.scrollLeft / width);
      if (Math.abs(s.scrollLeft - i * width) > 2) return;
      if (scrollingTo.current !== null) {
        if (i === scrollingTo.current) scrollingTo.current = null;
        return;
      }
      const slug = PANELS[i]?.slug;
      if (slug && slug !== useView.getState().panel) setPanel(slug);
    };
    const reader = () => {
      scrollingTo.current = null;
    };
    const handBack = ["pointerdown", "touchstart", "wheel"] as const;
    for (const type of handBack) s.addEventListener(type, reader, { passive: true });
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    };
    const native = "onscrollend" in window;
    s.addEventListener(native ? "scrollend" : "scroll", native ? settle : onScroll);
    return () => {
      window.clearTimeout(timer);
      s.removeEventListener(native ? "scrollend" : "scroll", native ? settle : onScroll);
      for (const type of handBack) s.removeEventListener(type, reader);
    };
  }, []);

  const go = useCallback(
    (i: number, focusTab = false) => {
      const target = PANELS[(i + PANELS.length) % PANELS.length];
      if (!target) return;
      setPanel(target.slug);
      if (focusTab) tablist.current?.querySelector<HTMLElement>(`[data-slug="${target.slug}"]`)?.focus();
    },
    [],
  );

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || isTyping(ev.target)) return;
    const inTabs = tablist.current?.contains(ev.target as Node) ?? false;
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      go(index + (ev.key === "ArrowRight" ? 1 : -1), inTabs);
    } else if (inTabs && (ev.key === "Home" || ev.key === "End")) {
      ev.preventDefault();
      go(ev.key === "Home" ? 0 : PANELS.length - 1, true);
    }
  };

  const currentPanel = PANELS[index];
  return (
    // The handler adds ←/→ panel switching for everything inside the sheet; the tabs and the
    // arrow buttons are the focusable controls it mirrors.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={styles.body} onKeyDown={onKeyDown} data-category={e.category} data-compact={compact || undefined}>
      <header className={styles.header} ref={header}>
        <button type="button" className={styles.close} onClick={onDismiss} aria-label={`Close ${e.name}`}>
          <span aria-hidden="true">×</span>
        </button>
        <div className={styles.identity}>
          <span className={styles.symbol} aria-hidden="true">
            {e.symbol}
          </span>
          <div>
            <h2 id="sheet-title" className={styles.name}>
              {e.name} <span className={styles.z}>Z = {e.Z}</span>
            </h2>
            {compact && (
              <button type="button" className={styles.expand} onClick={() => setCompact(false)} aria-expanded={false}>
                Show photographs and summary
              </button>
            )}
            <p className={styles.meta}>
              {CATEGORY_NAME[e.category]} · {e.block}-block · period {e.period}
              {e.group === null ? "" : ` · group ${e.group}`} ·{" "}
              {e.standardState === "unknown" ? "state at room temperature unknown" : `${e.standardState} at room temperature`}
            </p>
          </div>
        </div>
        <div className={styles.photos}>
          <ElementImages element={e} size="large" max={3} />
        </div>
        <div className={styles.prose}>
          <Description z={e.Z} sources={sources} />
          <p>{e.quantumFact}</p>
          <p className={styles.muted}>
            Discovered: {e.discovery.text} <SourceChip id={e.discovery.source} sources={sources} />.
          </p>
        </div>
      </header>

      <div className={styles.nav}>
        <button type="button" className={styles.step} onClick={() => go(index - 1)} aria-label={`Previous panel: ${PANELS[(index + PANELS.length - 1) % PANELS.length]?.title}`}>
          <span aria-hidden="true">‹</span>
        </button>
        <div ref={tablist} className={styles.tabs} role="tablist" aria-label="Panels">
          {PANELS.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              role="tab"
              id={`${ids}-tab-${p.slug}`}
              data-slug={p.slug}
              aria-selected={i === index}
              aria-controls={`${ids}-panel-${p.slug}`}
              tabIndex={i === index ? 0 : -1}
              className={styles.tab}
              onClick={() => go(i)}
            >
              {p.title}
            </button>
          ))}
        </div>
        <button type="button" className={styles.step} onClick={() => go(index + 1)} aria-label={`Next panel: ${PANELS[(index + 1) % PANELS.length]?.title}`}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div className={styles.dots} aria-hidden="true">
        {PANELS.map((p, i) => (
          <span key={p.slug} data-current={i === index || undefined} />
        ))}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {currentPanel ? `${currentPanel.title} panel, ${index + 1} of ${PANELS.length}` : ""}
      </p>

      <div ref={strip} className={styles.strip} data-testid="panel-strip">
        {PANELS.map((p, i) => {
          const Component = p.Component;
          return (
            <section
              key={p.slug}
              id={`${ids}-panel-${p.slug}`}
              role="tabpanel"
              aria-labelledby={`${ids}-tab-${p.slug}`}
              className={styles.panel}
              inert={i !== index}
              tabIndex={i === index ? 0 : -1}
              data-slug={p.slug}
              data-current={i === index || undefined}
            >
              <h3 className={styles.panelTitle}>{p.title}</h3>
              <p className={styles.summary}>{p.summary}</p>
              {mounted.has(i) && (
                <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
                  <Component element={e} elements={elements} sources={sources} active={i === index} />
                </Suspense>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
