// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The hover card (SPEC §9.1): Floating UI, anchored to the tile; 150 ms hover intent, shown on
// keyboard focus, a long-press "peek" on touch screens. It meets WCAG 1.4.13: Esc dismisses it,
// the pointer can move onto it, and it stays until the pointer or focus leaves.
//
// The card repeats what the tile's accessible name and description already say, so it is hidden
// from screen readers to avoid reading everything twice.

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import {
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ElementIndexEntry } from "../data/types";
import { ElementImages } from "../ui/ElementImages";
import styles from "./HoverCard.module.css";
import { CATEGORY_NAME } from "./tileText";

const INTENT_MS = 150;
const HIDE_MS = 120;
const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE = 10;

export type Via = "pointer" | "focus" | "peek";
interface Shown {
  z: number;
  el: HTMLElement;
  via: Via;
}

const tileOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("button[data-z]") : null);

/** Event handlers for the table and the card, plus what to show. */
export function useHoverCard(disabled: boolean) {
  const [shown, setShown] = useState<Shown | null>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const press = useRef<{ z: number; x: number; y: number; timer: number } | null>(null);
  const peeked = useRef<number | null>(null);
  const dismissed = useRef<number | null>(null);

  const clear = (t: { current: number | undefined }) => {
    window.clearTimeout(t.current);
    t.current = undefined;
  };
  const hide = useCallback(() => {
    clear(showTimer);
    clear(hideTimer);
    setShown(null);
  }, []);
  const scheduleHide = useCallback(() => {
    clear(hideTimer);
    hideTimer.current = window.setTimeout(() => setShown(null), HIDE_MS);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dismissed.current = shown.z;
      hide();
    };
    const onDown = (e: Event) => {
      if (shown.via === "peek" && !(e.target instanceof Element && e.target.closest("[data-hovercard]"))) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [shown, hide]);

  useEffect(
    () => () => {
      clear(showTimer);
      clear(hideTimer);
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  const table = {
    onPointerOver(e: PointerEvent) {
      if (disabled || e.pointerType === "touch") return;
      const el = tileOf(e.target);
      if (!el) return;
      clear(hideTimer);
      const z = Number(el.dataset.z);
      if (shown?.z === z || dismissed.current === z) return;
      clear(showTimer);
      showTimer.current = window.setTimeout(() => setShown({ z, el, via: "pointer" }), INTENT_MS);
    },
    onPointerOut(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const el = tileOf(e.target);
      if (!el || el.contains(e.relatedTarget as Node | null)) return;
      if (dismissed.current === Number(el.dataset.z)) dismissed.current = null;
      clear(showTimer);
      if (shown?.via === "pointer") scheduleHide();
    },
    onFocus(e: FocusEvent) {
      const el = tileOf(e.target);
      if (disabled || !el || !el.matches(":focus-visible")) return;
      clear(showTimer);
      clear(hideTimer);
      dismissed.current = null;
      setShown({ z: Number(el.dataset.z), el, via: "focus" });
    },
    onBlur(e: FocusEvent) {
      if (shown?.via === "focus" && !tileOf(e.relatedTarget)) hide();
    },
    onPointerDown(e: PointerEvent) {
      if (disabled || e.pointerType !== "touch") return;
      const el = tileOf(e.target);
      if (!el) return;
      const z = Number(el.dataset.z);
      const timer = window.setTimeout(() => {
        peeked.current = z;
        setShown({ z, el, via: "peek" });
      }, LONG_PRESS_MS);
      press.current = { z, x: e.clientX, y: e.clientY, timer };
    },
    onPointerMove(e: PointerEvent) {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) {
        window.clearTimeout(p.timer);
        press.current = null;
      }
    },
    onPointerUp() {
      if (press.current) window.clearTimeout(press.current.timer);
      press.current = null;
    },
    /** Swallows the click that ends a long-press, so a peek does not also open the sheet. */
    onClickCapture(e: MouseEvent) {
      const el = tileOf(e.target);
      if (el && peeked.current === Number(el.dataset.z)) {
        e.preventDefault();
        e.stopPropagation();
      }
      peeked.current = null;
    },
    onContextMenu(e: MouseEvent) {
      if (tileOf(e.target) && (press.current || peeked.current !== null)) e.preventDefault();
    },
  };

  const card = {
    onPointerEnter: () => clear(hideTimer),
    onPointerLeave: () => {
      if (shown?.via === "pointer") scheduleHide();
    },
  };

  return { shown: disabled ? null : shown, table, card, hide };
}

interface CardProps {
  element: ElementIndexEntry;
  anchor: HTMLElement;
  via: Via;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function HoverCard({ element: e, anchor, via, onPointerEnter, onPointerLeave }: CardProps) {
  const { refs, floatingStyles, isPositioned } = useFloating<HTMLElement>({
    strategy: "fixed",
    placement: "right-start",
    middleware: [offset(8), flip({ fallbackPlacements: ["left-start", "bottom", "top"] }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { setReference, setFloating } = refs;
  useLayoutEffect(() => {
    setReference(anchor);
  }, [anchor, setReference]);

  const action = via === "focus" ? "Press Enter to pin" : via === "peek" ? "Tap the tile to pin" : "Click to pin";
  return createPortal(
    <div
      ref={setFloating}
      className={styles.card}
      style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
      data-hovercard=""
      data-category={e.category}
      data-testid="hovercard"
      aria-hidden="true"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <ElementImages element={e} size="thumb" max={3} />
      <div className={styles.head}>
        <span className={styles.symbol}>{e.symbol}</span>
        <div>
          <p className={styles.name}>{e.name}</p>
          <p className={styles.meta}>
            Z = {e.Z} · {CATEGORY_NAME[e.category]} · {e.standardState === "unknown" ? "state unknown" : e.standardState}
          </p>
        </div>
      </div>
      <p className={styles.fact}>{e.quantumFact}</p>
      <p className={styles.footer}>{action} · Esc to dismiss</p>
    </div>,
    document.body,
  );
}
