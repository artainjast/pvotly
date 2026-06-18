import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { PivotTable, type PivotTableHandle } from './PivotTable';
import { usePivotEngine } from './usePivotEngine';

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

afterEach(() => cleanup());

describe('<PivotTable> (react)', () => {
  it('mounts the web widget and renders the grid', () => {
    const { container } = render(<PivotTable dataSource={{ data: DATA }} slice={SLICE} />);
    expect(container.querySelector('.ph-root')).toBeInTheDocument();
    expect(container.querySelector('.ph-table')).toBeInTheDocument();
    expect(container.textContent).toContain('USA');
    expect(container.textContent).toContain('Cars');
  });

  it('exposes an imperative handle with the engine', () => {
    const ref = createRef<PivotTableHandle>();
    render(<PivotTable ref={ref} dataSource={{ data: DATA }} slice={SLICE} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current!.engine).toBeTruthy();
    const grid = ref.current!.engine.getGrid();
    expect(grid.rowLeaves.length).toBeGreaterThan(0);
    expect(typeof ref.current!.exportTo).toBe('function');
  });

  it('updates the grid when the slice prop changes', () => {
    const { container, rerender } = render(
      <PivotTable dataSource={{ data: DATA }} slice={{ measures: SLICE.measures }} />,
    );
    expect(container.textContent).not.toContain('USA');
    rerender(<PivotTable dataSource={{ data: DATA }} slice={SLICE} />);
    expect(container.textContent).toContain('USA');
  });

  it('forwards the theme prop', () => {
    const { container } = render(
      <PivotTable dataSource={{ data: DATA }} slice={SLICE} theme="dark" />,
    );
    expect(container.querySelector('.ph-root')!.getAttribute('data-ph-theme')).toBe('dark');
  });

  it('applies the tokens prop as CSS variables', () => {
    const { container } = render(
      <PivotTable
        dataSource={{ data: DATA }}
        slice={SLICE}
        tokens={{ accent: 'rgb(1, 2, 3)', radius: 8 }}
      />,
    );
    const root = container.querySelector('.ph-root') as HTMLElement;
    expect(root.style.getPropertyValue('--ph-accent')).toBe('rgb(1, 2, 3)');
    expect(root.style.getPropertyValue('--ph-radius')).toBe('8px');
  });

  it('accepts event-handler props without crashing the engine clone', () => {
    // Regression: handler props must not leak into the engine config (which is
    // deep-cloned and would throw on a function value).
    const onCellClick = vi.fn();
    const onDrillThrough = vi.fn();
    const { container } = render(
      <PivotTable
        dataSource={{ data: DATA }}
        slice={SLICE}
        onCellClick={onCellClick}
        onDrillThrough={onDrillThrough}
      />,
    );
    expect(container.querySelector('.ph-table')).toBeInTheDocument();
  });
});

describe('usePivotEngine', () => {
  it('returns an engine and computed grid', () => {
    const { result } = renderHook(() => usePivotEngine({ dataSource: { data: DATA }, slice: SLICE }));
    expect(result.current.engine).toBeTruthy();
    expect(result.current.grid.body.length).toBeGreaterThan(0);
  });

  it('recomputes the grid after a mutation', () => {
    const { result } = renderHook(() =>
      usePivotEngine({ dataSource: { data: DATA }, slice: { measures: SLICE.measures } }),
    );
    const before = result.current.grid.meta.rowFieldCount;
    act(() => {
      result.current.engine.addToRows('country');
    });
    expect(result.current.grid.meta.rowFieldCount).toBe(before + 1);
  });
});
