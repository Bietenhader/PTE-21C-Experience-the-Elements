// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The table in its pan/zoom viewport (SPEC §7.4, IMPLEMENTER'S CHOICE I1: hand-rolled).
// Panning is the browser's own scrolling (touch, trackpad, scrollbars, keyboard). Zooming changes
// the tile width, so tiles disclose more fields as they grow: pinch on touch screens, trackpad
// pinch or Ctrl/⌘ + wheel on desktop (Safari's gesture events too), double-tap or double-click on
// the background, and the buttons. The zoom keeps the point under the fingers or pointer still.

import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  startTransition,
  useRef,
  useState,
} from "react";
import { openElement } from "../app/actions";
import type { Group3, Overlay } from "../app/route";
import { useSettings } from "../app/store";
import type { ArrowTrend, ElementIndexEntry, LayoutFile, SourcesFile } from "../data/types";
import type { EnergyUnit } from "../physics/units";
import { TrendArrows } from "../trends/TrendArrows";
import type { Faces } from "./face";
import { gridGeometry } from "./grid";
import { HoverCard, useHoverCard } from "./HoverCard";
import { PeriodicTable } from "./PeriodicTable";
import styles from "./TableView.module.css";
import { clampTileWidth, fitTileWidth, type Metrics, TILE_FULL_REM, ZOOM_STEP } from "./zoom";

type Zoom = { mode: "fit" } | { mode: "manual"; w: number };

interface Anchor {
  z: number;
  fx: number;
  fy: number;
  clientX: number;
  clientY: number;
}

interface Props {
  elements: ElementIndexEntry[];
  layout: LayoutFile;
  group3: Group3;
  sources: SourcesFile["sources"];
  energyUnit: EnergyUnit;
  faces: Faces | null;
  matches: ReadonlySet<number> | null;
  overlay: Overlay | null;
  arrowTrend: ArrowTrend | null;
  /** The sheet is open: no hover cards. */
  sheetOpen: boolean;
}

function readMetrics(): Metrics {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { rem, gap: 3, labelTrack: 1.5 * rem };
}

export function TableView(props: Props) {
  const { elements, layout, group3, sources, energyUnit, faces, matches, overlay, arrowTrend, sheetOpen } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [metrics, setMetrics] = useState<Metrics>({ rem: 16, gap: 3, labelTrack: 24 });
  const [zoom, setZoom] = useState<Zoom>({ mode: "fit" });
  const anchor = useRef<Anchor | null>(null);
  const hintId = useId();
  const arrows = arrowTrend !== null;

  const variant = layout.variants[group3];
  const tracks = useMemo(() => {
    const g = gridGeometry(variant);
    const tileCols = g.columns.filter((t) => t === "tile").length;
    return { tileCols, labelCols: g.columns.length - tileCols };
  }, [variant]);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // A transition: until it lands the table fits to width in CSS and looks the same, so the
    // re-render need not block the first paint or the main thread (SPEC §13.4 budgets).
    const update = () => {
      const cs = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const m = readMetrics();
      startTransition(() => {
        setAvailable(width);
        setMetrics(m);
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const room = arrows ? 2.75 * metrics.rem * 2 : 0;
  const fit = fitTileWidth(Math.max(0, available - room), tracks, metrics);
  const full = TILE_FULL_REM * metrics.rem;
  // Until the viewport is measured, the table fits to width in CSS (see PeriodicTable.module.css).
  const measured = available > 0;
  const tileWidth = zoom.mode === "fit" ? fit : zoom.w;

  // The width a zoom starts from: the state once measured, the tiles themselves before that.
  const tileRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    tileRef.current = measured || zoom.mode === "manual" ? tileWidth : null;
  }, [tileWidth, measured, zoom.mode]);
  const currentWidth = useCallback(
    () => tileRef.current ?? viewport.current?.querySelector("[data-z]")?.getBoundingClientRect().width ?? 24,
    [],
  );

  const hover = useHoverCard(sheetOpen);
  const { hide } = hover;
  useEffect(() => hide(), [layout.id, group3, hide]);

  /** Zoom to width `w`, keeping the content under (clientX, clientY) where it is. */
  const zoomTo = useCallback((w: number | "fit", clientX?: number, clientY?: number, keep?: Anchor) => {
    const vp = viewport.current;
    if (!vp) return;
    const box = vp.getBoundingClientRect();
    const x = clientX ?? box.left + box.width / 2;
    const y = clientY ?? Math.min(box.top + box.height / 2, window.innerHeight / 2);
    anchor.current = keep ? { ...keep, clientX: x, clientY: y } : nearestTile(vp, x, y);
    setZoom(w === "fit" ? { mode: "fit" } : { mode: "manual", w: clampTileWidth(w, readMetrics()) });
    // Whoever zooms has found the feature: the tip has done its job.
    if (w !== "fit" && !useSettings.getState().zoomHintSeen) useSettings.getState().set("zoomHintSeen", true);
  }, []);

  // When the live table first paints (the prerendered copy marks "pte:table" earlier).
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => performance.mark("pte:live-table")));
  }, []);

  // After a zoom, scroll so the anchored tile is back under the pointer.
  useLayoutEffect(() => {
    const a = anchor.current;
    const vp = viewport.current;
    anchor.current = null;
    if (!a || !vp) return;
    const tile = vp.querySelector<HTMLElement>(`[data-z="${a.z}"]`);
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    vp.scrollLeft += r.left + a.fx * r.width - a.clientX;
    const dy = r.top + a.fy * r.height - a.clientY;
    if (Math.abs(dy) > 0.5) window.scrollBy(0, dy);
  }, [tileWidth]);

  // Gestures. Native listeners: React's wheel and touch listeners are passive, and these must be
  // able to stop the browser zooming the whole page.
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    let pinch: { d0: number; w0: number; keep: Anchor } | null = null;
    let gesture: { w0: number; keep: Anchor } | null = null;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = Math.min(2, Math.max(0.5, Math.exp(-dy / 200)));
      zoomTo(currentWidth() * factor, e.clientX, e.clientY);
    };
    const centre = (t: TouchList) => {
      const [a, b] = [t[0], t[1]];
      if (!a || !b) return null;
      return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
        d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    };
    const onTouchStart = (e: TouchEvent) => {
      const c = e.touches.length === 2 ? centre(e.touches) : null;
      if (!c || c.d < 10) return;
      pinch = { d0: c.d, w0: currentWidth(), keep: nearestTile(vp, c.x, c.y) };
    };
    const onTouchMove = (e: TouchEvent) => {
      const c = pinch && e.touches.length === 2 ? centre(e.touches) : null;
      if (!pinch || !c) return;
      if (e.cancelable) e.preventDefault();
      zoomTo(pinch.w0 * (c.d / pinch.d0), c.x, c.y, pinch.keep);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    // Safari (macOS trackpad, and iOS alongside touch events).
    type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      if (!pinch) gesture = { w0: currentWidth(), keep: nearestTile(vp, g.clientX, g.clientY) };
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      if (gesture && !pinch) zoomTo(gesture.w0 * g.scale, g.clientX, g.clientY, gesture.keep);
    };
    const onGestureEnd = () => {
      gesture = null;
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("touchstart", onTouchStart, { passive: true });
    vp.addEventListener("touchmove", onTouchMove, { passive: false });
    vp.addEventListener("touchend", onTouchEnd);
    vp.addEventListener("touchcancel", onTouchEnd);
    vp.addEventListener("gesturestart", onGestureStart);
    vp.addEventListener("gesturechange", onGestureChange);
    vp.addEventListener("gestureend", onGestureEnd);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("touchstart", onTouchStart);
      vp.removeEventListener("touchmove", onTouchMove);
      vp.removeEventListener("touchend", onTouchEnd);
      vp.removeEventListener("touchcancel", onTouchEnd);
      vp.removeEventListener("gesturestart", onGestureStart);
      vp.removeEventListener("gesturechange", onGestureChange);
      vp.removeEventListener("gestureend", onGestureEnd);
    };
  }, [zoomTo, currentWidth]);

  // Double-tap / double-click on the background (tiles open the sheet instead): zoom in on that
  // region; at the largest size, back to fit.
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastPointer = useRef<string>("mouse");
  const backgroundZoom = (x: number, y: number) => {
    const max = clampTileWidth(Infinity, metrics);
    const w = currentWidth();
    if (w >= max - 0.5) zoomTo("fit", x, y);
    else zoomTo(Math.max(w * 2, full * 0.75), x, y);
  };
  const onPointerDown = (e: PointerEvent) => {
    lastPointer.current = e.pointerType;
    hover.table.onPointerDown(e);
  };
  const onPointerUp = (e: PointerEvent) => {
    hover.table.onPointerUp();
    if (e.pointerType !== "touch" || (e.target as Element).closest("button")) return;
    const now = performance.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap.current = null;
      backgroundZoom(e.clientX, e.clientY);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };
  const onDoubleClick = (e: MouseEvent) => {
    if (lastPointer.current === "touch" || (e.target as Element).closest("button")) return;
    backgroundZoom(e.clientX, e.clientY);
  };

  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element).closest<HTMLElement>("button[data-z]");
    const element = el && elements[Number(el.dataset.z) - 1];
    if (!element) return;
    hide();
    openElement(element.symbol);
  };

  const shownElement = hover.shown ? elements[hover.shown.z - 1] : undefined;
  const percent = Math.round((tileWidth / full) * 100);

  return (
    <figure className={styles.figure}>
      <div className={styles.zoomRow}>
        <ZoomHint />
        <div className={styles.zoomBar} role="toolbar" aria-label="Zoom">
          <button type="button" onClick={() => zoomTo(currentWidth() / ZOOM_STEP)} aria-label="Zoom out">
            −
          </button>
          <output className={styles.percent} aria-live="polite" title="Tile size, as a share of full size">
            {percent}%
          </output>
          <button type="button" onClick={() => zoomTo(currentWidth() * ZOOM_STEP)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomTo("fit")} aria-pressed={zoom.mode === "fit"}>
            Fit width
          </button>
          <button
            type="button"
            onClick={() => zoomTo(full)}
            aria-pressed={zoom.mode === "manual" && Math.abs(zoom.w - full) < 0.5}
          >
            Full-size tiles
          </button>
        </div>
      </div>
      {/* Pointer handlers here only add hover cards, long-press peeks and zoom gestures to the
          tile buttons inside; every one of those has a keyboard route (focus, Enter, the zoom bar). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        ref={viewport}
        className={styles.viewport}
        data-viewport=""
        onPointerOver={hover.table.onPointerOver}
        onPointerOut={hover.table.onPointerOut}
        onPointerDown={onPointerDown}
        onPointerMove={hover.table.onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={hover.table.onPointerUp}
        onClickCapture={hover.table.onClickCapture}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={hover.table.onContextMenu}
        onFocus={hover.table.onFocus}
        onBlur={hover.table.onBlur}
      >
        <div className={styles.content}>
          <PeriodicTable
            elements={elements}
            layout={layout}
            group3={group3}
            sources={sources}
            tileWidth={measured || zoom.mode === "manual" ? tileWidth : null}
            energyUnit={energyUnit}
            faces={faces}
            matches={matches}
            arrows={arrows}
            ghosts={ghosts}
            hintId={hintId}
          />
          {arrowTrend && (
            <TrendArrows
              trend={arrowTrend}
              variant={variant}
              elements={elements}
              deps={[tileWidth, layout.id, group3, overlay?.id]}
            />
          )}
          <div ref={ghosts} className={styles.ghosts} aria-hidden="true" />
        </div>
      </div>
      <p id={hintId} className="visually-hidden">
        Arrow keys move between elements in this layout; Enter opens an element.
      </p>
      <figcaption className={styles.caption}>
        <strong>{layout.title}.</strong> {layout.caption}
      </figcaption>
      {hover.shown && shownElement && (
        <HoverCard
          element={shownElement}
          anchor={hover.shown.el}
          via={hover.shown.via}
          note={faces?.get(shownElement.Z)?.note}
          sourceTitle={(id) => sources[id]?.title ?? id}
          {...hover.card}
        />
      )}
    </figure>
  );
}

/** A one-line tip until the visitor has zoomed once or dismissed it: bigger tiles show more. */
function ZoomHint() {
  const seen = useSettings((s) => s.zoomHintSeen);
  if (seen) return null;
  return (
    <p className={styles.hint} data-testid="zoom-hint">
      <span>
        <b>Tip:</b>{" "}
        <span className={styles.hintPointer}>
          zoom in to see more of every element — Ctrl/⌘ + scroll, double-click an empty spot, or the + button.
        </span>
        <span className={styles.hintTouch}>pinch or double-tap an empty spot to zoom in — bigger tiles show more.</span>
      </span>
      <button
        type="button"
        className={styles.hintClose}
        onClick={() => useSettings.getState().set("zoomHintSeen", true)}
      >
        <span aria-hidden="true">×</span>
        <span className="visually-hidden">Hide this tip</span>
      </button>
    </p>
  );
}

/** The tile nearest to a point, and where in that tile the point lies. */
function nearestTile(vp: HTMLElement, x: number, y: number): Anchor {
  let best: Anchor = { z: 1, fx: 0.5, fy: 0.5, clientX: x, clientY: y };
  let bestD = Infinity;
  for (const el of vp.querySelectorAll<HTMLElement>("[data-z]")) {
    const r = el.getBoundingClientRect();
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = {
        z: Number(el.dataset.z),
        fx: (x - r.left) / r.width,
        fy: (y - r.top) / r.height,
        clientX: x,
        clientY: y,
      };
      if (d === 0) break;
    }
  }
  return best;
}
