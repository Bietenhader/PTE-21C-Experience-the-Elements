// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Which sources a panel used: every `source` key (and every `sources` list) in the data it drew.

export function collectSources(...values: unknown[]): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.source === "string") out.add(o.source);
      if (Array.isArray(o.sources)) for (const s of o.sources) if (typeof s === "string") out.add(s);
      for (const x of Object.values(o)) walk(x);
    }
  };
  for (const v of values) walk(v);
  return [...out].sort();
}
