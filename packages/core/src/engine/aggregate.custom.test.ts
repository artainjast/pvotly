import { afterEach, describe, expect, it } from 'vitest';
import {
  createAggregator,
  createCustomAggregator,
  getAggregatorRegistry,
  isBuiltinAggregation,
  registerAggregator,
  resolveAggregator,
  unregisterAggregator,
} from './aggregate';
import { buildGrid } from './build';
import { Dataset } from '../data/dataset';
import { SALES } from '../__fixtures__/sales';
import type { AggregatorDefinition, PivotConfiguration } from '../types';

const range: AggregatorDefinition = {
  label: 'Range',
  evaluate: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
  },
};

afterEach(() => {
  unregisterAggregator('range');
  unregisterAggregator('concat');
});

describe('custom aggregators: createCustomAggregator', () => {
  it('supports the batch (evaluate) form', () => {
    const agg = createCustomAggregator(range);
    agg.push(10, {} as never);
    agg.push(40, {} as never);
    agg.push(25, {} as never);
    expect(agg.value()).toBe(30);
  });

  it('supports the streaming (init/reduce/finalize) form', () => {
    const concat: AggregatorDefinition = {
      init: () => [] as string[],
      reduce: (acc, value) => {
        (acc as string[]).push(String(value));
        return acc;
      },
      finalize: (acc) => (acc as string[]).join('-'),
    };
    const agg = createCustomAggregator(concat);
    agg.push('a', {} as never);
    agg.push('b', {} as never);
    expect(agg.value()).toBe('a-b');
  });
});

describe('custom aggregators: registry', () => {
  it('registers/resolves/unregisters globally', () => {
    expect(resolveAggregator('range')).toBeUndefined();
    const off = registerAggregator('range', range);
    expect(resolveAggregator('range')).toBe(range);
    expect(getAggregatorRegistry().has('range')).toBe(true);
    off();
    expect(resolveAggregator('range')).toBeUndefined();
  });

  it('per-report registry overrides the global one', () => {
    registerAggregator('range', range);
    const local = new Map([['range', { evaluate: () => 999 } as AggregatorDefinition]]);
    expect(resolveAggregator('range', local)!.evaluate!([], [])).toBe(999);
  });

  it('isBuiltinAggregation distinguishes built-ins from custom names', () => {
    expect(isBuiltinAggregation('sum')).toBe(true);
    expect(isBuiltinAggregation('range')).toBe(false);
  });

  it('createAggregator resolves custom names and falls back to sum for unknowns', () => {
    registerAggregator('range', range);
    const custom = createAggregator('range');
    custom.push(5, {} as never);
    custom.push(9, {} as never);
    expect(custom.value()).toBe(4);

    const unknown = createAggregator('definitely-not-real');
    unknown.push(2, {} as never);
    unknown.push(3, {} as never);
    expect(unknown.value()).toBe(5); // sum fallback
  });
});

describe('custom aggregators: wired into buildGrid', () => {
  it('uses config.customAggregators for a measure', () => {
    const config: PivotConfiguration = {
      dataSource: { data: SALES },
      customAggregators: { range },
      slice: {
        rows: [{ uniqueName: 'country' }],
        measures: [{ uniqueName: 'revenue', aggregation: 'range' }],
      },
    };
    const g = buildGrid(new Dataset(config.dataSource), config);
    const usa = g.rowLeaves.find((n) => n.value === 'USA')!;
    // USA revenues: 100, 200, 50 -> range = 150.
    expect(g.getCell(usa, g.columnLeaves[0]!, { uniqueName: 'revenue', aggregation: 'range' }).value).toBe(150);
  });
});
