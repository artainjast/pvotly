import type { DataValue, NumberFormat } from '../types';

export const DEFAULT_FORMAT: Required<
  Pick<NumberFormat, 'name' | 'decimalPlaces' | 'decimalSeparator' | 'thousandsSeparator'>
> = {
  name: '',
  decimalPlaces: 2,
  decimalSeparator: '.',
  thousandsSeparator: ',',
};

/** Resolve a (possibly partial) format against sensible defaults. */
export function resolveFormat(format?: NumberFormat): NumberFormat {
  return {
    name: format?.name ?? '',
    decimalPlaces: format?.decimalPlaces,
    decimalSeparator: format?.decimalSeparator ?? '.',
    thousandsSeparator: format?.thousandsSeparator ?? ',',
    currencySymbol: format?.currencySymbol ?? '',
    currencySymbolAlign: format?.currencySymbolAlign ?? 'left',
    isPercent: format?.isPercent ?? false,
    negativeFormat: format?.negativeFormat ?? 'minus',
    nullValue: format?.nullValue ?? '',
    infinityValue: format?.infinityValue ?? '',
    maxDecimalPlaces: format?.maxDecimalPlaces,
    dateTimePattern: format?.dateTimePattern,
    textAlign: format?.textAlign,
    // Intl passthrough (undefined unless explicitly set).
    intl: format?.intl,
    locale: format?.locale,
    style: format?.style,
    currency: format?.currency,
    currencyDisplay: format?.currencyDisplay,
    minimumFractionDigits: format?.minimumFractionDigits,
    maximumFractionDigits: format?.maximumFractionDigits,
    useGrouping: format?.useGrouping,
    dateTimeFormat: format?.dateTimeFormat,
  };
}

/* -------------------------------------------------------------------------- */
/* Intl-based formatting (opt-in)                                             */
/* -------------------------------------------------------------------------- */

/** True when a (resolved) format should use `Intl.NumberFormat` for numbers. */
function numberUsesIntl(f: NumberFormat): boolean {
  return Boolean(f.intl || f.style || f.currency);
}

/** True when a (resolved) format should use `Intl.DateTimeFormat` for dates. */
function dateUsesIntl(f: NumberFormat): boolean {
  return Boolean(f.intl || f.dateTimeFormat);
}

// `Intl.NumberFormat` construction is comparatively expensive and the grid
// formats one cell at a time, so memoize instances by locale + options.
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function intlNumberOptions(f: NumberFormat): Intl.NumberFormatOptions {
  const opts: Intl.NumberFormatOptions = {};
  if (f.style) opts.style = f.style;
  else if (f.currency) opts.style = 'currency';
  if (opts.style === 'currency') opts.currency = f.currency || 'USD';
  if (f.currencyDisplay) opts.currencyDisplay = f.currencyDisplay;

  if (f.minimumFractionDigits != null) opts.minimumFractionDigits = f.minimumFractionDigits;
  if (f.maximumFractionDigits != null) opts.maximumFractionDigits = f.maximumFractionDigits;
  // A single `decimalPlaces` pins both bounds when neither is given explicitly.
  if (f.decimalPlaces != null && f.minimumFractionDigits == null && f.maximumFractionDigits == null) {
    opts.minimumFractionDigits = f.decimalPlaces;
    opts.maximumFractionDigits = f.decimalPlaces;
  }
  if (f.useGrouping != null) opts.useGrouping = f.useGrouping;
  // Approximate the manual `parentheses` negative style for currency.
  if (f.negativeFormat === 'parentheses' && opts.style === 'currency') {
    opts.currencySign = 'accounting';
  }
  return opts;
}

function getNumberFormatter(f: NumberFormat, locale?: string): Intl.NumberFormat {
  const loc = f.locale || locale || '';
  const opts = intlNumberOptions(f);
  const cacheKey = `${loc}\u0000${JSON.stringify(opts)}`;
  let fmt = numberFormatCache.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.NumberFormat(loc || undefined, opts);
    numberFormatCache.set(cacheKey, fmt);
  }
  return fmt;
}

function getDateFormatter(f: NumberFormat, locale?: string): Intl.DateTimeFormat {
  const loc = f.locale || locale || '';
  const opts = f.dateTimeFormat ?? {};
  const cacheKey = `${loc}\u0000${JSON.stringify(opts)}`;
  let fmt = dateFormatCache.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(loc || undefined, opts);
    dateFormatCache.set(cacheKey, fmt);
  }
  return fmt;
}

/**
 * Format a date with `Intl.DateTimeFormat`, honoring a per-format or grid-wide
 * locale and {@link NumberFormat.dateTimeFormat} options.
 */
export function formatDateIntl(date: Date, format?: NumberFormat, locale?: string): string {
  return getDateFormatter(resolveFormat(format), locale).format(date);
}

function groupThousands(intPart: string, separator: string): string {
  if (!separator) return intPart;
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Format a measure value into a display string according to a number format.
 * Non-numeric values are stringified as-is (apart from null handling).
 *
 * Backward compatible: when the format does not opt into Intl (no `style`,
 * `currency`, `dateTimeFormat` or `intl: true`) the original manual formatter is
 * used. `locale` is the grid-wide BCP-47 locale fallback for the Intl path.
 */
export function formatValue(value: number | DataValue, format?: NumberFormat, locale?: string): string {
  const f = resolveFormat(format);

  if (value == null || value === '') return f.nullValue ?? '';

  // Date measures (first/last/none on date fields).
  if (value instanceof Date) {
    if (dateUsesIntl(f)) return getDateFormatter(f, locale).format(value);
    if (f.dateTimePattern) return formatDate(value, f.dateTimePattern);
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  let num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);

  if (!Number.isFinite(num)) return f.infinityValue || (num > 0 ? '∞' : '-∞');

  // Intl number path (currency / percent / decimal with locale grouping).
  if (numberUsesIntl(f)) {
    return getNumberFormatter(f, locale).format(num);
  }

  if (f.isPercent) num *= 100;

  const negative = num < 0;
  const abs = Math.abs(num);

  const decimals =
    f.decimalPlaces ?? (f.maxDecimalPlaces != null ? Math.min(f.maxDecimalPlaces, 10) : 2);

  let fixed = abs.toFixed(Math.max(0, decimals));

  // Trim to maxDecimalPlaces if only that was provided. Guard against very large
  // magnitudes where String(parseFloat()) yields exponential notation ("1e+21"),
  // which the split/grouping below would then mangle — keep the fixed form there.
  if (f.decimalPlaces == null && f.maxDecimalPlaces != null) {
    const trimmed = parseFloat(fixed);
    if (Math.abs(trimmed) < 1e21) fixed = String(trimmed);
  }

  const [intPartRaw, fracPart = ''] = fixed.split('.');
  const intPart = groupThousands(intPartRaw!, f.thousandsSeparator!);
  let body = fracPart ? `${intPart}${f.decimalSeparator}${fracPart}` : intPart;

  if (f.isPercent) body += '%';

  const symbol = f.currencySymbol ?? '';
  if (symbol) {
    body = f.currencySymbolAlign === 'right' ? `${body}${symbol}` : `${symbol}${body}`;
  }

  if (!negative) return body;

  switch (f.negativeFormat) {
    case 'parentheses':
      return `(${body})`;
    case 'redMinus':
    case 'minus':
    default:
      return `-${body}`;
  }
}

const DATE_TOKENS: Array<[RegExp, (d: Date) => string]> = [
  [/yyyy/g, (d) => String(d.getFullYear())],
  [/yy/g, (d) => String(d.getFullYear()).slice(-2)],
  [/MM/g, (d) => String(d.getMonth() + 1).padStart(2, '0')],
  [/dd/g, (d) => String(d.getDate()).padStart(2, '0')],
  [/HH/g, (d) => String(d.getHours()).padStart(2, '0')],
  [/mm/g, (d) => String(d.getMinutes()).padStart(2, '0')],
  [/ss/g, (d) => String(d.getSeconds()).padStart(2, '0')],
];

/** Tiny date pattern formatter (yyyy, yy, MM, dd, HH, mm, ss). */
export function formatDate(date: Date, pattern: string): string {
  let out = pattern;
  for (const [token, fn] of DATE_TOKENS) {
    out = out.replace(token, fn(date));
  }
  return out;
}
