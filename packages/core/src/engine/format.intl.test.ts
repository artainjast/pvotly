import { describe, expect, it } from 'vitest';
import { formatValue, formatDateIntl } from './format';
import type { NumberFormat } from '../types';

describe('formatValue: Intl number path', () => {
  it('formats currency with locale grouping', () => {
    const f: NumberFormat = { name: 'usd', style: 'currency', currency: 'USD', locale: 'en-US' };
    expect(formatValue(1234.5, f)).toBe('$1,234.50');
  });

  it('formats percent (value is a ratio, Intl multiplies by 100)', () => {
    const f: NumberFormat = { name: 'pct', style: 'percent', locale: 'en-US' };
    expect(formatValue(0.25, f)).toBe('25%');
  });

  it('formats grouped decimals', () => {
    const f: NumberFormat = { name: 'dec', style: 'decimal', locale: 'en-US' };
    expect(formatValue(1234567, f)).toBe('1,234,567');
  });

  it('honors min/max fraction digits', () => {
    const f: NumberFormat = {
      name: 'd',
      style: 'decimal',
      locale: 'en-US',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
    expect(formatValue(3.14159, f)).toBe('3.14');
  });

  it('maps decimalPlaces onto Intl fraction digits', () => {
    const f: NumberFormat = { name: 'd', style: 'decimal', locale: 'en-US', decimalPlaces: 3 };
    expect(formatValue(2, f)).toBe('2.000');
  });

  it('uses currency when only a currency code is provided (implies Intl)', () => {
    const f: NumberFormat = { name: 'eur', currency: 'EUR', locale: 'de-DE' };
    // de-DE EUR: "1.234,50 €" — assert the key parts to stay ICU-version tolerant.
    const out = formatValue(1234.5, f);
    expect(out).toContain('€');
    expect(out).toContain('1.234,50');
  });

  it('uses the grid-wide locale fallback argument', () => {
    const f: NumberFormat = { name: 'c', style: 'currency', currency: 'USD' };
    expect(formatValue(1000, f, 'en-US')).toBe('$1,000.00');
  });
});

describe('formatValue: Intl date path + backward compat', () => {
  it('formats dates via Intl.DateTimeFormat options', () => {
    const f: NumberFormat = {
      name: 'dt',
      dateTimeFormat: { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' },
      locale: 'en-US',
    };
    const d = new Date(Date.UTC(2023, 0, 15));
    expect(formatValue(d, f)).toBe('Jan 15, 2023');
    expect(formatDateIntl(d, f)).toBe('Jan 15, 2023');
  });

  it('keeps the legacy manual formatter when Intl is not opted into', () => {
    expect(formatValue(1234.5, { name: '', decimalPlaces: 2 })).toBe('1,234.50');
    expect(formatValue(-1234.5, { name: '', decimalPlaces: 2, negativeFormat: 'parentheses' })).toBe(
      '(1,234.50)',
    );
  });
});
