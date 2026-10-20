// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Loaders for public/data. Same-origin only (SPEC §2.7): every URL is relative to the app's base.
// main.tsx waits for the core — index.json, sources.json and the active layout, all preloaded from
// index.html — before the first render, so the first thing React draws is the full table (and it
// replaces the prerendered copy in one step). The other layouts and trends.json follow in the
// background, so a later layout switch does not wait on the network.

import { useEffect, useState } from "react";
import { LAYOUT_IDS, type LayoutId } from "../app/route";
import type { IndexFile, LayoutFile, SourcesFile, TrendsFile } from "./types";

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(dataUrl(path), signal ? { signal } : {});
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface Dataset {
  index: IndexFile;
  sources: SourcesFile;
  /** Filled in as they arrive; the first one is always present. */
  layouts: Partial<Record<LayoutId, LayoutFile>>;
  /** null until trends.json has arrived. */
  trends: TrendsFile | null;
}

export async function loadCore(first: LayoutId): Promise<Dataset> {
  const [index, sources, layout] = await Promise.all([
    getJson<IndexFile>("index.json"),
    getJson<SourcesFile>("sources.json"),
    getJson<LayoutFile>(`layouts/${first}.json`),
  ]);
  return { index, sources, layouts: { [layout.id]: layout }, trends: null };
}

/** The dataset, completed in the background. `problem` names a file that failed to arrive. */
export function useDataset(initial: Dataset): { data: Dataset; problem: string | null } {
  const [data, setData] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!initial.index.elements.length) return; // nothing loaded: main.tsx reported the error
    const ctrl = new AbortController();
    const fail = (err: unknown) => {
      if (!ctrl.signal.aborted) setProblem(err instanceof Error ? err.message : String(err));
    };
    for (const id of LAYOUT_IDS.filter((l) => !initial.layouts[l])) {
      getJson<LayoutFile>(`layouts/${id}.json`, ctrl.signal)
        .then((l) => setData((d) => ({ ...d, layouts: { ...d.layouts, [l.id]: l } })))
        .catch(fail);
    }
    if (!initial.trends) {
      getJson<TrendsFile>("trends.json", ctrl.signal)
        .then((trends) => setData((d) => ({ ...d, trends })))
        .catch(fail);
    }
    return () => ctrl.abort();
  }, [initial]);
  return { data, problem };
}
