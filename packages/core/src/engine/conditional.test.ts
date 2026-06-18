import { describe, expect, it } from 'vitest';
import { resolveCellStyle } from './conditional';
import type { CellStyle, ConditionalFormat } from '../types';

/**
 * Helpers to build a ConditionalFormat with a default visible style so that
 * the returned merge can be asserted unambiguously.
 */
function rule(
  condition: ConditionalFormat['condition'],
  format: CellStyle,
  measure?: string,
): ConditionalFormat {
  return measure === undefined ? { condition, format } : { measure, condition, format };
}

const RED: CellStyle = { backgroundColor: 'red' };
const GREEN: CellStyle = { backgroundColor: 'green' };
const BOLD: CellStyle = { fontWeight: 'bold' };

describe('resolveCellStyle', () => {
  describe('returns undefined', () => {
    it('returns undefined when conditions is undefined', () => {
      expect(resolveCellStyle(10, 'revenue', undefined)).toBeUndefined();
    });

    it('returns undefined when conditions is an empty array', () => {
      expect(resolveCellStyle(10, 'revenue', [])).toBeUndefined();
    });

    it('returns undefined when no rule matches', () => {
      const conditions = [rule({ op: '>', value: 100 }, RED)];
      expect(resolveCellStyle(5, 'revenue', conditions)).toBeUndefined();
    });

    it('returns undefined when value is null and only numeric (>) rules exist', () => {
      const conditions = [rule({ op: '>', value: 0 }, RED)];
      expect(resolveCellStyle(null, 'revenue', conditions)).toBeUndefined();
    });
  });

  describe('op: = (equals)', () => {
    it('matches a numeric value equal to a numeric condition', () => {
      const conditions = [rule({ op: '=', value: 42 }, RED)];
      expect(resolveCellStyle(42, 'm', conditions)).toEqual(RED);
    });

    it('does not match a numeric value different from a numeric condition', () => {
      const conditions = [rule({ op: '=', value: 42 }, RED)];
      expect(resolveCellStyle(43, 'm', conditions)).toBeUndefined();
    });

    it('coerces a numeric string when the condition value is a number', () => {
      const conditions = [rule({ op: '=', value: 42 }, RED)];
      expect(resolveCellStyle('42', 'm', conditions)).toEqual(RED);
    });

    it('uses strict equality when the condition value is a string', () => {
      const conditions = [rule({ op: '=', value: 'USA' }, RED)];
      expect(resolveCellStyle('USA', 'm', conditions)).toEqual(RED);
      expect(resolveCellStyle('Canada', 'm', conditions)).toBeUndefined();
    });

    it('does not match a number against a string condition (strict equality)', () => {
      const conditions = [rule({ op: '=', value: '42' }, RED)];
      expect(resolveCellStyle(42, 'm', conditions)).toBeUndefined();
    });

    it('does not match null against a numeric = condition', () => {
      const conditions = [rule({ op: '=', value: 0 }, RED)];
      expect(resolveCellStyle(null, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: != (not equals)', () => {
    it('matches a numeric value different from a numeric condition', () => {
      const conditions = [rule({ op: '!=', value: 42 }, RED)];
      expect(resolveCellStyle(43, 'm', conditions)).toEqual(RED);
    });

    it('does not match a numeric value equal to a numeric condition', () => {
      const conditions = [rule({ op: '!=', value: 42 }, RED)];
      expect(resolveCellStyle(42, 'm', conditions)).toBeUndefined();
    });

    it('matches null against a numeric != condition (null is not a number)', () => {
      // hasNum is false for null, so !(false && ...) === true
      const conditions = [rule({ op: '!=', value: 42 }, RED)];
      expect(resolveCellStyle(null, 'm', conditions)).toEqual(RED);
    });

    it('uses strict inequality when the condition value is a string', () => {
      const conditions = [rule({ op: '!=', value: 'USA' }, RED)];
      expect(resolveCellStyle('Canada', 'm', conditions)).toEqual(RED);
      expect(resolveCellStyle('USA', 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: > (greater than)', () => {
    it('matches a value strictly greater than the threshold', () => {
      const conditions = [rule({ op: '>', value: 10 }, RED)];
      expect(resolveCellStyle(11, 'm', conditions)).toEqual(RED);
    });

    it('does not match a value equal to the threshold', () => {
      const conditions = [rule({ op: '>', value: 10 }, RED)];
      expect(resolveCellStyle(10, 'm', conditions)).toBeUndefined();
    });

    it('does not match a value less than the threshold', () => {
      const conditions = [rule({ op: '>', value: 10 }, RED)];
      expect(resolveCellStyle(9, 'm', conditions)).toBeUndefined();
    });

    it('coerces a numeric string and compares', () => {
      const conditions = [rule({ op: '>', value: 10 }, RED)];
      expect(resolveCellStyle('15', 'm', conditions)).toEqual(RED);
    });

    it('does not match a non-numeric string', () => {
      const conditions = [rule({ op: '>', value: 10 }, RED)];
      expect(resolveCellStyle('abc', 'm', conditions)).toBeUndefined();
    });

    it('does not match null', () => {
      const conditions = [rule({ op: '>', value: -1 }, RED)];
      expect(resolveCellStyle(null, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: >= (greater than or equal)', () => {
    it('matches a value greater than the threshold', () => {
      const conditions = [rule({ op: '>=', value: 10 }, RED)];
      expect(resolveCellStyle(11, 'm', conditions)).toEqual(RED);
    });

    it('matches a value equal to the threshold', () => {
      const conditions = [rule({ op: '>=', value: 10 }, RED)];
      expect(resolveCellStyle(10, 'm', conditions)).toEqual(RED);
    });

    it('does not match a value below the threshold', () => {
      const conditions = [rule({ op: '>=', value: 10 }, RED)];
      expect(resolveCellStyle(9, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: < (less than)', () => {
    it('matches a value strictly less than the threshold', () => {
      const conditions = [rule({ op: '<', value: 10 }, RED)];
      expect(resolveCellStyle(9, 'm', conditions)).toEqual(RED);
    });

    it('does not match a value equal to the threshold', () => {
      const conditions = [rule({ op: '<', value: 10 }, RED)];
      expect(resolveCellStyle(10, 'm', conditions)).toBeUndefined();
    });

    it('matches negative numbers below the threshold', () => {
      const conditions = [rule({ op: '<', value: 0 }, RED)];
      expect(resolveCellStyle(-5, 'm', conditions)).toEqual(RED);
    });
  });

  describe('op: <= (less than or equal)', () => {
    it('matches a value below the threshold', () => {
      const conditions = [rule({ op: '<=', value: 10 }, RED)];
      expect(resolveCellStyle(9, 'm', conditions)).toEqual(RED);
    });

    it('matches a value equal to the threshold', () => {
      const conditions = [rule({ op: '<=', value: 10 }, RED)];
      expect(resolveCellStyle(10, 'm', conditions)).toEqual(RED);
    });

    it('does not match a value above the threshold', () => {
      const conditions = [rule({ op: '<=', value: 10 }, RED)];
      expect(resolveCellStyle(11, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: between', () => {
    it('matches a value inside the inclusive range', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle(15, 'm', conditions)).toEqual(RED);
    });

    it('matches the lower boundary (inclusive)', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle(10, 'm', conditions)).toEqual(RED);
    });

    it('matches the upper boundary (inclusive)', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle(20, 'm', conditions)).toEqual(RED);
    });

    it('does not match a value below the range', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle(9, 'm', conditions)).toBeUndefined();
    });

    it('does not match a value above the range', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle(21, 'm', conditions)).toBeUndefined();
    });

    it('coerces a numeric string within the range', () => {
      const conditions = [rule({ op: 'between', from: 10, to: 20 }, RED)];
      expect(resolveCellStyle('12', 'm', conditions)).toEqual(RED);
    });

    it('does not match null', () => {
      const conditions = [rule({ op: 'between', from: 0, to: 100 }, RED)];
      expect(resolveCellStyle(null, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: contains', () => {
    it('matches a substring case-insensitively', () => {
      const conditions = [rule({ op: 'contains', value: 'usa' }, RED)];
      expect(resolveCellStyle('United States of USA', 'm', conditions)).toEqual(RED);
    });

    it('matches regardless of casing of the condition value', () => {
      const conditions = [rule({ op: 'contains', value: 'CAN' }, RED)];
      expect(resolveCellStyle('canada', 'm', conditions)).toEqual(RED);
    });

    it('does not match when the substring is absent', () => {
      const conditions = [rule({ op: 'contains', value: 'xyz' }, RED)];
      expect(resolveCellStyle('canada', 'm', conditions)).toBeUndefined();
    });

    it('coerces a number to a string before checking', () => {
      const conditions = [rule({ op: 'contains', value: '23' }, RED)];
      expect(resolveCellStyle(1234, 'm', conditions)).toEqual(RED);
    });

    it('does not match null', () => {
      const conditions = [rule({ op: 'contains', value: 'a' }, RED)];
      expect(resolveCellStyle(null, 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: isTrue', () => {
    it('matches strictly boolean true', () => {
      const conditions = [rule({ op: 'isTrue' }, RED)];
      expect(resolveCellStyle(true, 'm', conditions)).toEqual(RED);
    });

    it('does not match boolean false', () => {
      const conditions = [rule({ op: 'isTrue' }, RED)];
      expect(resolveCellStyle(false, 'm', conditions)).toBeUndefined();
    });

    it('does not match truthy non-boolean values', () => {
      const conditions = [rule({ op: 'isTrue' }, RED)];
      expect(resolveCellStyle(1, 'm', conditions)).toBeUndefined();
      expect(resolveCellStyle('true', 'm', conditions)).toBeUndefined();
    });
  });

  describe('op: isFalse', () => {
    it('matches strictly boolean false', () => {
      const conditions = [rule({ op: 'isFalse' }, RED)];
      expect(resolveCellStyle(false, 'm', conditions)).toEqual(RED);
    });

    it('does not match boolean true', () => {
      const conditions = [rule({ op: 'isFalse' }, RED)];
      expect(resolveCellStyle(true, 'm', conditions)).toBeUndefined();
    });

    it('does not match falsy non-boolean values', () => {
      const conditions = [rule({ op: 'isFalse' }, RED)];
      expect(resolveCellStyle(0, 'm', conditions)).toBeUndefined();
      expect(resolveCellStyle(null, 'm', conditions)).toBeUndefined();
      expect(resolveCellStyle('', 'm', conditions)).toBeUndefined();
    });
  });

  describe('measure scoping', () => {
    it('applies a rule scoped to the matching measure', () => {
      const conditions = [rule({ op: '>', value: 0 }, RED, 'revenue')];
      expect(resolveCellStyle(5, 'revenue', conditions)).toEqual(RED);
    });

    it('skips a rule scoped to a different measure', () => {
      const conditions = [rule({ op: '>', value: 0 }, RED, 'revenue')];
      expect(resolveCellStyle(5, 'units', conditions)).toBeUndefined();
    });

    it('applies an unscoped rule (no measure) to any measure', () => {
      const conditions = [rule({ op: '>', value: 0 }, RED)];
      expect(resolveCellStyle(5, 'anything', conditions)).toEqual(RED);
      expect(resolveCellStyle(5, 'somethingElse', conditions)).toEqual(RED);
    });

    it('only applies the rule whose measure matches when several are scoped', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, RED, 'revenue'),
        rule({ op: '>', value: 0 }, GREEN, 'units'),
      ];
      expect(resolveCellStyle(5, 'revenue', conditions)).toEqual(RED);
      expect(resolveCellStyle(5, 'units', conditions)).toEqual(GREEN);
    });
  });

  describe('last-matching-rule-wins merge', () => {
    it('later matching rule overrides an earlier one for the same property', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, { backgroundColor: 'red' }),
        rule({ op: '>', value: 0 }, { backgroundColor: 'green' }),
      ];
      expect(resolveCellStyle(5, 'm', conditions)).toEqual({ backgroundColor: 'green' });
    });

    it('merges distinct properties across multiple matching rules', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, { backgroundColor: 'red' }),
        rule({ op: '>', value: 0 }, { color: 'white' }),
      ];
      expect(resolveCellStyle(5, 'm', conditions)).toEqual({
        backgroundColor: 'red',
        color: 'white',
      });
    });

    it('a later rule overrides only overlapping properties, keeping the rest', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, { backgroundColor: 'red', color: 'white' }),
        rule({ op: '>', value: 0 }, { backgroundColor: 'green', fontWeight: 'bold' }),
      ];
      expect(resolveCellStyle(5, 'm', conditions)).toEqual({
        backgroundColor: 'green',
        color: 'white',
        fontWeight: 'bold',
      });
    });

    it('ignores non-matching rules during the merge', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, RED),
        rule({ op: '>', value: 100 }, GREEN), // does not match value 5
        rule({ op: '<', value: 10 }, BOLD),
      ];
      expect(resolveCellStyle(5, 'm', conditions)).toEqual({
        backgroundColor: 'red',
        fontWeight: 'bold',
      });
    });

    it('returns a fresh object (does not mutate the rule format)', () => {
      const fmt: CellStyle = { backgroundColor: 'red' };
      const conditions = [rule({ op: '>', value: 0 }, fmt)];
      const result = resolveCellStyle(5, 'm', conditions);
      expect(result).toEqual(fmt);
      expect(result).not.toBe(fmt);
    });

    it('combines measure-scoped and unscoped rules with last-wins', () => {
      const conditions = [
        rule({ op: '>', value: 0 }, { backgroundColor: 'red' }), // unscoped, matches
        rule({ op: '>', value: 0 }, { backgroundColor: 'blue' }, 'other'), // skipped
        rule({ op: '>', value: 0 }, { color: 'white' }, 'revenue'), // scoped, matches
      ];
      expect(resolveCellStyle(5, 'revenue', conditions)).toEqual({
        backgroundColor: 'red',
        color: 'white',
      });
    });
  });

  describe('mixed-op realistic scenarios', () => {
    it('applies a heatmap-style set of thresholds (low/mid/high)', () => {
      const conditions: ConditionalFormat[] = [
        rule({ op: '<', value: 50 }, { backgroundColor: 'red' }),
        rule({ op: 'between', from: 50, to: 100 }, { backgroundColor: 'yellow' }),
        rule({ op: '>', value: 100 }, { backgroundColor: 'green' }),
      ];
      expect(resolveCellStyle(10, 'm', conditions)).toEqual({ backgroundColor: 'red' });
      expect(resolveCellStyle(75, 'm', conditions)).toEqual({ backgroundColor: 'yellow' });
      expect(resolveCellStyle(150, 'm', conditions)).toEqual({ backgroundColor: 'green' });
    });
  });
});
