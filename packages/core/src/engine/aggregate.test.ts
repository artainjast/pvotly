import { describe, expect, it } from 'vitest';

import type { AggregationType, DataRecord, DataValue } from '../types';
import {
  AGGREGATION_LABELS,
  asNumber,
  createAggregator,
} from './aggregate';

/**
 * Helper: push a list of values through a freshly-created aggregator of the
 * given type and read its final value(). The optional `records` array supplies
 * the second `push(value, record)` argument (only `count` cares about cardinality
 * via its no-arg push, but the interface requires a record).
 */
function aggregate(
  type: AggregationType,
  values: DataValue[],
  records?: DataRecord[],
): number | DataValue {
  const agg = createAggregator(type);
  values.forEach((v, i) => {
    agg.push(v, (records?.[i] ?? {}) as DataRecord);
  });
  return agg.value();
}

describe('asNumber', () => {
  it('returns null for null/undefined/empty-string', () => {
    expect(asNumber(null)).toBeNull();
    expect(asNumber(undefined)).toBeNull();
    expect(asNumber('')).toBeNull();
  });

  it('passes through finite numbers (including 0 and negatives)', () => {
    expect(asNumber(0)).toBe(0);
    expect(asNumber(42)).toBe(42);
    expect(asNumber(-7.5)).toBe(-7.5);
  });

  it('returns null for non-finite numbers', () => {
    expect(asNumber(Number.NaN)).toBeNull();
    expect(asNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(asNumber(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('coerces booleans to 1 / 0', () => {
    expect(asNumber(true)).toBe(1);
    expect(asNumber(false)).toBe(0);
  });

  it('coerces numeric strings, returns null for non-numeric strings', () => {
    expect(asNumber('3.14')).toBeCloseTo(3.14);
    expect(asNumber('  10  ')).toBe(10); // Number() trims whitespace
    expect(asNumber('abc')).toBeNull();
    expect(asNumber('12px')).toBeNull();
  });

  it('coerces Date objects via Number() to their epoch millis', () => {
    const d = new Date('2023-01-01T00:00:00.000Z');
    expect(asNumber(d)).toBe(d.getTime());
  });
});

describe('createAggregator — sum', () => {
  it('sums numeric values', () => {
    expect(aggregate('sum', [1, 2, 3, 4])).toBe(10);
  });

  it('returns null when there are no values', () => {
    expect(aggregate('sum', [])).toBeNull();
  });

  it('returns null when all values are null/empty (nothing accumulated)', () => {
    expect(aggregate('sum', [null, undefined, ''])).toBeNull();
  });

  it('ignores nulls but keeps numeric contributions', () => {
    expect(aggregate('sum', [10, null, 5, ''])).toBe(15);
  });

  it('coerces booleans (true=1, false=0) and numeric strings', () => {
    expect(aggregate('sum', [true, true, false, '4'])).toBe(6);
  });

  it('returns the value itself for a single value', () => {
    expect(aggregate('sum', [99])).toBe(99);
  });

  it('a single 0 yields 0 (not null) because has becomes true', () => {
    expect(aggregate('sum', [0])).toBe(0);
  });
});

describe('createAggregator — count', () => {
  it('tallies records regardless of value (including nulls)', () => {
    expect(aggregate('count', [1, null, 'x', undefined, ''])).toBe(5);
  });

  it('returns 0 for no values', () => {
    expect(aggregate('count', [])).toBe(0);
  });

  it('counts non-numeric values too', () => {
    expect(aggregate('count', ['a', 'b', 'c'])).toBe(3);
  });
});

describe('createAggregator — distinctCount', () => {
  it('counts unique non-null/non-empty values', () => {
    expect(aggregate('distinctCount', [1, 1, 2, 3, 3, 3])).toBe(3);
  });

  it('ignores null, undefined and empty string', () => {
    expect(aggregate('distinctCount', [null, undefined, '', 5, 5])).toBe(1);
  });

  it('returns 0 for no values', () => {
    expect(aggregate('distinctCount', [])).toBe(0);
  });

  it('treats values of differing types as distinct (no coercion)', () => {
    // 1 (number) and '1' (string) are NOT equal in a Set.
    expect(aggregate('distinctCount', [1, '1', true])).toBe(3);
  });
});

describe('createAggregator — average', () => {
  it('averages numeric values', () => {
    expect(aggregate('average', [2, 4, 6])).toBe(4);
  });

  it('only averages over the count of non-null values', () => {
    // nulls excluded -> (10+20)/2
    expect(aggregate('average', [10, null, 20, ''])).toBe(15);
  });

  it('returns null when there are no numeric values', () => {
    expect(aggregate('average', [])).toBeNull();
    expect(aggregate('average', [null, '', 'abc'])).toBeNull();
  });

  it('averages a single value to itself', () => {
    expect(aggregate('average', [7])).toBe(7);
  });
});

describe('createAggregator — median', () => {
  it('returns the middle element for an odd count', () => {
    expect(aggregate('median', [5, 1, 3])).toBe(3);
  });

  it('averages the two middle elements for an even count', () => {
    expect(aggregate('median', [1, 2, 3, 4])).toBe(2.5);
  });

  it('sorts numerically (not lexicographically)', () => {
    // sorted: 2,9,10 -> median 9
    expect(aggregate('median', [10, 2, 9])).toBe(9);
  });

  it('handles negatives and ties', () => {
    // sorted: -5,-5,0,5 -> (−5 + 0)/2 = −2.5
    expect(aggregate('median', [5, -5, -5, 0])).toBe(-2.5);
  });

  it('ignores nulls when computing the median', () => {
    // numeric values: 2,4,6 -> median 4
    expect(aggregate('median', [2, null, 4, '', 6])).toBe(4);
  });

  it('returns null for no numeric values', () => {
    expect(aggregate('median', [])).toBeNull();
    expect(aggregate('median', [null, ''])).toBeNull();
  });

  it('returns the single value for one element', () => {
    expect(aggregate('median', [42])).toBe(42);
  });
});

describe('createAggregator — min / max', () => {
  it('finds the minimum', () => {
    expect(aggregate('min', [3, 1, 2])).toBe(1);
  });

  it('finds the maximum', () => {
    expect(aggregate('max', [3, 1, 2])).toBe(3);
  });

  it('handles negative numbers', () => {
    expect(aggregate('min', [-1, -5, -3])).toBe(-5);
    expect(aggregate('max', [-1, -5, -3])).toBe(-1);
  });

  it('ignores nulls', () => {
    expect(aggregate('min', [null, 5, '', 2])).toBe(2);
    expect(aggregate('max', [null, 5, '', 2])).toBe(5);
  });

  it('returns null when there are no numeric values', () => {
    expect(aggregate('min', [])).toBeNull();
    expect(aggregate('max', [null, ''])).toBeNull();
  });

  it('handles a single value', () => {
    expect(aggregate('min', [8])).toBe(8);
    expect(aggregate('max', [8])).toBe(8);
  });

  it('treats 0 as a real candidate, not absence', () => {
    expect(aggregate('min', [0, 5])).toBe(0);
    expect(aggregate('max', [0, -5])).toBe(0);
  });
});

describe('createAggregator — product', () => {
  it('multiplies numeric values', () => {
    expect(aggregate('product', [2, 3, 4])).toBe(24);
  });

  it('returns null when there are no numeric values', () => {
    expect(aggregate('product', [])).toBeNull();
    expect(aggregate('product', [null, ''])).toBeNull();
  });

  it('a single 0 yields 0 (not the seed 1, not null)', () => {
    expect(aggregate('product', [0])).toBe(0);
  });

  it('ignores nulls between factors', () => {
    expect(aggregate('product', [2, null, 5])).toBe(10);
  });

  it('coerces booleans: a false factor (0) zeroes the product', () => {
    expect(aggregate('product', [5, false, 3])).toBe(0);
  });

  it('returns the single value for one element', () => {
    expect(aggregate('product', [7])).toBe(7);
  });
});

describe('createAggregator — variance / stdev', () => {
  // Dataset: [2, 4, 6, 8], mean = 5.
  // squared deviations: 9 + 1 + 1 + 9 = 20.
  // population variance = 20/4 = 5; sample variance = 20/3 ≈ 6.6667.
  const data = [2, 4, 6, 8];

  it('varp = population variance (ss / n)', () => {
    expect(aggregate('varp', data)).toBe(5);
  });

  it('var = sample variance (ss / (n-1))', () => {
    expect(aggregate('var', data)).toBeCloseTo(20 / 3, 10);
  });

  it('stdevp = sqrt(population variance)', () => {
    expect(aggregate('stdevp', data) as number).toBeCloseTo(Math.sqrt(5), 10);
  });

  it('stdev = sqrt(sample variance)', () => {
    expect(aggregate('stdev', data) as number).toBeCloseTo(Math.sqrt(20 / 3), 10);
  });

  it('returns null for no numeric values (all four modes)', () => {
    expect(aggregate('var', [])).toBeNull();
    expect(aggregate('varp', [])).toBeNull();
    expect(aggregate('stdev', [])).toBeNull();
    expect(aggregate('stdevp', [])).toBeNull();
    expect(aggregate('var', [null, ''])).toBeNull();
  });

  it('sample variance/stdev of a single value is 0 (n<2 guard)', () => {
    expect(aggregate('var', [42])).toBe(0);
    expect(aggregate('stdev', [42])).toBe(0);
  });

  it('population variance/stdev of a single value is 0 (no spread)', () => {
    expect(aggregate('varp', [42])).toBe(0);
    expect(aggregate('stdevp', [42])).toBe(0);
  });

  it('ignores nulls before computing spread', () => {
    // numeric: [2,4,6,8] same as data
    expect(aggregate('varp', [2, null, 4, '', 6, 8])).toBe(5);
  });

  it('coerces booleans into the sample', () => {
    // [true, false, true] -> [1,0,1], mean = 2/3
    // ss = (1/3)^2 + (2/3)^2 + (1/3)^2 = 1/9 + 4/9 + 1/9 = 6/9 = 2/3
    // varp = (2/3)/3 = 2/9
    expect(aggregate('varp', [true, false, true]) as number).toBeCloseTo(2 / 9, 10);
  });
});

describe('createAggregator — first / last / none', () => {
  it('first returns the first pushed value (even if null)', () => {
    expect(aggregate('first', [3, 2, 1])).toBe(3);
  });

  it('first returns null when nothing is pushed', () => {
    expect(aggregate('first', [])).toBeNull();
  });

  it('first preserves a null first value and does not advance', () => {
    // first push is null; `set` becomes true so later values are ignored.
    expect(aggregate('first', [null, 5, 9])).toBeNull();
  });

  it('first does NOT coerce — returns the raw value', () => {
    expect(aggregate('first', ['hello', 'world'])).toBe('hello');
  });

  it('last returns the last pushed value', () => {
    expect(aggregate('last', [1, 2, 3])).toBe(3);
  });

  it('last returns null when nothing is pushed', () => {
    expect(aggregate('last', [])).toBeNull();
  });

  it('last preserves the raw value (no coercion) and can be null', () => {
    expect(aggregate('last', [1, 2, null])).toBeNull();
    expect(aggregate('last', ['a', 'b'])).toBe('b');
  });

  it('none behaves like last (returns the last raw value)', () => {
    expect(aggregate('none', [10, 20, 30])).toBe(30);
    expect(aggregate('none', [])).toBeNull();
    expect(aggregate('none', ['x'])).toBe('x');
  });
});

describe('createAggregator — fallback / unknown type', () => {
  it('falls back to a sum aggregator for an unrecognised type', () => {
    // The factory has a `default: return new SumAggregator()` branch.
    const agg = createAggregator('totally-bogus' as AggregationType);
    agg.push(2, {} as DataRecord);
    agg.push(3, {} as DataRecord);
    expect(agg.value()).toBe(5);
  });
});

describe('AGGREGATION_LABELS', () => {
  const ALL_TYPES: AggregationType[] = [
    'sum',
    'count',
    'distinctCount',
    'average',
    'median',
    'min',
    'max',
    'product',
    'first',
    'last',
    'stdev',
    'stdevp',
    'var',
    'varp',
    'none',
  ];

  it('has a non-empty label for every AggregationType', () => {
    for (const type of ALL_TYPES) {
      expect(AGGREGATION_LABELS[type]).toBeTypeOf('string');
      expect(AGGREGATION_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('has exactly the expected set of keys (no extras, no omissions)', () => {
    expect(new Set(Object.keys(AGGREGATION_LABELS))).toEqual(new Set(ALL_TYPES));
  });

  it('maps a few representative types to their human captions', () => {
    expect(AGGREGATION_LABELS.sum).toBe('Sum');
    expect(AGGREGATION_LABELS.distinctCount).toBe('Distinct Count');
    expect(AGGREGATION_LABELS.stdev).toBe('Std Dev (sample)');
    expect(AGGREGATION_LABELS.varp).toBe('Variance (population)');
    expect(AGGREGATION_LABELS.none).toBe('None');
  });
});

describe('createAggregator — integration with the SALES fixture shape', () => {
  // Mirror the revenue column of the shared fixture to prove the reducers
  // produce hand-computed totals on realistic data.
  const revenue = [100, 200, 50, 300, 80, 120]; // sum = 850

  it('sum of revenue matches the hand total', () => {
    expect(aggregate('sum', revenue)).toBe(850);
  });

  it('average of revenue = 850 / 6', () => {
    expect(aggregate('average', revenue) as number).toBeCloseTo(850 / 6, 10);
  });

  it('count of revenue rows = 6', () => {
    expect(aggregate('count', revenue)).toBe(6);
  });

  it('min/max of revenue', () => {
    expect(aggregate('min', revenue)).toBe(50);
    expect(aggregate('max', revenue)).toBe(300);
  });

  it('median of revenue (even count): sorted 50,80,100,120,200,300 -> (100+120)/2', () => {
    expect(aggregate('median', revenue)).toBe(110);
  });
});
