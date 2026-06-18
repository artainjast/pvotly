/**
 * Message contract between the main thread and the aggregation Web Worker.
 * Kept in its own module (no side effects) so both the engine and the worker
 * entry can import it without the engine pulling in the worker's `self` hooks.
 */

import type { PivotConfiguration } from '../types';
import type { SerializedGrid } from './serialize';

/** Main thread -> worker: "build the grid for this config". */
export interface WorkerRequestMessage {
  id: number;
  config: PivotConfiguration;
}

/** Worker -> main thread: the serialized grid, or an error message. */
export interface WorkerResponseMessage {
  id: number;
  grid?: SerializedGrid;
  error?: string;
}
