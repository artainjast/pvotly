/**
 * @pvotly/react — declarative React bindings for pvotly.
 *
 * Remember to import the stylesheet once in your app:
 * ```ts
 * import '@pvotly/web/styles.css';
 * ```
 */
export { PivotTable } from './PivotTable';
export type { PivotTableProps, PivotTableHandle } from './PivotTable';
export { usePivotEngine } from './usePivotEngine';

// Re-export engine + web types for convenience.
export * from '@pvotly/core';
