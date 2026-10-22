// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// A box whose content may be wider than the screen (a table on a phone). While it overflows it is a
// labelled region that takes keyboard focus, so it can be scrolled with the arrow keys (WCAG 2.1.1);
// otherwise it is a plain box and adds nothing to the tab order.

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

export function SideScroll({
  label,
  className,
  children,
  id,
}: {
  label: string;
  className?: string | undefined;
  children: ReactNode;
  id?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The content changes size without the box doing so (a table shown or hidden inside it).
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      id={id}
      className={className}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll region must be reachable by keyboard (WCAG 2.1.1)
      tabIndex={overflows ? 0 : undefined}
      role={overflows ? "region" : undefined}
      aria-label={overflows ? `${label}, scrolls sideways` : undefined}
    >
      {children}
    </div>
  );
}
