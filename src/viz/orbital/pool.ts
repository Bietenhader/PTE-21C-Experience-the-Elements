// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// A small pool of orbital workers (one per core, at most four), with a cache so the gallery and the
// viewer never compute the same orbital twice. Without Worker support it computes on the main thread.

import { computeOrbital, type OrbitalRequest, type OrbitalResult, orbitalKey } from "./field";

type Job = { id: number; req: OrbitalRequest; resolve: (r: OrbitalResult) => void; reject: (e: Error) => void };

const cache = new Map<string, Promise<OrbitalResult>>();
let workers: Worker[] | null = null;
const idle: Worker[] = [];
const queue: Job[] = [];
const running = new Map<number, Job>();
let nextId = 1;

function spawn(): Worker[] {
  const count = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const list: Worker[] = [];
  for (let i = 0; i < count; i++) {
    const w = new Worker(new URL("./orbital.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ id: number; result?: OrbitalResult; error?: string }>) => {
      const job = running.get(e.data.id);
      running.delete(e.data.id);
      if (job) {
        if (e.data.result) job.resolve(e.data.result);
        else job.reject(new Error(e.data.error ?? "orbital worker failed"));
      }
      idle.push(w);
      pump();
    };
    list.push(w);
    idle.push(w);
  }
  return list;
}

function pump(): void {
  while (idle.length && queue.length) {
    const w = idle.pop();
    const job = queue.shift();
    if (!w || !job) return;
    running.set(job.id, job);
    w.postMessage({ id: job.id, req: job.req });
  }
}

/**
 * The orbital for this request, computed once per session. Gallery requests go first in, first out;
 * `first` puts a request at the head of the queue (the orbital someone just chose to look at).
 */
export function requestOrbital(req: OrbitalRequest, first = false): Promise<OrbitalResult> {
  const key = `${orbitalKey(req)},${req.nodal ? "n" : ""},${req.slice ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let p: Promise<OrbitalResult>;
  if (typeof Worker === "undefined") {
    p = new Promise((resolve) => setTimeout(() => resolve(computeOrbital(req)), 0));
  } else {
    workers ??= spawn();
    p = new Promise((resolve, reject) => {
      const job = { id: nextId++, req, resolve, reject };
      if (first) queue.unshift(job);
      else queue.push(job);
      pump();
    });
  }
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/** Grid size by device (SPEC §11.1): 96³ on desktop, 64³ on phones. */
export function gridSize(): number {
  const phone = typeof matchMedia === "function" && matchMedia("(max-width: 40rem), (pointer: coarse)").matches;
  return phone ? 64 : 96;
}
