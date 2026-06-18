import { describe, expect, it } from 'vitest';
import { compileFormula } from './calculated';
import type { AggResolver, AggRef } from './calculated';
import type { AggregationType } from '../types';

/**
 * Build a resolver from a map keyed by `${aggregation}:${field ?? ''}`.
 * Returns `undefined` lookups as null (to mimic "no value").
 */
function makeResolver(map: Record<string, number | null>): AggResolver {
  return (aggregation: AggregationType, field: string | null) => {
    const key = `${aggregation}:${field ?? ''}`;
    return key in map ? map[key]! : null;
  };
}

/** Convenience: compile + evaluate against a resolver in one shot. */
function evalFormula(formula: string, map: Record<string, number | null> = {}): number | null {
  return compileFormula(formula).evaluate(makeResolver(map));
}

describe('compileFormula — numeric literals & arithmetic', () => {
  it('evaluates a bare integer literal', () => {
    expect(evalFormula('42')).toBe(42);
  });

  it('evaluates a decimal literal', () => {
    expect(evalFormula('3.5')).toBe(3.5);
  });

  it('evaluates a leading-dot decimal literal', () => {
    expect(evalFormula('.25')).toBe(0.25);
  });

  it('adds two literals', () => {
    expect(evalFormula('2 + 3')).toBe(5);
  });

  it('subtracts two literals', () => {
    expect(evalFormula('10 - 4')).toBe(6);
  });

  it('multiplies two literals', () => {
    expect(evalFormula('6 * 7')).toBe(42);
  });

  it('divides two literals', () => {
    expect(evalFormula('20 / 5')).toBe(4);
  });

  it('handles addition without surrounding whitespace', () => {
    // tokenizer must not swallow the operator into the number
    expect(evalFormula('2+3')).toBe(5);
  });

  it('handles subtraction without whitespace as a binary op (not part of the literal)', () => {
    expect(evalFormula('10-4')).toBe(6);
  });

  it('supports scientific notation literals', () => {
    expect(evalFormula('1e3')).toBe(1000);
    expect(evalFormula('1.5e2')).toBe(150);
  });
});

describe('compileFormula — operator precedence', () => {
  it('gives * higher precedence than +', () => {
    expect(evalFormula('2 + 3 * 4')).toBe(14);
  });

  it('gives * higher precedence than + (operator first)', () => {
    expect(evalFormula('3 * 4 + 2')).toBe(14);
  });

  it('gives / higher precedence than -', () => {
    expect(evalFormula('10 - 8 / 4')).toBe(8);
  });

  it('evaluates same-precedence operators left-to-right', () => {
    expect(evalFormula('10 - 4 - 3')).toBe(3);
    expect(evalFormula('100 / 5 / 2')).toBe(10);
  });

  it('mixes + and * across multiple terms', () => {
    expect(evalFormula('1 + 2 * 3 + 4')).toBe(11);
  });
});

describe('compileFormula — parentheses', () => {
  it('overrides precedence with parentheses', () => {
    expect(evalFormula('(2 + 3) * 4')).toBe(20);
  });

  it('handles nested parentheses', () => {
    expect(evalFormula('((1 + 2) * (3 + 4))')).toBe(21);
  });

  it('handles a fully parenthesized single literal', () => {
    expect(evalFormula('(7)')).toBe(7);
  });

  it('handles deeply nested redundant parentheses', () => {
    expect(evalFormula('(((5)))')).toBe(5);
  });
});

describe('compileFormula — unary minus', () => {
  it('negates a literal', () => {
    expect(evalFormula('-5')).toBe(-5);
  });

  it('applies unary minus to a parenthesized expression', () => {
    expect(evalFormula('-(2 + 3)')).toBe(-5);
  });

  it('binds unary minus tighter than * so -2 * 3 = -6', () => {
    expect(evalFormula('-2 * 3')).toBe(-6);
  });

  it('supports a subtraction followed by a negated literal', () => {
    // 5 - (-3) handled via parentheses
    expect(evalFormula('5 - (-3)')).toBe(8);
  });

  it('supports double negation', () => {
    expect(evalFormula('-(-4)')).toBe(4);
  });

  it('negates an aggregation reference', () => {
    expect(evalFormula('-sum("revenue")', { 'sum:revenue': 10 })).toBe(-10);
  });
});

describe('compileFormula — aggregation calls & field arguments', () => {
  it('resolves a single aggregation reference', () => {
    expect(evalFormula('sum("revenue")', { 'sum:revenue': 100 })).toBe(100);
  });

  it('accepts double-quoted field arguments', () => {
    expect(evalFormula('average("units")', { 'average:units': 7 })).toBe(7);
  });

  it('accepts single-quoted field arguments', () => {
    expect(evalFormula("sum('revenue')", { 'sum:revenue': 55 })).toBe(55);
  });

  it('treats single- and double-quoted field names identically', () => {
    const single = compileFormula("sum('x')").references[0];
    const double = compileFormula('sum("x")').references[0];
    expect(single).toEqual(double);
  });

  it('parses count() with no argument (field = null)', () => {
    const compiled = compileFormula('count()');
    expect(compiled.references).toEqual([{ aggregation: 'count', field: null }]);
    expect(compiled.evaluate(makeResolver({ 'count:': 4 }))).toBe(4);
  });

  it('parses an empty-string field argument as "" (not null)', () => {
    const ref = compileFormula('sum("")').references[0];
    expect(ref).toEqual({ aggregation: 'sum', field: '' });
  });

  it('maps function aliases to canonical aggregation types', () => {
    expect(compileFormula('avg("x")').references[0]!.aggregation).toBe('average');
    expect(compileFormula('mean("x")').references[0]!.aggregation).toBe('average');
    expect(compileFormula('distinctcount("x")').references[0]!.aggregation).toBe('distinctCount');
  });

  it('is case-insensitive for function names', () => {
    expect(compileFormula('SUM("x")').references[0]!.aggregation).toBe('sum');
    expect(compileFormula('Sum("x")').references[0]!.aggregation).toBe('sum');
  });

  it('combines multiple aggregations arithmetically', () => {
    // sum / count = average-like
    const result = evalFormula('sum("revenue") / count()', {
      'sum:revenue': 200,
      'count:': 4,
    });
    expect(result).toBe(50);
  });

  it('multiplies two aggregation references', () => {
    const result = evalFormula('sum("price") * sum("quantity")', {
      'sum:price': 3,
      'sum:quantity': 5,
    });
    expect(result).toBe(15);
  });
});

describe('compileFormula — division by zero', () => {
  it('returns null when dividing a literal by zero', () => {
    expect(evalFormula('10 / 0')).toBeNull();
  });

  it('returns null when an aggregation denominator is zero', () => {
    expect(
      evalFormula('sum("revenue") / count()', { 'sum:revenue': 100, 'count:': 0 }),
    ).toBeNull();
  });

  it('does not treat a zero numerator as division by zero', () => {
    expect(evalFormula('0 / 5')).toBe(0);
  });

  it('propagates a null from a sub-expression that divided by zero', () => {
    // (10 / 0) + 1 => null + 1 => null
    expect(evalFormula('(10 / 0) + 1')).toBeNull();
  });
});

describe('compileFormula — null propagation', () => {
  it('returns null when a referenced aggregation resolves to null (left)', () => {
    expect(evalFormula('sum("a") + sum("b")', { 'sum:a': null, 'sum:b': 5 })).toBeNull();
  });

  it('returns null when a referenced aggregation resolves to null (right)', () => {
    expect(evalFormula('sum("a") + sum("b")', { 'sum:a': 5, 'sum:b': null })).toBeNull();
  });

  it('returns null for null * number', () => {
    expect(evalFormula('sum("a") * 100', { 'sum:a': null })).toBeNull();
  });

  it('returns null for null - number', () => {
    expect(evalFormula('sum("a") - 1', { 'sum:a': null })).toBeNull();
  });

  it('returns null when negating a null reference', () => {
    expect(evalFormula('-sum("a")', { 'sum:a': null })).toBeNull();
  });

  it('returns null when an unresolved reference yields null', () => {
    // resolver returns null for unknown keys
    expect(evalFormula('sum("missing") + 1')).toBeNull();
  });

  it('does not short-circuit incorrectly: both non-null operands compute normally', () => {
    expect(evalFormula('sum("a") + sum("b")', { 'sum:a': 2, 'sum:b': 3 })).toBe(5);
  });
});

describe('compileFormula — references[] extraction', () => {
  it('extracts a single reference with its field', () => {
    expect(compileFormula('sum("revenue")').references).toEqual([
      { aggregation: 'sum', field: 'revenue' },
    ]);
  });

  it('extracts references for count() with null field', () => {
    expect(compileFormula('count()').references).toEqual([
      { aggregation: 'count', field: null },
    ]);
  });

  it('extracts multiple references in source order', () => {
    expect(compileFormula('sum("revenue") / count()').references).toEqual<AggRef[]>([
      { aggregation: 'sum', field: 'revenue' },
      { aggregation: 'count', field: null },
    ]);
  });

  it('extracts references from nested/parenthesized expressions', () => {
    expect(compileFormula('(sum("a") + min("b")) * max("c")').references).toEqual<AggRef[]>([
      { aggregation: 'sum', field: 'a' },
      { aggregation: 'min', field: 'b' },
      { aggregation: 'max', field: 'c' },
    ]);
  });

  it('extracts references from negated terms', () => {
    expect(compileFormula('-sum("a")').references).toEqual<AggRef[]>([
      { aggregation: 'sum', field: 'a' },
    ]);
  });

  it('records duplicate references separately (no dedup)', () => {
    expect(compileFormula('sum("a") + sum("a")').references).toEqual<AggRef[]>([
      { aggregation: 'sum', field: 'a' },
      { aggregation: 'sum', field: 'a' },
    ]);
  });

  it('produces no references for a pure-literal formula', () => {
    expect(compileFormula('1 + 2 * 3').references).toEqual([]);
  });
});

describe('compileFormula — SyntaxError on malformed / unknown input', () => {
  it('throws on an unknown aggregation function', () => {
    expect(() => compileFormula('frobnicate("x")')).toThrow(SyntaxError);
    expect(() => compileFormula('frobnicate("x")')).toThrow(/Unknown aggregation function/);
  });

  it('throws on a missing closing paren', () => {
    expect(() => compileFormula('(1 + 2')).toThrow(SyntaxError);
  });

  it('throws on a function call missing its opening paren', () => {
    expect(() => compileFormula('sum')).toThrow(SyntaxError);
    expect(() => compileFormula('sum')).toThrow(/Expected \(/);
  });

  it('throws on a function call missing its closing paren', () => {
    expect(() => compileFormula('sum("x"')).toThrow(SyntaxError);
  });

  it('throws on trailing tokens', () => {
    expect(() => compileFormula('1 2')).toThrow(SyntaxError);
    expect(() => compileFormula('1 2')).toThrow(/trailing/);
  });

  it('throws on an empty formula', () => {
    expect(() => compileFormula('')).toThrow(SyntaxError);
  });

  it('throws on a dangling binary operator', () => {
    expect(() => compileFormula('1 +')).toThrow(SyntaxError);
  });

  it('throws on a leading binary operator (no left operand)', () => {
    // '*' cannot start a factor
    expect(() => compileFormula('* 2')).toThrow(SyntaxError);
  });

  it('throws on an unexpected character', () => {
    expect(() => compileFormula('1 @ 2')).toThrow(SyntaxError);
    expect(() => compileFormula('1 @ 2')).toThrow(/Unexpected character/);
  });

  it('throws on an empty parenthesized group', () => {
    expect(() => compileFormula('()')).toThrow(SyntaxError);
  });
});

describe('compileFormula — evaluate is reusable & pure', () => {
  it('re-evaluates the same compiled formula against different resolvers', () => {
    const compiled = compileFormula('sum("revenue") - sum("cost")');
    expect(compiled.evaluate(makeResolver({ 'sum:revenue': 10, 'sum:cost': 3 }))).toBe(7);
    expect(compiled.evaluate(makeResolver({ 'sum:revenue': 100, 'sum:cost': 40 }))).toBe(60);
  });

  it('does not mutate references[] across evaluations', () => {
    const compiled = compileFormula('sum("a") + count()');
    const before = JSON.stringify(compiled.references);
    compiled.evaluate(makeResolver({ 'sum:a': 1, 'count:': 2 }));
    compiled.evaluate(makeResolver({ 'sum:a': 9, 'count:': 9 }));
    expect(JSON.stringify(compiled.references)).toBe(before);
  });
});
