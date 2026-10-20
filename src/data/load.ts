// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Loaders for public/data. Same-origin only (SPEC §2.7): every URL is relative to the app's base.

import { useEffect, useState } from "react";
import type { IndexFile, LayoutFile, SourcesFile } from "./types";

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
  layout: LayoutFile;
}

export type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Dataset };

export function useDataset(layoutId: LayoutFile["id"]): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      getJson<IndexFile>("index.json", ctrl.signal),
      getJson<SourcesFile>("sources.json", ctrl.signal),
      getJson<LayoutFile>(`layouts/${layoutId}.json`, ctrl.signal),
    ])
      .then(([index, sources, layout]) => setState({ status: "ready", data: { index, sources, layout } }))
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => ctrl.abort();
  }, [layoutId]);
  return state;
}
