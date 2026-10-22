// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Loaders for public/data. Same-origin only (SPEC §2.7): every URL is relative to the app's base.
// main.tsx waits for the core — index.json, sources.json and the active layout, all preloaded from
// index.html — before the first render, so the first thing React draws is the full table (and it
// replaces the prerendered copy in one step). The other layouts and trends.json follow in the
// background, so a later layout switch does not wait on the network.

import { useEffect, useState } from "react";
import { LAYOUT_IDS, type LayoutId } from "../app/route";
import type {
  ColourMatchingFile,
  CoverageFile,
  ElementDetailFile,
  IndexFile,
  IsotopesFile,
  LayoutFile,
  LevelsFile,
  MetrologyFile,
  SourcesFile,
  SpectraFile,
  TrendsFile,
} from "./types";

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

// --- Files loaded on demand (SPEC §12): an element's detail file when its sheet opens, the
// coverage table when the About page opens. Each is fetched once and kept for the session.

export type Loaded<T> = { state: "loading" } | { state: "ready"; value: T } | { state: "failed"; message: string };

const cache = new Map<string, Promise<unknown>>();

function cachedJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = getJson<T>(path);
    cache.set(path, p);
    p.catch(() => cache.delete(path)); // a failed request may be retried by the next open
  }
  return p as Promise<T>;
}

/** The file at `path` (relative to public/data), or null for nothing to load. */
export function useJson<T>(path: string | null): Loaded<T> {
  const [result, setResult] = useState<{ path: string | null; loaded: Loaded<T> }>({ path, loaded: { state: "loading" } });
  useEffect(() => {
    if (!path) return;
    let live = true;
    cachedJson<T>(path).then(
      (value) => live && setResult({ path, loaded: { state: "ready", value } }),
      (err: unknown) => live && setResult({ path, loaded: { state: "failed", message: err instanceof Error ? err.message : String(err) } }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return result.path === path ? result.loaded : { state: "loading" };
}

export const useElementDetail = (z: number | null) => useJson<ElementDetailFile>(z === null ? null : `elements/${z}.json`);
export const useCoverage = (open: boolean) => useJson<CoverageFile>(open ? "coverage.json" : null);

/** A per-element companion file, requested only when the element's detail file says it exists. */
export const useIsotopes = (z: number, exists: boolean) => useJson<IsotopesFile>(exists ? `isotopes/${z}.json` : null);
export const useSpectra = (z: number, exists: boolean) => useJson<SpectraFile>(exists ? `spectra/${z}.json` : null);
export const useLevels = (z: number, exists: boolean) => useJson<LevelsFile>(exists ? `levels/${z}.json` : null);
export const useMetrology = () => useJson<MetrologyFile>("metrology.json");
export const useColourTable = () => useJson<ColourMatchingFile>("cie1931.json");
export const useTrends = () => useJson<TrendsFile>("trends.json");

