// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Web Worker for the orbital gallery: computes one orbital per message and hands the arrays back
// without copying (transferables).

import { computeOrbital, type OrbitalRequest } from "./field";

self.onmessage = (event: MessageEvent<{ id: number; req: OrbitalRequest }>) => {
  const { id, req } = event.data;
  try {
    const result = computeOrbital(req);
    const buffers = [
      result.positions,
      result.normals,
      result.indices,
      result.colors,
      result.nodal?.positions,
      result.nodal?.normals,
      result.nodal?.indices,
      result.sliceImage,
    ];
    const transfer = buffers.filter((b) => b !== undefined).map((b) => b.buffer as ArrayBuffer);
    (self as unknown as Worker).postMessage({ id, result }, transfer as Transferable[]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
