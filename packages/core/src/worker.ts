/**
 * @pvotly/core — Web Worker entry for off-main-thread grid building.
 *
 * Ship this as a separate build output (e.g. `dist/worker.js`) and point
 * {@link import('./types').WorkerConfig} at it (via `url` or a bundler-aware
 * `factory`). The {@link import('./engine/PivotEngine').PivotEngine} posts a
 * {@link WorkerRequestMessage} and receives a {@link WorkerResponseMessage}
 * carrying the serialized grid, which it re-hydrates with `deserializeGrid`.
 *
 * The worker is intentionally tiny: it ingests the data source and runs the
 * same `buildGrid` used on the main thread, so behavior is identical.
 */

import { Dataset } from './data/dataset';
import { buildGrid } from './engine/build';
import { serializeGrid } from './engine/serialize';
import type { WorkerRequestMessage, WorkerResponseMessage } from './engine/workerProtocol';

// In a worker, `self` is the DedicatedWorkerGlobalScope. Typed loosely so this
// compiles under the DOM lib without a worker-specific lib.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequestMessage>) => void) | null;
  postMessage: (message: WorkerResponseMessage) => void;
};

ctx.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const { id, config } = event.data;
  try {
    const dataset = new Dataset(config.dataSource);
    const grid = serializeGrid(buildGrid(dataset, config));
    ctx.postMessage({ id, grid });
  } catch (error) {
    ctx.postMessage({ id, error: (error as Error)?.message ?? String(error) });
  }
};
