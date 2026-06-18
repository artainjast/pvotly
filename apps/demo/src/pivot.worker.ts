/**
 * Demo Web Worker that builds a pvotly grid off the main thread. It speaks the
 * same message protocol the PivotEngine expects (WorkerRequestMessage in,
 * WorkerResponseMessage out) and reuses the public @pvotly/core builders, so it
 * behaves identically to an on-thread build.
 */
import { Dataset, buildGrid, serializeGrid } from '@pvotly/core';
import type { WorkerRequestMessage, WorkerResponseMessage } from '@pvotly/core';

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
