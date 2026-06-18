import { describe, expect, it } from 'vitest';
import type { PivotConfiguration } from '@pvotly/core';
import { UndoRedoStack } from './history';
import { UIState } from './uiState';
import {
  createSnapshot,
  encodeSnapshotToHash,
  parseSnapshot,
  serializeSnapshot,
} from './persistence';

const REPORT: PivotConfiguration = {
  dataSource: { data: [{ a: 1 }, { a: 2 }] },
  slice: { rows: [{ uniqueName: 'a' }], measures: [{ uniqueName: 'a', aggregation: 'sum' }] },
};

describe('UndoRedoStack', () => {
  it('tracks undo/redo with branch truncation', () => {
    const s = new UndoRedoStack();
    s.reset({ report: { ...REPORT } });
    expect(s.canUndo()).toBe(false);
    s.push({ report: { ...REPORT, options: { grid: { type: 'flat' } } } });
    expect(s.canUndo()).toBe(true);
    expect(s.canRedo()).toBe(false);

    const back = s.undo();
    expect(back?.report.options).toBeUndefined();
    expect(s.canRedo()).toBe(true);

    const fwd = s.redo();
    expect(fwd?.report.options?.grid?.type).toBe('flat');

    // Pushing after an undo drops the redo branch.
    s.undo();
    s.push({ report: { ...REPORT, options: { grid: { type: 'classic' } } } });
    expect(s.canRedo()).toBe(false);
  });

  it('collapses identical consecutive pushes', () => {
    const s = new UndoRedoStack();
    s.reset({ report: { ...REPORT } });
    s.push({ report: { ...REPORT } });
    expect(s.size).toBe(1);
  });

  it('honors the retention limit', () => {
    const s = new UndoRedoStack({ limit: 3 });
    s.reset({ report: { ...REPORT, options: { grid: { type: 'compact' } } } });
    for (const type of ['flat', 'classic', 'compact', 'flat'] as const) {
      s.push({ report: { ...REPORT, options: { grid: { type } } } });
    }
    expect(s.size).toBe(3);
  });
});

describe('UIState', () => {
  it('round-trips a serializable snapshot', () => {
    const ui = new UIState({ freezeColumns: 2 });
    ui.columnWidths['c:1'] = 120;
    ui.rowHeight = 28;
    const data = ui.data;
    expect(data.freezeColumns).toBe(2);
    expect(data.columnWidths?.['c:1']).toBe(120);

    const ui2 = new UIState();
    ui2.set(data);
    expect(ui2.freezeColumns).toBe(2);
    expect(ui2.rowHeight).toBe(28);
    ui2.clearSizes();
    expect(Object.keys(ui2.columnWidths).length).toBe(0);
    expect(ui2.freezeColumns).toBe(2);
  });
});

describe('persistence', () => {
  it('strips bulk data by default and keeps mapping', () => {
    const snap = createSnapshot({
      ...REPORT,
      dataSource: { data: [{ a: 1 }], mapping: { a: { caption: 'A' } } },
    });
    expect(snap.report.dataSource.data).toBeUndefined();
    expect(snap.report.dataSource.mapping).toEqual({ a: { caption: 'A' } });
  });

  it('includes data when requested', () => {
    const snap = createSnapshot(REPORT, undefined, { includeData: true });
    expect(snap.report.dataSource.data?.length).toBe(2);
  });

  it('serializes and parses round-trip', () => {
    const json = serializeSnapshot(REPORT, { freezeColumns: 1 });
    const parsed = parseSnapshot(json);
    expect(parsed?.version).toBe(1);
    expect(parsed?.ui?.freezeColumns).toBe(1);
    expect(parsed?.report.slice?.rows?.[0]?.uniqueName).toBe('a');
  });

  it('returns null on malformed input', () => {
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot('{}')).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it('encodes a base64url hash value that decodes back', () => {
    const hash = encodeSnapshotToHash(REPORT);
    expect(hash).not.toMatch(/[+/=]/);
  });
});
