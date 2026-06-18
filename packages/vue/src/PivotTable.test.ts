import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type App } from 'vue';
import { PivotTable } from './PivotTable';

const DATA = [
  { country: 'USA', category: 'Cars', revenue: 100 },
  { country: 'USA', category: 'Bikes', revenue: 50 },
  { country: 'Canada', category: 'Cars', revenue: 300 },
];

const SLICE = {
  rows: [{ uniqueName: 'country' }],
  columns: [{ uniqueName: 'category' }],
  measures: [{ uniqueName: 'revenue', aggregation: 'sum' as const }],
};

let app: App | null = null;
let container: HTMLDivElement | null = null;

function mount(props: Record<string, unknown>): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  app = createApp(PivotTable, props);
  app.mount(container);
  return container;
}

afterEach(() => {
  app?.unmount();
  app = null;
  container?.remove();
  container = null;
});

describe('<PivotTable> (vue)', () => {
  it('mounts the web widget and renders the grid', () => {
    const el = mount({ dataSource: { data: DATA }, slice: SLICE });
    expect(el.querySelector('.ph-root')).toBeTruthy();
    expect(el.querySelector('.ph-table')).toBeTruthy();
    expect(el.textContent).toContain('USA');
    expect(el.textContent).toContain('Cars');
  });

  it('forwards the theme prop to the host element', () => {
    const el = mount({ dataSource: { data: DATA }, slice: SLICE, theme: 'dark' });
    const root = el.querySelector('.ph-root') as HTMLElement;
    expect(root.getAttribute('data-ph-theme')).toBe('dark');
  });
});
