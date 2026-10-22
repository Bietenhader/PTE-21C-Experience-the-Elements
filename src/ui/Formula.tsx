// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// A formula typeset by KaTeX (LOCKED in SPEC §3), with MathML alongside the HTML so screen readers
// read it as mathematics. Only fixed formulas from the app's own code are rendered, never user input.

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

export function Formula({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, output: "htmlAndMathml", throwOnError: false }),
    [tex, display],
  );
  // KaTeX output for a formula written in this code base, never user input.
  return display ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}
