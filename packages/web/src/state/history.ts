import type { PivotConfiguration } from '@pvotly/core';
import type { UIStateData } from './uiState';

/** A single point-in-time state captured on the undo/redo stack. */
export interface HistoryEntry {
  report: PivotConfiguration;
  ui?: UIStateData;
}

export interface HistoryOptions {
  /** Maximum number of retained states (default 50). Oldest are dropped. */
  limit?: number;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * A linear undo/redo stack of {@link HistoryEntry} snapshots. Entries are deep
 * cloned on the way in and out so callers can mutate freely without corrupting
 * history. Pushing a new state after an undo discards the redo branch.
 */
export class UndoRedoStack {
  private stack: HistoryEntry[] = [];
  private index = -1;
  private readonly limit: number;

  constructor(options: HistoryOptions = {}) {
    this.limit = Math.max(1, options.limit ?? 50);
  }

  /** Discard all history and seed it with a single baseline state. */
  reset(entry: HistoryEntry): void {
    this.stack = [deepClone(entry)];
    this.index = 0;
  }

  /** Record a new state, dropping any redo branch and trimming to the limit. */
  push(entry: HistoryEntry): void {
    // Collapse no-op pushes (identical to the current state).
    if (this.index >= 0 && sameEntry(this.stack[this.index]!, entry)) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(deepClone(entry));
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** Step back one state and return it (or `null` if at the beginning). */
  undo(): HistoryEntry | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return deepClone(this.stack[this.index]!);
  }

  /** Step forward one state and return it (or `null` if at the end). */
  redo(): HistoryEntry | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    return deepClone(this.stack[this.index]!);
  }

  /** The current state, or `null` when empty. */
  current(): HistoryEntry | null {
    return this.index >= 0 ? deepClone(this.stack[this.index]!) : null;
  }

  /** Number of states retained. */
  get size(): number {
    return this.stack.length;
  }
}

function sameEntry(a: HistoryEntry, b: HistoryEntry): boolean {
  return JSON.stringify(a.report) === JSON.stringify(b.report) && JSON.stringify(a.ui) === JSON.stringify(b.ui);
}
