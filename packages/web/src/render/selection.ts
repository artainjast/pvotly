import type { PivotCell } from '@pvotly/core';
import type { GridModel } from './model';

/** A logical body-cell coordinate: row index + value-column index. */
export interface CellCoord {
  r: number;
  c: number;
}

/** A normalized inclusive rectangle of body cells. */
export interface CellRange {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** Normalize an anchor/focus pair into an inclusive rectangle. */
export function normalizeRange(anchor: CellCoord, focus: CellCoord): CellRange {
  return {
    r0: Math.min(anchor.r, focus.r),
    r1: Math.max(anchor.r, focus.r),
    c0: Math.min(anchor.c, focus.c),
    c1: Math.max(anchor.c, focus.c),
  };
}

export function rangeContains(range: CellRange | null, r: number, c: number): boolean {
  if (!range) return false;
  return r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
}

/** Resolve the computed {@link PivotCell} at a logical body coordinate. */
export function cellAt(model: GridModel, r: number, c: number): PivotCell | null {
  const row = model.bodyRows[r];
  const col = model.valueColumns[c];
  if (!row || !col) return null;
  const measure = model.measuresOnRows ? row.measure : col.measure;
  if (!measure) return null;
  return model.grid.getCell(row.node, col.leaf, measure);
}

/** Formatted display text for a logical body coordinate. */
export function cellText(model: GridModel, r: number, c: number): string {
  return cellAt(model, r, c)?.formatted ?? '';
}

export interface TSVOptions {
  /** Prepend the row-header caption column(s) and a column-header row. */
  includeHeaders?: boolean;
}

/**
 * Serialize a body-cell rectangle as TSV (tab-separated, `\n` rows) — the
 * clipboard format Excel / Google Sheets paste natively.
 */
export function buildTSV(model: GridModel, range: CellRange, options: TSVOptions = {}): string {
  const lines: string[] = [];

  if (options.includeHeaders) {
    const header: string[] = [''];
    for (let c = range.c0; c <= range.c1; c++) {
      const col = model.valueColumns[c];
      if (!col) continue;
      const measureLabel = col.measure ? col.measure.caption ?? col.measure.uniqueName : '';
      const leafCaption = col.leaf.caption;
      header.push([leafCaption, measureLabel].filter(Boolean).join(' · '));
    }
    lines.push(header.map(escapeTsv).join('\t'));
  }

  for (let r = range.r0; r <= range.r1; r++) {
    const row = model.bodyRows[r];
    const cells: string[] = [];
    if (options.includeHeaders) cells.push(escapeTsv(row?.node.caption ?? ''));
    for (let c = range.c0; c <= range.c1; c++) {
      cells.push(escapeTsv(cellText(model, r, c)));
    }
    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}

function escapeTsv(value: string): string {
  // Tabs and newlines would corrupt the grid; quote such cells like a CSV.
  if (/[\t\n\r"]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Write text to the clipboard, falling back to a hidden textarea + execCommand. */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
