import type { DataValue, DatePart } from '../types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Coerce an arbitrary value to a Date, or null if it isn't date-like. */
export function toDate(value: DataValue): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** ISO week number (1-53). */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Extract the raw, sortable value of a date part. Numeric parts return numbers
 * so members order naturally; named parts (monthName/weekday) return strings.
 */
export function datePartValue(date: Date, part: DatePart): DataValue {
  switch (part) {
    case 'year':
      return date.getFullYear();
    case 'quarter':
      return Math.floor(date.getMonth() / 3) + 1;
    case 'month':
      return date.getMonth() + 1;
    case 'monthName':
      return MONTH_NAMES[date.getMonth()];
    case 'week':
      return isoWeek(date);
    case 'dayOfMonth':
      return date.getDate();
    case 'weekday':
      return date.getDay();
    case 'date':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case 'hour':
      return date.getHours();
    case 'minute':
      return date.getMinutes();
    case 'second':
      return date.getSeconds();
    default:
      return null;
  }
}

/** Human caption for a date-part value. */
export function datePartCaption(value: DataValue, part: DatePart): string {
  if (value == null) return '';
  switch (part) {
    case 'quarter':
      return `Q${value}`;
    case 'month':
      return MONTH_NAMES[(Number(value) || 1) - 1] ?? String(value);
    case 'weekday':
      return WEEKDAY_NAMES[Number(value)] ?? String(value);
    default:
      return String(value);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export { MONTH_NAMES, WEEKDAY_NAMES };
