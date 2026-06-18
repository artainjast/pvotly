import { describe, expect, it } from 'vitest';
import { pvotly } from './index';

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

describe('pvotly (svelte action)', () => {
  it('mounts the web widget and renders the grid on a div', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);

    const action = pvotly(node, { dataSource: { data: DATA }, slice: SLICE });

    // `@pvotly/web` mounts onto the host element itself (it carries `.ph-root`),
    // and renders the grid (`.ph-table`) as a descendant.
    expect(node.classList.contains('ph-root') || node.querySelector('.ph-root')).toBeTruthy();
    expect(node.querySelector('.ph-table')).toBeTruthy();
    expect(node.textContent).toContain('USA');
    expect(node.textContent).toContain('Cars');

    action.destroy();
    expect(node.querySelector('.ph-table')).toBeNull();

    node.remove();
  });

  it('updates the configuration via the action update hook', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);

    const action = pvotly(node, { dataSource: { data: DATA }, slice: { measures: SLICE.measures } });
    expect(node.textContent).not.toContain('USA');

    action.update({ dataSource: { data: DATA }, slice: SLICE });
    expect(node.textContent).toContain('USA');

    action.destroy();
    node.remove();
  });

  it('applies theme via update', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);

    const action = pvotly(node, { dataSource: { data: DATA }, slice: SLICE });
    action.update({ dataSource: { data: DATA }, slice: SLICE, theme: 'dark' });
    const root = (node.querySelector('.ph-root') as HTMLElement | null) ?? node;
    expect(root.getAttribute('data-ph-theme')).toBe('dark');

    action.destroy();
    node.remove();
  });
});
