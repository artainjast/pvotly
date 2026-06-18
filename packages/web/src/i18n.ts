import type { Localization } from '@pvotly/core';

/**
 * All user-facing UI strings used by the toolbar, field list and the four
 * dialogs (fields / filter / format / conditional). Every key maps to a single
 * visible label so the whole widget can be localized via the report's
 * `localization` object (see {@link resolveStrings}).
 *
 * The {@link DEFAULT_STRINGS} values are the canonical English UI text. They are
 * deliberately byte-identical to the literals previously hardcoded in the view
 * modules so existing tests/e2e assertions on exact text keep passing.
 */
export interface UIStrings {
  /* ---- toolbar ---- */
  fields: string;
  format: string;
  formatTitle: string;
  conditional: string;
  conditionalTitle: string;
  fullscreen: string;
  layout: string;
  compact: string;
  classic: string;
  flat: string;
  export: string;
  toCSV: string;
  toExcel: string;
  toHTML: string;
  toJSON: string;
  printPdf: string;

  /* ---- field list / fields dialog: zones ---- */
  reportFilters: string;
  columns: string;
  rows: string;
  values: string;

  /* ---- fields dialog ---- */
  fieldsTitle: string;
  allFields: string;
  expandAll: string;
  collapseAll: string;
  search: string;
  searchFields: string;
  dropFieldHere: string;
  dragAndDrop: string;
  noMatchingFields: string;
  expand: string;
  collapse: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  measure: string;

  /* ---- field list ---- */
  dragToArea: string;
  sort: string;
  filter: string;
  aggregation: string;

  /* ---- filter dialog ---- */
  filterTitle: string;
  members: string;
  value: string;
  searchMembers: string;
  selectAll: string;
  clear: string;
  keepMembersByValue: string;
  by: string;
  apply: string;
  clearFilter: string;
  cancel: string;

  /* ---- format dialog ---- */
  formatTitle2: string;
  applyTo: string;
  defaultAll: string;
  decimalPlaces: string;
  thousandsSeparator: string;
  decimalSeparator: string;
  currencySymbol: string;
  currencyPosition: string;
  left: string;
  right: string;
  negatives: string;
  negativeMinus: string;
  negativeParentheses: string;
  negativeRedMinus: string;
  showAsPercent: string;
  blankNullText: string;

  /* ---- conditional dialog ---- */
  conditionalDialogTitle: string;
  noRulesYet: string;
  allMeasures: string;
  valuePlaceholder: string;
  toPlaceholder: string;
  addRule: string;
  fill: string;
  text: string;
  opGreaterThan: string;
  opGreaterOrEqual: string;
  opLessThan: string;
  opLessOrEqual: string;
  opEquals: string;
  opNotEquals: string;
  opBetween: string;
  opContains: string;

  /* ---- grid interactions ---- */
  noData: string;
  sortAscending: string;
  sortDescending: string;
  removeSort: string;
  resizeColumn: string;
  freezeColumns: string;
  copy: string;

  /* ---- values axis toggle ---- */
  valuesAxis: string;
  valuesAsColumns: string;
  valuesAsRows: string;

  /* ---- undo / redo / state ---- */
  undo: string;
  redo: string;
}

/**
 * Canonical English strings. CRITICAL: keep these byte-identical to the
 * historical hardcoded literals — tests assert exact text and labels.
 */
export const DEFAULT_STRINGS: UIStrings = {
  /* toolbar */
  fields: 'Fields',
  format: 'Format',
  formatTitle: 'Format cells',
  conditional: 'Conditional',
  conditionalTitle: 'Conditional formatting',
  fullscreen: 'Fullscreen',
  layout: 'Layout',
  compact: 'Compact',
  classic: 'Classic',
  flat: 'Flat',
  export: 'Export',
  toCSV: 'To CSV',
  toExcel: 'To Excel',
  toHTML: 'To HTML',
  toJSON: 'To JSON',
  printPdf: 'Print / PDF',

  /* zones */
  reportFilters: 'Report Filters',
  columns: 'Columns',
  rows: 'Rows',
  values: 'Values',

  /* fields dialog */
  fieldsTitle: 'Fields',
  allFields: 'All Fields',
  expandAll: 'Expand All',
  collapseAll: 'Collapse All',
  search: 'Search',
  searchFields: 'Search fields',
  dropFieldHere: 'Drop field here',
  dragAndDrop: 'Drag and drop fields to arrange',
  noMatchingFields: 'No matching fields',
  expand: 'Expand',
  collapse: 'Collapse',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  measure: 'Measure',

  /* field list */
  dragToArea: 'Drag to an area, or double-click to add',
  sort: 'Sort',
  filter: 'Filter',
  aggregation: 'Aggregation',

  /* filter dialog */
  filterTitle: 'Filter',
  members: 'Members',
  value: 'Value',
  searchMembers: 'Search members…',
  selectAll: 'Select all',
  clear: 'Clear',
  keepMembersByValue: 'Keep members by measure value:',
  by: 'by',
  apply: 'Apply',
  clearFilter: 'Clear filter',
  cancel: 'Cancel',

  /* format dialog */
  formatTitle2: 'Format cells',
  applyTo: 'Apply to',
  defaultAll: 'Default (all)',
  decimalPlaces: 'Decimal places',
  thousandsSeparator: 'Thousands separator',
  decimalSeparator: 'Decimal separator',
  currencySymbol: 'Currency symbol',
  currencyPosition: 'Currency position',
  left: 'Left',
  right: 'Right',
  negatives: 'Negatives',
  negativeMinus: '-1,234',
  negativeParentheses: '(1,234)',
  negativeRedMinus: 'Red -1,234',
  showAsPercent: 'Show as percent',
  blankNullText: 'Blank / null text',

  /* conditional dialog */
  conditionalDialogTitle: 'Conditional formatting',
  noRulesYet: 'No rules yet.',
  allMeasures: 'All measures',
  valuePlaceholder: 'value',
  toPlaceholder: 'to',
  addRule: '+ Add rule',
  fill: 'Fill',
  text: 'Text',
  opGreaterThan: 'greater than',
  opGreaterOrEqual: 'greater or equal',
  opLessThan: 'less than',
  opLessOrEqual: 'less or equal',
  opEquals: 'equals',
  opNotEquals: 'not equals',
  opBetween: 'between',
  opContains: 'contains',

  /* grid interactions */
  noData: 'No data to display',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  removeSort: 'Remove sort',
  resizeColumn: 'Drag to resize',
  freezeColumns: 'Freeze columns',
  copy: 'Copy',

  /* values axis toggle */
  valuesAxis: 'Values',
  valuesAsColumns: 'Values on columns',
  valuesAsRows: 'Values on rows',

  /* undo / redo / state */
  undo: 'Undo',
  redo: 'Redo',
};

/**
 * Merge {@link DEFAULT_STRINGS} with the report's `localization` object. Any
 * `UIStrings` key present on `localization` overrides the default; a handful of
 * well-known {@link Localization} fields are also mapped onto matching UI keys.
 *
 * When `localization` is undefined (the default), this returns the canonical
 * English strings so existing behavior is preserved.
 */
export function resolveStrings(localization?: Localization | undefined): UIStrings {
  const merged: UIStrings = { ...DEFAULT_STRINGS };
  if (!localization) return merged;

  // Allow overriding any UIString directly via a matching localization key.
  for (const key of Object.keys(DEFAULT_STRINGS) as Array<keyof UIStrings>) {
    const v = localization[key as string];
    if (typeof v === 'string') merged[key] = v;
  }

  return merged;
}

/** Layout direction. */
export type Direction = 'ltr' | 'rtl';

/**
 * Resolve the desired layout direction from the report's `localization` object.
 * Honors either `localization.direction: 'rtl'` or a boolean `localization.rtl`.
 * Defaults to `'ltr'`.
 */
export function resolveDirection(localization?: Localization | undefined): Direction {
  if (!localization) return 'ltr';
  const dir = localization.direction;
  if (dir === 'rtl' || dir === 'ltr') return dir;
  if (localization.rtl === true) return 'rtl';
  return 'ltr';
}
