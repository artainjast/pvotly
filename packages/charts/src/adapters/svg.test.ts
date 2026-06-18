import { describe, expect, it } from 'vitest';
import type { ChartData } from '../types';
import { builtinSvgAdapter } from './svg';

const DATA: ChartData = {
  type: 'bar',
  categories: ['USA', 'Canada'],
  series: [
    { name: 'Cars', values: [100, 300], measure: 'Sales' },
    { name: 'Bikes', values: [50, 80], measure: 'Sales' },
  ],
  axes: { category: { min: 0, max: 1 }, value: { min: 0, max: 300 } },
};

describe('builtinSvgAdapter', () => {
  it('renders an <svg> with one rect per (series × category) for a bar chart', () => {
    const el = document.createElement('div');
    const svg = builtinSvgAdapter.render(el, DATA, { type: 'bar' });

    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(el.querySelector('svg')).toBe(svg);
    // 2 series × 2 categories = 4 bars
    expect(svg.querySelectorAll('rect[height]').length).toBeGreaterThanOrEqual(4);
  });

  it('renders polylines for a line chart', () => {
    const el = document.createElement('div');
    const svg = builtinSvgAdapter.render(el, { ...DATA, type: 'line' }, {});
    expect(svg.querySelectorAll('polyline').length).toBe(2);
  });

  it('shows a "No data" placeholder for empty data', () => {
    const el = document.createElement('div');
    const empty: ChartData = { ...DATA, categories: [], series: [] };
    const svg = builtinSvgAdapter.render(el, empty, {});
    expect(svg.textContent).toContain('No data');
  });

  it('update() replaces the previous svg in the container', () => {
    const el = document.createElement('div');
    const first = builtinSvgAdapter.render(el, DATA, {});
    const next = builtinSvgAdapter.update(first, { ...DATA, type: 'line' }, {});

    expect(el.querySelectorAll('svg')).toHaveLength(1);
    expect(next).toBeTruthy();
    expect(el.querySelector('svg')).toBe(next);
  });

  it('destroy() removes the svg from the DOM', () => {
    const el = document.createElement('div');
    const svg = builtinSvgAdapter.render(el, DATA, {});
    builtinSvgAdapter.destroy(svg);
    expect(el.querySelector('svg')).toBeNull();
  });
});
