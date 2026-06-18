import { afterEach, describe, expect, it, vi } from 'vitest';
import { PivotTable } from './PivotTable';

const DATA = [
  { country: 'USA', category: 'Cars', revenue: 100 },
  { country: 'USA', category: 'Bikes', revenue: 50 },
  { country: 'Canada', category: 'Cars', revenue: 300 },
  { country: 'Canada', category: 'Bikes', revenue: 80 },
];

function mount() {
  const host = document.createElement('div');
  host.id = 'app';
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PivotTable (jsdom)', () => {
  it('renders toolbar, field list and a grid table', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    expect(host.querySelector('.ph-toolbar')).toBeTruthy();
    expect(host.querySelector('.ph-fieldlist')).toBeTruthy();
    const table = host.querySelector('.ph-table');
    expect(table).toBeTruthy();
    // Body has data rows incl. USA / Canada captions.
    expect(host.textContent).toContain('USA');
    expect(host.textContent).toContain('Canada');
    pivot.destroy();
  });

  it('reflects drag-drop style mutations (addToValues) after refresh', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
    });
    pivot.engine.addToColumns('category');
    pivot.refresh();
    expect(host.textContent).toContain('Cars');
    expect(host.textContent).toContain('Bikes');
    pivot.destroy();
  });

  it('toggles the field list panel', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
    });
    const panel = host.querySelector('.ph-fieldlist-host') as HTMLElement;
    expect(panel.hidden).toBe(false);
    pivot.toggleFieldList(false);
    expect(panel.hidden).toBe(true);
    pivot.destroy();
  });

  it('renders expand/collapse toggles for hierarchical rows', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    const toggles = host.querySelectorAll('.ph-row-head .ph-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    pivot.destroy();
  });

  it('applies a theme attribute', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      theme: 'dark',
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
    });
    expect(host.getAttribute('data-ph-theme')).toBe('dark');
    pivot.setTheme('light');
    expect(host.getAttribute('data-ph-theme')).toBe('light');
    pivot.destroy();
  });

  it('opens and closes a dialog through the context', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
    });
    // Click the Format toolbar button -> dialog opens.
    const formatBtn = [...host.querySelectorAll('.ph-tool-btn')].find((b) =>
      b.textContent?.includes('Format'),
    ) as HTMLButtonElement;
    formatBtn.click();
    const layer = host.querySelector('.ph-dialog-layer') as HTMLElement;
    expect(layer.hidden).toBe(false);
    expect(host.querySelector('.ph-dialog')).toBeTruthy();
    pivot.closeDialog();
    expect(layer.hidden).toBe(true);
    pivot.destroy();
  });

  it('opens the Fields configurator modal with four zones and all-fields checklist', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    pivot.openFieldsDialog();
    expect(host.querySelector('.ph-fields-dialog')).toBeTruthy();
    expect(host.querySelectorAll('.ph-zone').length).toBe(4);
    expect(host.querySelectorAll('.ph-ff-row').length).toBeGreaterThan(0);
    // revenue is placed -> a checked box exists.
    expect(host.querySelectorAll('.ph-ff-check:checked').length).toBeGreaterThan(0);
    pivot.destroy();
  });

  it('Fields dialog Apply commits a newly checked field to the slice', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
    });
    pivot.openFieldsDialog();
    const inactiveRow = [...host.querySelectorAll('.ph-ff-row:not(.ph-ff-active)')].find((r) =>
      r.textContent?.includes('country'),
    )!;
    const checkbox = inactiveRow.querySelector('.ph-ff-check') as HTMLInputElement;
    checkbox.click();
    const applyBtn = [...host.querySelectorAll('.ph-fields-dialog .ph-btn')].find((b) =>
      b.textContent?.includes('Apply'),
    ) as HTMLButtonElement;
    applyBtn.click();
    const slice = pivot.engine.getSlice();
    expect(slice.rows?.some((f) => f.uniqueName === 'country')).toBe(true);
    expect(host.querySelector('.ph-fields-dialog')).toBeNull();
    pivot.destroy();
  });

  it('applies the tokens option as CSS variables and via setTokens', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      tokens: { accent: 'rgb(255, 0, 0)', radius: 10, headerBackground: '#abcdef' },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
    });
    // host IS the root (.ph-root is added to it).
    expect(host.style.getPropertyValue('--ph-accent')).toBe('rgb(255, 0, 0)');
    expect(host.style.getPropertyValue('--ph-radius')).toBe('10px'); // number -> px
    expect(host.style.getPropertyValue('--ph-bg-header')).toBe('#abcdef');
    pivot.setTokens({ accent: 'blue', fontFamily: 'serif' });
    expect(host.style.getPropertyValue('--ph-accent')).toBe('blue');
    expect(host.style.getPropertyValue('--ph-font')).toBe('serif');
    pivot.destroy();
  });

  it('customizes the action bar: hide a built-in, relabel one, add a custom button', () => {
    const host = mount();
    const clicked = vi.fn();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
      actionBar: {
        className: 'my-bar',
        conditional: false,
        fields: { label: 'Configure' },
        custom: [{ id: 'reload', label: 'Reload', onClick: (t) => clicked(t) }],
      },
    });
    const bar = host.querySelector('.ph-toolbar') as HTMLElement;
    expect(bar.classList.contains('my-bar')).toBe(true);
    expect(host.querySelector('[data-action="conditional"]')).toBeNull();
    expect(host.querySelector('[data-action="fields"]')!.textContent).toContain('Configure');
    const custom = host.querySelector('[data-action="reload"]') as HTMLButtonElement;
    expect(custom).toBeTruthy();
    custom.click();
    expect(clicked).toHaveBeenCalledWith(pivot);
    pivot.destroy();
  });

  it('removes the format button with format:false, or drives it from a custom button', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
      actionBar: {
        format: false, // built-in Format button gone
        custom: [{ id: 'myFormat', label: 'My Format', onClick: (t) => t.openFormatDialog() }],
      },
    });
    expect(host.querySelector('[data-action="format"]')).toBeNull();
    const mine = host.querySelector('[data-action="myFormat"]') as HTMLButtonElement;
    expect(mine).toBeTruthy();
    mine.click(); // opens the built-in format dialog
    expect(host.querySelector('.ph-format-dialog')).toBeTruthy();
    pivot.destroy();
  });

  it('actionBar.visible:false hides the bar; setActionBar re-renders it', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
      actionBar: { visible: false },
    });
    expect(host.querySelector('.ph-toolbar')).toBeNull();
    pivot.setActionBar({ custom: [{ id: 'x', label: 'X', onClick: () => {} }] });
    expect(host.querySelector('.ph-toolbar')).toBeTruthy();
    expect(host.querySelector('[data-action="x"]')).toBeTruthy();
    pivot.destroy();
  });

  it('exposes a real ARIA grid (grid/columnheader/rowheader/gridcell)', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    expect(host.querySelector('[role="grid"]')).toBeTruthy();
    expect(host.querySelector('[role="columnheader"]')).toBeTruthy();
    expect(host.querySelector('[role="rowheader"]')).toBeTruthy();
    const cell = host.querySelector('[role="gridcell"]') as HTMLElement;
    expect(cell).toBeTruthy();
    expect(cell.getAttribute('tabindex')).toBeDefined();
    pivot.destroy();
  });
});

describe('PivotTable virtualization + freeze', () => {
  const bigData = Array.from({ length: 1000 }, (_, i) => ({
    id: `R${String(i).padStart(4, '0')}`,
    revenue: i,
  }));

  it('windows body rows when virtualization is enabled', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: bigData },
      slice: { rows: [{ uniqueName: 'id' }], measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
      options: { virtualization: true },
    });
    const dataRows = host.querySelectorAll('tbody tr:not(.ph-vrow-spacer)');
    // Only a small window is materialized, not all 1000 rows.
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows.length).toBeLessThan(100);
    // Spacer rows preserve the scrollable height.
    expect(host.querySelector('.ph-vrow-spacer')).toBeTruthy();
    const table = host.querySelector('.ph-table') as HTMLElement;
    expect(Number(table.getAttribute('aria-rowcount'))).toBeGreaterThan(900);
    pivot.destroy();
  });

  it('auto-enables virtualization past the row threshold', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: bigData },
      slice: { rows: [{ uniqueName: 'id' }], measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
    });
    expect(host.querySelector('.ph-grid-host.ph-virtual')).toBeTruthy();
    pivot.destroy();
  });

  it('freezes (pins) leading value columns', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
      freezeColumns: 1,
    });
    expect(host.querySelector('.ph-cell.ph-frozen')).toBeTruthy();
    pivot.freezeColumns(0);
    expect(host.querySelector('.ph-cell.ph-frozen')).toBeNull();
    pivot.destroy();
  });

  it('persists a column width override across re-renders', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
    });
    const vcId = pivot.getSnapshot; // ensure method exists
    expect(typeof vcId).toBe('function');
    const someCell = host.querySelector('.ph-cell[data-col-id]') as HTMLElement;
    const colId = someCell.dataset.colId!;
    pivot.setColumnWidth(colId, 222);
    pivot.refresh();
    const after = host.querySelector(`.ph-cell[data-col-id="${colId}"]`) as HTMLElement;
    expect(after.style.width).toBe('222px');
    pivot.destroy();
  });
});

describe('PivotTable sort / values-axis / history / state', () => {
  function make(extra: Record<string, unknown> = {}) {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: {
        rows: [{ uniqueName: 'country' }],
        columns: [{ uniqueName: 'category' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
      },
      ...extra,
    });
    return { host, pivot };
  }

  it('sorts via a column-header click (cycling asc/desc/none)', () => {
    const { host, pivot } = make();
    const header = host.querySelector('.ph-col-head.ph-sortable') as HTMLElement;
    header.click();
    expect(pivot.engine.getSlice().columns?.[0]?.sort).toBe('asc');
    header.click();
    expect(pivot.engine.getSlice().columns?.[0]?.sort).toBe('desc');
    pivot.destroy();
  });

  it('moves Values between the columns and rows axis', () => {
    const { host, pivot } = make();
    expect(pivot.getValuesAxis()).toBe('columns');
    pivot.setValuesAxis('rows');
    expect(pivot.getValuesAxis()).toBe('rows');
    expect(pivot.getConfiguration().options?.grid?.measurePosition).toBe('rows');
    expect(host.querySelector('.ph-measure-body-row')).toBeTruthy();
    pivot.destroy();
  });

  it('renders the values-axis toggle in the field list', () => {
    const { host, pivot } = make();
    expect(host.querySelector('.ph-fl-axis-toggle')).toBeTruthy();
    pivot.destroy();
  });

  it('supports undo / redo of report changes', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue', aggregation: 'sum' }] },
    });
    expect(pivot.canUndo()).toBe(false);
    pivot.engine.addToColumns('category');
    expect(pivot.engine.getSlice().columns?.length).toBe(1);
    expect(pivot.canUndo()).toBe(true);
    expect(pivot.undo()).toBe(true);
    expect(pivot.engine.getSlice().columns?.length ?? 0).toBe(0);
    expect(pivot.redo()).toBe(true);
    expect(pivot.engine.getSlice().columns?.length).toBe(1);
    pivot.destroy();
  });

  it('serializes + restores full report/UI state', () => {
    const { pivot } = make({ freezeColumns: 1 });
    const saved = pivot.serializeState();
    pivot.engine.removeField('category');
    pivot.freezeColumns(0);
    expect(pivot.engine.getSlice().columns?.length ?? 0).toBe(0);
    expect(pivot.restoreState(saved)).toBe(true);
    expect(pivot.engine.getSlice().columns?.length).toBe(1);
    expect(pivot.getUIState().freezeColumns).toBe(1);
    pivot.destroy();
  });

  it('round-trips through localStorage', () => {
    const { pivot } = make();
    pivot.setValuesAxis('rows');
    expect(pivot.saveToLocalStorage({ key: 'test:state' })).toBe(true);
    pivot.setValuesAxis('columns');
    expect(pivot.loadFromLocalStorage('test:state')).toBe(true);
    expect(pivot.getValuesAxis()).toBe('rows');
    pivot.destroy();
  });
});

describe('PivotTable localization + RTL', () => {
  it('routes toolbar/field-list strings through localization and sets RTL', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
      localization: { direction: 'rtl', fields: 'Champs', rows: 'Lignes' },
    });
    expect(host.getAttribute('dir')).toBe('rtl');
    expect(host.classList.contains('ph-rtl')).toBe(true);
    expect(host.querySelector('[data-action="fields"]')!.textContent).toContain('Champs');
    expect(host.textContent).toContain('Lignes');
    expect(pivot.direction).toBe('rtl');
    pivot.destroy();
  });

  it('shows optional undo/redo/copy toolbar buttons when enabled', () => {
    const host = mount();
    const pivot = new PivotTable(host, {
      dataSource: { data: DATA },
      slice: { rows: [{ uniqueName: 'country' }], measures: [{ uniqueName: 'revenue' }] },
      actionBar: { undo: true, redo: true, copy: true },
    });
    expect(host.querySelector('[data-action="undo"]')).toBeTruthy();
    expect(host.querySelector('[data-action="redo"]')).toBeTruthy();
    expect(host.querySelector('[data-action="copy"]')).toBeTruthy();
    pivot.destroy();
  });
});
