/**
 * @pvotly/web — framework-agnostic pivot table UI built on @pvotly/core.
 *
 * @example
 * ```ts
 * import { PivotTable } from '@pvotly/web';
 * import '@pvotly/web/styles.css';
 *
 * new PivotTable('#app', {
 *   dataSource: { data },
 *   slice: {
 *     rows: [{ uniqueName: 'Country' }],
 *     columns: [{ uniqueName: 'Category' }],
 *     measures: [{ uniqueName: 'Revenue', aggregation: 'sum' }],
 *   },
 * });
 * ```
 */
import './styles/pvotly.css';
import './styles/themes.css';

export { PivotTable } from './PivotTable';
export type { PivotTableOptions, ValuesAxis } from './PivotTable';
export type { PivotContext } from './context';
export { applyTheme, applyTokens, setThemeTokens } from './theme';
export type { ThemeName, ThemeTokens } from './theme';

// Localization
export { resolveStrings, resolveDirection, DEFAULT_STRINGS } from './i18n';
export type { UIStrings, Direction } from './i18n';

// Renderer + UI state
export { renderGrid, copyGridSelection } from './render/grid';
export { buildGridModel } from './render/model';
export type { GridModel, ValueColumn, BodyRow } from './render/model';
export { buildTSV, writeClipboard } from './render/selection';
export type { CellRange, CellCoord } from './render/selection';
export { UIState } from './state/uiState';
export type { UIStateData } from './state/uiState';
export { UndoRedoStack } from './state/history';
export type { HistoryEntry } from './state/history';
export {
  createSnapshot,
  serializeSnapshot,
  parseSnapshot,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  saveToUrlHash,
  loadFromUrlHash,
  encodeSnapshotToHash,
} from './state/persistence';
export type { PivotSnapshot, SerializeOptions } from './state/persistence';

export { mountFieldList } from './fieldlist/fieldList';
export { mountToolbar } from './toolbar/toolbar';
export type {
  ActionBarConfig,
  ActionBarButtonConfig,
  ActionBarItem,
  ActionBarAction,
} from './toolbar/toolbar';
export { openFilterDialog } from './dialogs/filterDialog';
export { openFormatDialog } from './dialogs/formatDialog';
export { openConditionalDialog } from './dialogs/conditionalDialog';
export { openFieldsDialog } from './dialogs/fieldsDialog';

export {
  exportToCSV,
  exportToHTML,
  exportToJSON,
  exportToExcel,
  serializeExport,
  downloadExport,
  printGrid,
  gridToMatrix,
} from './export';
export type { ExportFormat, ExportOptions } from './export';

// Re-export the engine so consumers can use one import for everything.
export * from '@pvotly/core';
