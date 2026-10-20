// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Loaders for public/data. Same-origin only (SPEC §2.7): every URL is relative to the app's base.
// index.json and standard18 are preloaded from index.html; the other layouts and trends.json are
// small and arrive in parallel, so switching layout never waits on the network.

import { useEffect, useState } from "react";
import { LAYOUT_IDS, type LayoutId } from "../app/route";
import type { IndexFile, LayoutFile, SourcesFile, TrendsFile } from "./types";

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`;
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(dataUrl(path), { signal });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface Dataset {
  index: IndexFile;
  sources: SourcesFile;
  layouts: Record<LayoutId, LayoutFile>;
  trends: TrendsFile;
}

export type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Dataset };

export function useDataset(): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      getJson<IndexFile>("index.json", ctrl.signal),
      getJson<SourcesFile>("sources.json", ctrl.signal),
      Promise.all(LAYOUT_IDS.map((id) => getJson<LayoutFile>(`layouts/${id}.json`, ctrl.signal))),
      getJson<TrendsFile>("trends.json", ctrl.signal),
    ])
      .then(([index, sources, layoutList, trends]) => {
        const layouts = Object.fromEntries(layoutList.map((l) => [l.id, l])) as Record<LayoutId, LayoutFile>;
        setState({ status: "ready", data: { index, sources, layouts, trends } });
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => ctrl.abort();
  }, []);
  return state;
}
