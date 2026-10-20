// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The layout morph (SPEC §7.2): a FLIP transform per tile — First (positions before the change),
// Last (after React has placed the tiles in the new layout), Invert, Play — 600 ms ease-in-out with
// an 8 ms stagger by Z, labels cross-fading. With reduced motion the change is instant.
//
// Every action that changes the layout calls captureMorph() first; the table calls playMorph()
// right after React commits the new positions, before the browser paints them.

const DURATION = 600;
const STAGGER = 8;
const EASING = "ease-in-out";

interface Snapshot {
  /** Height of the table's viewport, held while tiles fly so none is clipped. */
  height: number;
  tiles: Map<number, DOMRect>;
  labels: Array<{ node: HTMLElement; rect: DOMRect; text: string }>;
}

let pending: Snapshot | null = null;
let generation = 0;

const GRID = "[data-table-grid]";

/** Records where every tile and label is now (including any morph still in flight). */
export function captureMorph(): void {
  const grid = document.querySelector<HTMLElement>(GRID);
  if (!grid) return;
  const tiles = new Map<number, DOMRect>();
  for (const el of grid.querySelectorAll<HTMLElement>("[data-z]")) tiles.set(Number(el.dataset.z), el.getBoundingClientRect());
  const labels = [...grid.querySelectorAll<HTMLElement>("[data-label]")].map((node) => ({
    node: node.cloneNode(true) as HTMLElement,
    rect: node.getBoundingClientRect(),
    text: node.textContent ?? "",
  }));
  const viewport = grid.closest<HTMLElement>("[data-viewport]");
  pending = { height: viewport?.getBoundingClientRect().height ?? 0, tiles, labels };
}

export function discardMorph(): void {
  pending = null;
}

const same = (a: DOMRect, b: DOMRect) =>
  Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5;

/**
 * Animates from the captured snapshot to the current positions. `ghosts` is an absolutely
 * positioned layer over the table where the old labels fade out.
 */
export function playMorph(grid: HTMLElement, ghosts: HTMLElement | null, reduced: boolean): void {
  const snap = pending;
  pending = null;
  if (!snap) return;
  for (const a of grid.getAnimations({ subtree: true })) a.cancel();
  ghosts?.replaceChildren();
  if (reduced) return;

  const viewport = grid.closest<HTMLElement>("[data-viewport]");
  const running: Animation[] = [];
  for (const el of grid.querySelectorAll<HTMLElement>("[data-z]")) {
    const z = Number(el.dataset.z);
    const first = snap.tiles.get(z);
    if (!first) continue;
    const last = el.getBoundingClientRect();
    if (same(first, last) || last.width === 0) continue;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;
    running.push(
      el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: DURATION, easing: EASING, delay: (z - 1) * STAGGER, fill: "backwards" },
      ),
    );
  }
  if (viewport && running.length) {
    const mine = ++generation;
    viewport.style.minBlockSize = `${snap.height}px`;
    void Promise.allSettled(running.map((a) => a.finished)).then(() => {
      if (mine === generation) viewport.style.minBlockSize = "";
    });
  }

  // Labels: unchanged ones stay put; the rest cross-fade.
  const current = [...grid.querySelectorAll<HTMLElement>("[data-label]")];
  const kept = new Set<HTMLElement>();
  const leaving = snap.labels.filter((old) => {
    const match = current.find((n) => !kept.has(n) && n.textContent === old.text && same(n.getBoundingClientRect(), old.rect));
    if (match) kept.add(match);
    return !match;
  });
  for (const node of current) {
    if (!kept.has(node)) node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: EASING });
  }
  if (!ghosts) return;
  const origin = ghosts.getBoundingClientRect();
  for (const old of leaving) {
    const n = old.node;
    n.removeAttribute("data-label");
    Object.assign(n.style, {
      position: "absolute",
      left: `${old.rect.left - origin.left}px`,
      top: `${old.rect.top - origin.top}px`,
      width: `${old.rect.width}px`,
      height: `${old.rect.height}px`,
      gridColumn: "",
      gridRow: "",
      margin: "0",
      transform: "none",
    });
    ghosts.append(n);
    n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION, easing: EASING, fill: "forwards" }).finished.then(
      () => n.remove(),
      () => n.remove(),
    );
  }
}
