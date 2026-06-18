/**
 * A tiny global registry so adapters can be referenced by name (e.g. passing
 * `'svg'` to {@link import('./PivotChart').PivotChart}). Registering is entirely
 * optional — you can always pass an adapter object directly.
 */
import type { ChartAdapter } from './types';
import { builtinSvgAdapter } from './adapters/svg';

const registry = new Map<string, ChartAdapter<unknown>>();

/** Register (or replace) an adapter under `name`. */
export function registerAdapter(name: string, adapter: ChartAdapter<unknown>): void {
  registry.set(name, adapter);
}

/** Look up a previously-registered adapter by name. */
export function getAdapter(name: string): ChartAdapter<unknown> | undefined {
  return registry.get(name);
}

/** List the names of all registered adapters. */
export function listAdapters(): string[] {
  return [...registry.keys()];
}

// The built-in SVG adapter is always available as `'svg'`.
registerAdapter('svg', builtinSvgAdapter as ChartAdapter<unknown>);
