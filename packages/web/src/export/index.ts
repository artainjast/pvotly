import type { MeasureConfig, PivotGrid } from '@pvotly/core';

export type ExportFormat = 'csv' | 'html' | 'json' | 'excel';

export interface ExportOptions {
  filename?: string;
  /** Use raw numeric values instead of formatted strings. */
  raw?: boolean;
}

interface FlatColumn {
  header: string;
  colLeaf: PivotGrid['columnLeaves'][number];
  measure: MeasureConfig;
}

function flatColumns(grid: PivotGrid): FlatColumn[] {
  const cols: FlatColumn[] = [];
  for (const colLeaf of grid.columnLeaves) {
    for (const m of grid.measures) {
      const measureLabel = m.caption ?? m.uniqueName;
      const header = colLeaf.caption ? `${colLeaf.caption} – ${measureLabel}` : measureLabel;
      cols.push({ header, colLeaf, measure: m });
    }
  }
  return cols;
}

/** Build a 2D matrix (header row + body rows) of the visible grid. */
export function gridToMatrix(grid: PivotGrid, raw = false): (string | number | null)[][] {
  const cols = flatColumns(grid);
  const matrix: (string | number | null)[][] = [];
  matrix.push(['', ...cols.map((c) => c.header)]);
  for (const rowLeaf of grid.rowLeaves) {
    const line: (string | number | null)[] = [rowLeaf.caption];
    for (const c of cols) {
      const cell = grid.getCell(rowLeaf, c.colLeaf, c.measure);
      line.push(raw ? (cell.displayValue as number | null) : cell.formatted);
    }
    matrix.push(line);
  }
  return matrix;
}

function escapeCsv(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportToCSV(grid: PivotGrid, options: ExportOptions = {}): string {
  return gridToMatrix(grid, options.raw)
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
}

export function exportToJSON(grid: PivotGrid, options: ExportOptions = {}): string {
  const matrix = gridToMatrix(grid, options.raw ?? true);
  const [header, ...rows] = matrix;
  const records = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    header!.forEach((key, i) => {
      obj[String(key) || 'row'] = row[i];
    });
    return obj;
  });
  return JSON.stringify(records, null, 2);
}

function escapeHtml(value: string | number | null): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function exportToHTML(grid: PivotGrid, options: ExportOptions = {}): string {
  const matrix = gridToMatrix(grid, options.raw);
  const [header, ...rows] = matrix;
  const thead = `<thead><tr>${header!.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((c, i) => `<t${i === 0 ? 'h' : 'd'}>${escapeHtml(c)}</t${i === 0 ? 'h' : 'd'}>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table border="1" cellspacing="0" cellpadding="4">${thead}${tbody}</table>`;
}

/** Excel-compatible export using the SpreadsheetML / HTML-table format (.xls). */
export function exportToExcel(grid: PivotGrid, options: ExportOptions = {}): string {
  const table = exportToHTML(grid, options);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Pivot</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${table}</body></html>`;
}

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  html: 'text/html;charset=utf-8',
  json: 'application/json;charset=utf-8',
  excel: 'application/vnd.ms-excel',
};

const EXT: Record<ExportFormat, string> = { csv: 'csv', html: 'html', json: 'json', excel: 'xls' };

export function serializeExport(grid: PivotGrid, format: ExportFormat, options: ExportOptions = {}): string {
  switch (format) {
    case 'csv':
      return exportToCSV(grid, options);
    case 'html':
      return exportToHTML(grid, options);
    case 'json':
      return exportToJSON(grid, options);
    case 'excel':
      return exportToExcel(grid, options);
  }
}

/** Trigger a browser download (no-op outside the browser). */
export function downloadExport(grid: PivotGrid, format: ExportFormat, options: ExportOptions = {}): void {
  const content = serializeExport(grid, format, options);
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
  const blob = new Blob([content], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.filename ?? 'pivot'}.${EXT[format]}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open the browser print dialog scoped to the table (for PDF export). */
export function printGrid(grid: PivotGrid, title = 'Pivot Table'): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${title}</title><style>table{border-collapse:collapse;font-family:sans-serif;font-size:12px}th,td{border:1px solid #ccc;padding:4px 8px;text-align:right}th:first-child,td:first-child{text-align:left}</style></head><body>${exportToHTML(grid)}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
