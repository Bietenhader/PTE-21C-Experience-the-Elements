// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Single-key shortcuts (SPEC §9.5): "/" focuses search, L cycles layouts (Shift+L backwards),
// T opens the trend menu. They never fire while typing, with a modifier held, or while a dialog
// is open, and Settings can turn them off (WCAG 2.1.4 Character Key Shortcuts).

import { useEffect } from "react";
import { cycleLayout } from "./actions";
import { useSettings } from "./store";

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !["button", "checkbox", "radio", "range", "reset", "submit"].includes(target.type);
  return false;
}

export function useShortcuts(handlers: { focusSearch: () => void; openTrends: () => void }): void {
  const enabled = useSettings((s) => s.shortcuts);
  const { focusSearch, openTrends } = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        cycleLayout(e.shiftKey ? -1 : 1);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        openTrends();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, focusSearch, openTrends]);
}
