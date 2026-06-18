/**
 * Renderer-level UI state that lives alongside the report but is *not* part of
 * the core {@link PivotConfiguration}: column/row sizes, the frozen-column count
 * and the persisted vertical row height used by virtualization.
 *
 * It is intentionally a plain, JSON-serializable object so it can be saved to
 * `localStorage` / the URL hash next to the report (see {@link ./persistence}).
 */
export interface UIStateData {
  /** Per-column pixel widths, keyed by the renderer's stable column id. */
  columnWidths?: Record<string, number>;
  /** Per-row-header pixel heights, keyed by the renderer's stable row id. */
  rowHeights?: Record<string, number>;
  /** Number of leading columns kept pinned during horizontal scroll. */
  freezeColumns?: number;
  /** Uniform body row height (px) used when virtualization is active. */
  rowHeight?: number;
}

/**
 * Small mutable holder for {@link UIStateData}. The widget owns one instance and
 * hands it to the grid renderer through the {@link PivotContext}. Mutations are
 * in place; persistence reads {@link UIState.data} as a snapshot.
 */
export class UIState {
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  freezeColumns: number;
  rowHeight: number;

  constructor(initial: UIStateData = {}) {
    this.columnWidths = { ...(initial.columnWidths ?? {}) };
    this.rowHeights = { ...(initial.rowHeights ?? {}) };
    this.freezeColumns = Math.max(0, initial.freezeColumns ?? 0);
    this.rowHeight = initial.rowHeight ?? 0;
  }

  /** Serializable snapshot of the current UI state. */
  get data(): UIStateData {
    return {
      columnWidths: { ...this.columnWidths },
      rowHeights: { ...this.rowHeights },
      freezeColumns: this.freezeColumns,
      rowHeight: this.rowHeight || undefined,
    };
  }

  /** Replace the entire UI state (used by restore). */
  set(data: UIStateData): void {
    this.columnWidths = { ...(data.columnWidths ?? {}) };
    this.rowHeights = { ...(data.rowHeights ?? {}) };
    this.freezeColumns = Math.max(0, data.freezeColumns ?? 0);
    this.rowHeight = data.rowHeight ?? 0;
  }

  /** Forget all stored sizes (keeps the freeze count). */
  clearSizes(): void {
    this.columnWidths = {};
    this.rowHeights = {};
  }
}
