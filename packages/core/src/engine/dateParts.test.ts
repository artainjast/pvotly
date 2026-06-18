import { describe, it, expect } from 'vitest';
import {
  toDate,
  datePartValue,
  datePartCaption,
  MONTH_NAMES,
  WEEKDAY_NAMES,
} from './dateParts';
import type { DatePart } from '../types';

/**
 * Reference implementation of the ISO-week algorithm used by dateParts.ts.
 * Kept here so the expectation is independently derived rather than copied
 * from the implementation under test.
 */
function expectedIsoWeek(y: number, m1: number, d: number): number {
  // m1 is 1-based month
  const date = new Date(Date.UTC(y, m1 - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

describe('dateParts', () => {
  /* ------------------------------------------------------------------ */
  /* toDate                                                              */
  /* ------------------------------------------------------------------ */
  describe('toDate', () => {
    it('returns the same Date instance for a valid Date', () => {
      const d = new Date(2024, 0, 15);
      expect(toDate(d)).toBe(d);
    });

    it('returns null for an invalid Date instance', () => {
      const invalid = new Date('not-a-date');
      expect(Number.isNaN(invalid.getTime())).toBe(true);
      expect(toDate(invalid)).toBeNull();
    });

    it('coerces a numeric epoch-millis value to a Date', () => {
      const millis = Date.UTC(2024, 5, 1, 0, 0, 0);
      const d = toDate(millis);
      expect(d).toBeInstanceOf(Date);
      expect(d?.getTime()).toBe(millis);
    });

    it('coerces 0 (epoch) to a valid Date rather than null', () => {
      const d = toDate(0);
      expect(d).toBeInstanceOf(Date);
      expect(d?.getTime()).toBe(0);
    });

    it('parses an ISO date string', () => {
      const d = toDate('2024-03-09');
      expect(d).toBeInstanceOf(Date);
      // ISO date-only strings are parsed as UTC midnight.
      expect(d?.getUTCFullYear()).toBe(2024);
      expect(d?.getUTCMonth()).toBe(2);
      expect(d?.getUTCDate()).toBe(9);
    });

    it('parses a full ISO datetime string', () => {
      const d = toDate('2024-03-09T13:45:30Z');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getTime()).toBe(Date.parse('2024-03-09T13:45:30Z'));
    });

    it('trims surrounding whitespace before parsing', () => {
      const d = toDate('  2024-03-09  ');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getUTCFullYear()).toBe(2024);
    });

    it('returns null for an unparseable string', () => {
      expect(toDate('definitely not a date')).toBeNull();
    });

    it('returns null for a blank / whitespace-only string', () => {
      expect(toDate('')).toBeNull();
      expect(toDate('   ')).toBeNull();
    });

    it('returns null for null and undefined', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
    });

    it('returns null for a boolean value', () => {
      // booleans are not date-like in this coercion
      expect(toDate(true as unknown as never)).toBeNull();
      expect(toDate(false as unknown as never)).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /* datePartValue                                                       */
  /* ------------------------------------------------------------------ */
  describe('datePartValue', () => {
    // A fixed local date: 2024-03-09 (a Saturday) at 13:45:07.
    // March is month index 2 -> month number 3, quarter 1 (Jan-Mar).
    const date = new Date(2024, 2, 9, 13, 45, 7);

    it('year returns the full year as a number', () => {
      expect(datePartValue(date, 'year')).toBe(2024);
    });

    it('quarter returns 1-based quarter as a number', () => {
      expect(datePartValue(date, 'quarter')).toBe(1);
      expect(datePartValue(new Date(2024, 3, 1), 'quarter')).toBe(2); // April
      expect(datePartValue(new Date(2024, 6, 1), 'quarter')).toBe(3); // July
      expect(datePartValue(new Date(2024, 9, 1), 'quarter')).toBe(4); // October
      expect(datePartValue(new Date(2024, 11, 31), 'quarter')).toBe(4); // December
    });

    it('month returns the 1-based month number', () => {
      expect(datePartValue(date, 'month')).toBe(3);
      expect(datePartValue(new Date(2024, 0, 1), 'month')).toBe(1);
      expect(datePartValue(new Date(2024, 11, 1), 'month')).toBe(12);
    });

    it('monthName returns the English month name string', () => {
      expect(datePartValue(date, 'monthName')).toBe('March');
      expect(datePartValue(new Date(2024, 0, 1), 'monthName')).toBe('January');
      expect(datePartValue(new Date(2024, 11, 1), 'monthName')).toBe('December');
    });

    it('week returns the ISO week number', () => {
      expect(datePartValue(date, 'week')).toBe(expectedIsoWeek(2024, 3, 9));
    });

    it('dayOfMonth returns the day-of-month number', () => {
      expect(datePartValue(date, 'dayOfMonth')).toBe(9);
      expect(datePartValue(new Date(2024, 2, 31), 'dayOfMonth')).toBe(31);
    });

    it('weekday returns the 0-based day-of-week (Sunday=0)', () => {
      // 2024-03-09 is a Saturday -> getDay() === 6
      expect(datePartValue(date, 'weekday')).toBe(6);
      // 2024-03-10 is a Sunday -> 0
      expect(datePartValue(new Date(2024, 2, 10), 'weekday')).toBe(0);
    });

    it('date returns a zero-padded yyyy-mm-dd string', () => {
      expect(datePartValue(date, 'date')).toBe('2024-03-09');
      expect(datePartValue(new Date(2024, 0, 5), 'date')).toBe('2024-01-05');
      expect(datePartValue(new Date(2024, 11, 25), 'date')).toBe('2024-12-25');
    });

    it('hour returns the local hour', () => {
      expect(datePartValue(date, 'hour')).toBe(13);
      expect(datePartValue(new Date(2024, 2, 9, 0, 0, 0), 'hour')).toBe(0);
    });

    it('minute returns the local minute', () => {
      expect(datePartValue(date, 'minute')).toBe(45);
    });

    it('second returns the local second', () => {
      expect(datePartValue(date, 'second')).toBe(7);
    });

    it('returns null for an unknown part', () => {
      expect(datePartValue(date, 'nonsense' as DatePart)).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /* datePartCaption                                                     */
  /* ------------------------------------------------------------------ */
  describe('datePartCaption', () => {
    it('formats quarter as "Q<n>"', () => {
      expect(datePartCaption(1, 'quarter')).toBe('Q1');
      expect(datePartCaption(4, 'quarter')).toBe('Q4');
    });

    it('maps a 1-based month number to its month name', () => {
      expect(datePartCaption(1, 'month')).toBe('January');
      expect(datePartCaption(3, 'month')).toBe('March');
      expect(datePartCaption(12, 'month')).toBe('December');
    });

    it('falls back to month number 1 (January) when value is not a valid number', () => {
      // (Number(value) || 1) - 1 => index 0 for falsy/NaN
      expect(datePartCaption('abc', 'month')).toBe('January');
      expect(datePartCaption(0, 'month')).toBe('January');
    });

    it('maps a 0-based weekday number to its weekday name', () => {
      expect(datePartCaption(0, 'weekday')).toBe('Sunday');
      expect(datePartCaption(6, 'weekday')).toBe('Saturday');
      expect(datePartCaption(3, 'weekday')).toBe('Wednesday');
    });

    it('returns an empty string for null/undefined values', () => {
      expect(datePartCaption(null, 'month')).toBe('');
      expect(datePartCaption(undefined, 'quarter')).toBe('');
    });

    it('stringifies the value for plain parts', () => {
      expect(datePartCaption(2024, 'year')).toBe('2024');
      expect(datePartCaption('2024-03-09', 'date')).toBe('2024-03-09');
      expect(datePartCaption(42, 'week')).toBe('42');
      expect(datePartCaption(13, 'hour')).toBe('13');
    });

    it('round-trips datePartValue -> datePartCaption for named parts', () => {
      const date = new Date(2024, 2, 9, 13, 45, 7); // Saturday, March
      const monthVal = datePartValue(date, 'month');
      expect(datePartCaption(monthVal, 'month')).toBe('March');
      const weekdayVal = datePartValue(date, 'weekday');
      expect(datePartCaption(weekdayVal, 'weekday')).toBe('Saturday');
      const quarterVal = datePartValue(date, 'quarter');
      expect(datePartCaption(quarterVal, 'quarter')).toBe('Q1');
    });
  });

  /* ------------------------------------------------------------------ */
  /* isoWeek correctness via the 'week' part                             */
  /* ------------------------------------------------------------------ */
  describe('ISO week correctness', () => {
    it('2024-01-01 (a Monday) is ISO week 1', () => {
      expect(datePartValue(new Date(2024, 0, 1), 'week')).toBe(1);
    });

    it('2023-01-01 (a Sunday) belongs to ISO week 52 of the prior year', () => {
      // The Sunday 2023-01-01 is part of the last ISO week of 2022 (week 52).
      expect(datePartValue(new Date(2023, 0, 1), 'week')).toBe(52);
    });

    it('2021-01-04 (a Monday) is ISO week 1', () => {
      expect(datePartValue(new Date(2021, 0, 4), 'week')).toBe(1);
    });

    it('2020-12-31 falls in ISO week 53 (2020 is a 53-week year)', () => {
      expect(datePartValue(new Date(2020, 11, 31), 'week')).toBe(53);
    });

    it('mid-year week matches the reference algorithm', () => {
      const d = new Date(2024, 5, 18); // 2024-06-18
      expect(datePartValue(d, 'week')).toBe(expectedIsoWeek(2024, 6, 18));
    });
  });

  /* ------------------------------------------------------------------ */
  /* MONTH_NAMES / WEEKDAY_NAMES                                          */
  /* ------------------------------------------------------------------ */
  describe('name tables', () => {
    it('MONTH_NAMES has 12 entries in calendar order', () => {
      expect(MONTH_NAMES).toHaveLength(12);
      expect(MONTH_NAMES[0]).toBe('January');
      expect(MONTH_NAMES[11]).toBe('December');
    });

    it('WEEKDAY_NAMES has 7 entries starting on Sunday', () => {
      expect(WEEKDAY_NAMES).toHaveLength(7);
      expect(WEEKDAY_NAMES[0]).toBe('Sunday');
      expect(WEEKDAY_NAMES[6]).toBe('Saturday');
    });
  });
});
