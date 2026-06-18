import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT,
  formatDate,
  formatValue,
  resolveFormat,
} from './format';
import type { NumberFormat } from '../types';

describe('resolveFormat', () => {
  it('returns full defaults when no format is provided', () => {
    const f = resolveFormat();
    expect(f.name).toBe('');
    // decimalPlaces is intentionally left undefined so formatValue can
    // fall back to maxDecimalPlaces / 2.
    expect(f.decimalPlaces).toBeUndefined();
    expect(f.decimalSeparator).toBe('.');
    expect(f.thousandsSeparator).toBe(',');
    expect(f.currencySymbol).toBe('');
    expect(f.currencySymbolAlign).toBe('left');
    expect(f.isPercent).toBe(false);
    expect(f.negativeFormat).toBe('minus');
    expect(f.nullValue).toBe('');
    expect(f.infinityValue).toBe('');
    expect(f.maxDecimalPlaces).toBeUndefined();
    expect(f.dateTimePattern).toBeUndefined();
    expect(f.textAlign).toBeUndefined();
  });

  it('preserves explicitly provided values', () => {
    const input: NumberFormat = {
      name: 'currency',
      decimalPlaces: 0,
      decimalSeparator: ',',
      thousandsSeparator: '.',
      currencySymbol: '€',
      currencySymbolAlign: 'right',
      isPercent: true,
      negativeFormat: 'parentheses',
      nullValue: 'n/a',
      infinityValue: 'ERR',
      maxDecimalPlaces: 4,
      dateTimePattern: 'yyyy-MM-dd',
      textAlign: 'center',
    };
    expect(resolveFormat(input)).toEqual(input);
  });

  it('keeps an empty-string thousandsSeparator (not coerced to default)', () => {
    // '' is not nullish, so ?? must NOT replace it with ','.
    expect(resolveFormat({ name: '', thousandsSeparator: '' }).thousandsSeparator).toBe('');
  });

  it('keeps decimalPlaces of 0 (falsy but defined)', () => {
    expect(resolveFormat({ name: '', decimalPlaces: 0 }).decimalPlaces).toBe(0);
  });

  it('DEFAULT_FORMAT constant exposes the canonical defaults', () => {
    expect(DEFAULT_FORMAT).toEqual({
      name: '',
      decimalPlaces: 2,
      decimalSeparator: '.',
      thousandsSeparator: ',',
    });
  });
});

describe('formatValue - decimalPlaces', () => {
  it('defaults to 2 decimal places when nothing is specified', () => {
    expect(formatValue(1234.5)).toBe('1,234.50');
    expect(formatValue(1)).toBe('1.00');
  });

  it('honors an explicit decimalPlaces and rounds', () => {
    expect(formatValue(1.236, { name: '', decimalPlaces: 2 })).toBe('1.24');
    expect(formatValue(1.234, { name: '', decimalPlaces: 2 })).toBe('1.23');
    expect(formatValue(1.5, { name: '', decimalPlaces: 0 })).toBe('2');
  });

  it('decimalPlaces of 0 produces no fractional part or separator', () => {
    expect(formatValue(1234.99, { name: '', decimalPlaces: 0 })).toBe('1,235');
  });

  it('supports more decimals than the value has', () => {
    expect(formatValue(1.5, { name: '', decimalPlaces: 4 })).toBe('1.5000');
  });

  it('falls back to maxDecimalPlaces when decimalPlaces is absent', () => {
    // decimalPlaces undefined + maxDecimalPlaces=3 -> toFixed(3) then trimmed.
    expect(formatValue(1.23456, { name: '', maxDecimalPlaces: 3 })).toBe('1.235');
    // Trailing zeros get trimmed via parseFloat.
    expect(formatValue(1.5, { name: '', maxDecimalPlaces: 3 })).toBe('1.5');
    expect(formatValue(2, { name: '', maxDecimalPlaces: 3 })).toBe('2');
  });

  it('caps maxDecimalPlaces at 10', () => {
    // min(20, 10) = 10 decimals, then parseFloat trims trailing zeros.
    expect(formatValue(1.5, { name: '', maxDecimalPlaces: 20 })).toBe('1.5');
  });

  it('explicit decimalPlaces wins over maxDecimalPlaces', () => {
    expect(
      formatValue(1.23456, { name: '', decimalPlaces: 2, maxDecimalPlaces: 5 }),
    ).toBe('1.23');
  });
});

describe('formatValue - thousandsSeparator', () => {
  it('groups thousands with a comma by default', () => {
    expect(formatValue(1000, { name: '', decimalPlaces: 0 })).toBe('1,000');
    expect(formatValue(1234567, { name: '', decimalPlaces: 0 })).toBe('1,234,567');
  });

  it('does not group values under one thousand', () => {
    expect(formatValue(999, { name: '', decimalPlaces: 0 })).toBe('999');
  });

  it('only groups the integer part, not the fraction', () => {
    expect(formatValue(1234.5678, { name: '', decimalPlaces: 4 })).toBe('1,234.5678');
  });

  it('uses a custom thousands separator', () => {
    expect(formatValue(1234567, { name: '', decimalPlaces: 0, thousandsSeparator: ' ' })).toBe(
      '1 234 567',
    );
  });

  it('disables grouping when thousandsSeparator is empty', () => {
    expect(formatValue(1234567, { name: '', decimalPlaces: 0, thousandsSeparator: '' })).toBe(
      '1234567',
    );
  });
});

describe('formatValue - decimalSeparator', () => {
  it('uses a custom decimal separator', () => {
    expect(formatValue(1234.56, { name: '', decimalPlaces: 2, decimalSeparator: ',' })).toBe(
      '1,234,56',
    );
  });

  it('combines European style separators (dot thousands, comma decimal)', () => {
    expect(
      formatValue(1234567.89, {
        name: '',
        decimalPlaces: 2,
        decimalSeparator: ',',
        thousandsSeparator: '.',
      }),
    ).toBe('1.234.567,89');
  });
});

describe('formatValue - currencySymbol', () => {
  it('places the symbol on the left by default', () => {
    expect(formatValue(1234.5, { name: '', decimalPlaces: 2, currencySymbol: '$' })).toBe(
      '$1,234.50',
    );
  });

  it('places the symbol on the right when aligned right', () => {
    expect(
      formatValue(1234.5, {
        name: '',
        decimalPlaces: 2,
        currencySymbol: '€',
        currencySymbolAlign: 'right',
      }),
    ).toBe('1,234.50€');
  });

  it('puts the minus sign outside the currency symbol for negatives', () => {
    expect(
      formatValue(-50, { name: '', decimalPlaces: 0, currencySymbol: '$' }),
    ).toBe('-$50');
  });

  it('wraps the symbol inside parentheses for negative parentheses format', () => {
    expect(
      formatValue(-50, {
        name: '',
        decimalPlaces: 0,
        currencySymbol: '$',
        negativeFormat: 'parentheses',
      }),
    ).toBe('($50)');
  });
});

describe('formatValue - isPercent', () => {
  it('multiplies by 100 and appends a percent sign', () => {
    expect(formatValue(0.5, { name: '', decimalPlaces: 2, isPercent: true })).toBe('50.00%');
    expect(formatValue(0.1234, { name: '', decimalPlaces: 1, isPercent: true })).toBe('12.3%');
  });

  it('handles 100% and values above 100%', () => {
    expect(formatValue(1, { name: '', decimalPlaces: 0, isPercent: true })).toBe('100%');
    expect(formatValue(2.5, { name: '', decimalPlaces: 0, isPercent: true })).toBe('250%');
  });

  it('applies the percent sign before the currency symbol position logic', () => {
    // Percent + currency: body becomes "50.00%" then symbol prepends.
    expect(
      formatValue(0.5, {
        name: '',
        decimalPlaces: 2,
        isPercent: true,
        currencySymbol: '$',
      }),
    ).toBe('$50.00%');
  });

  it('formats negative percentages with the minus outside', () => {
    expect(formatValue(-0.5, { name: '', decimalPlaces: 0, isPercent: true })).toBe('-50%');
  });
});

describe('formatValue - negativeFormat', () => {
  it('uses a leading minus by default', () => {
    expect(formatValue(-1234.5, { name: '', decimalPlaces: 2 })).toBe('-1,234.50');
  });

  it('uses a leading minus explicitly', () => {
    expect(
      formatValue(-1234.5, { name: '', decimalPlaces: 2, negativeFormat: 'minus' }),
    ).toBe('-1,234.50');
  });

  it('wraps negatives in parentheses', () => {
    expect(
      formatValue(-1234.5, { name: '', decimalPlaces: 2, negativeFormat: 'parentheses' }),
    ).toBe('(1,234.50)');
  });

  it('treats redMinus the same as minus (leading sign)', () => {
    expect(
      formatValue(-1234.5, { name: '', decimalPlaces: 2, negativeFormat: 'redMinus' }),
    ).toBe('-1,234.50');
  });

  it('does not add a sign for positive values', () => {
    expect(
      formatValue(1234.5, { name: '', decimalPlaces: 2, negativeFormat: 'parentheses' }),
    ).toBe('1,234.50');
  });

  it('treats zero as non-negative (no sign / parentheses)', () => {
    expect(formatValue(0, { name: '', decimalPlaces: 2, negativeFormat: 'parentheses' })).toBe(
      '0.00',
    );
    expect(formatValue(0, { name: '', decimalPlaces: 2 })).toBe('0.00');
  });
});

describe('formatValue - null / empty handling', () => {
  it('returns the default empty string for null', () => {
    expect(formatValue(null)).toBe('');
  });

  it('returns the default empty string for undefined', () => {
    expect(formatValue(undefined)).toBe('');
  });

  it('returns the default empty string for an empty string', () => {
    expect(formatValue('')).toBe('');
  });

  it('returns a custom nullValue for null', () => {
    expect(formatValue(null, { name: '', nullValue: 'N/A' })).toBe('N/A');
  });

  it('returns a custom nullValue for undefined', () => {
    expect(formatValue(undefined, { name: '', nullValue: '—' })).toBe('—');
  });

  it('returns a custom nullValue for an empty string', () => {
    expect(formatValue('', { name: '', nullValue: 'blank' })).toBe('blank');
  });

  it('does NOT treat 0 as null', () => {
    expect(formatValue(0, { name: '', nullValue: 'N/A', decimalPlaces: 0 })).toBe('0');
  });
});

describe('formatValue - Infinity handling', () => {
  it('renders positive Infinity as the infinity glyph by default', () => {
    expect(formatValue(Infinity)).toBe('∞');
  });

  it('renders negative Infinity as the negative infinity glyph by default', () => {
    expect(formatValue(-Infinity)).toBe('-∞');
  });

  it('uses a custom infinityValue when provided', () => {
    expect(formatValue(Infinity, { name: '', infinityValue: 'ERR' })).toBe('ERR');
    expect(formatValue(-Infinity, { name: '', infinityValue: 'ERR' })).toBe('ERR');
  });

  it('returns NaN as a plain string (non-finite NaN path)', () => {
    expect(formatValue(NaN)).toBe('NaN');
  });
});

describe('formatValue - Date values', () => {
  it('formats a Date with a dateTimePattern', () => {
    const d = new Date(2023, 0, 5, 9, 7, 3); // 2023-01-05 09:07:03 local
    expect(formatValue(d, { name: '', dateTimePattern: 'yyyy-MM-dd' })).toBe('2023-01-05');
    expect(formatValue(d, { name: '', dateTimePattern: 'yyyy-MM-dd HH:mm:ss' })).toBe(
      '2023-01-05 09:07:03',
    );
  });

  it('falls back to toLocaleString when no dateTimePattern is given', () => {
    const d = new Date(2023, 0, 5, 9, 7, 3);
    expect(formatValue(d)).toBe(d.toLocaleString());
  });
});

describe('formatValue - non-numeric pass-through', () => {
  it('returns a non-numeric string unchanged', () => {
    expect(formatValue('abc')).toBe('abc');
    expect(formatValue('hello world')).toBe('hello world');
  });

  it('coerces a numeric string and formats it', () => {
    expect(formatValue('1234.5')).toBe('1,234.50');
  });

  it('renders booleans as their literal text', () => {
    expect(formatValue(true)).toBe('true');
    expect(formatValue(false)).toBe('false');
  });
});

describe('formatDate', () => {
  const d = new Date(2023, 0, 9, 8, 5, 4); // 2023-01-09 08:05:04 local

  it('replaces yyyy with the full year', () => {
    expect(formatDate(d, 'yyyy')).toBe('2023');
  });

  it('replaces yy with the two-digit year', () => {
    expect(formatDate(d, 'yy')).toBe('23');
  });

  it('replaces MM with the zero-padded month (1-based)', () => {
    expect(formatDate(d, 'MM')).toBe('01');
    expect(formatDate(new Date(2023, 11, 1), 'MM')).toBe('12');
  });

  it('replaces dd with the zero-padded day of month', () => {
    expect(formatDate(d, 'dd')).toBe('09');
  });

  it('replaces HH with the zero-padded 24h hours', () => {
    expect(formatDate(d, 'HH')).toBe('08');
    expect(formatDate(new Date(2023, 0, 1, 23), 'HH')).toBe('23');
  });

  it('replaces mm with the zero-padded minutes', () => {
    expect(formatDate(d, 'mm')).toBe('05');
  });

  it('replaces ss with the zero-padded seconds', () => {
    expect(formatDate(d, 'ss')).toBe('04');
  });

  it('formats a full pattern with separators preserved', () => {
    expect(formatDate(d, 'yyyy-MM-dd HH:mm:ss')).toBe('2023-01-09 08:05:04');
  });

  it('handles multiple occurrences of the same token (global replace)', () => {
    expect(formatDate(d, 'yyyy/yyyy')).toBe('2023/2023');
  });

  it('leaves unknown characters in the pattern untouched', () => {
    expect(formatDate(d, 'Year yyyy!')).toBe('Year 2023!');
  });
});
