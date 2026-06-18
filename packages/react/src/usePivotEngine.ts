import { useEffect, useRef, useState } from 'react';
import { PivotEngine, type PivotConfiguration, type PivotGrid } from '@pvotly/core';

/**
 * Headless hook: owns a {@link PivotEngine} and returns the live computed grid,
 * re-rendering whenever the report changes. Use this to build a fully custom
 * renderer in React without the bundled DOM UI.
 *
 * @example
 * ```tsx
 * const { engine, grid } = usePivotEngine({ dataSource: { data }, slice });
 * // render grid.rowLeaves / grid.columnLeaves / grid.getCell(...) yourself
 * ```
 */
export function usePivotEngine(config: PivotConfiguration): {
  engine: PivotEngine;
  grid: PivotGrid;
} {
  const engineRef = useRef<PivotEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new PivotEngine(config);
  const engine = engineRef.current;

  const [grid, setGrid] = useState<PivotGrid>(() => engine.getGrid());

  useEffect(() => {
    const unsubscribe = engine.on('reportChange', () => setGrid(engine.getGrid()));
    return () => {
      unsubscribe();
    };
  }, []);

  const key = JSON.stringify(config);
  useEffect(() => {
    engine.setConfiguration(config);
    setGrid(engine.getGrid());
  }, [key]);

  return { engine, grid };
}
