import type { PivotEngine } from '@pvotly/core';
import type { PivotTable } from './PivotTable';
import type { UIState } from './state/uiState';

/**
 * Shared context handed to every view module (toolbar, field list, dialogs).
 * It is the stable internal contract the UI pieces program against.
 */
export interface PivotContext {
  readonly engine: PivotEngine;
  readonly table: PivotTable;
  /** Renderer-level UI state (column sizes, freeze count). */
  readonly ui: UIState;
  /** Request a full grid + field-list re-render from current engine state. */
  refresh(): void;
  /** Mount a transient modal element over the table. */
  openDialog(content: HTMLElement, title?: string, opts?: { width?: string }): void;
  /** Close any open modal. */
  closeDialog(): void;
}
