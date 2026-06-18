/** Pure windowing math for the virtualized renderer. */

export interface Window {
  /** First index to render (inclusive). */
  start: number;
  /** Last index to render (exclusive). */
  end: number;
  /** Pixels of spacer before `start`. */
  before: number;
  /** Pixels of spacer after `end`. */
  after: number;
}

/** Window a uniform-height list (rows). */
export function windowUniform(
  count: number,
  itemHeight: number,
  scroll: number,
  viewport: number,
  overscan: number,
): Window {
  if (count === 0 || itemHeight <= 0) return { start: 0, end: count, before: 0, after: 0 };
  let start = Math.floor(scroll / itemHeight) - overscan;
  let end = Math.ceil((scroll + viewport) / itemHeight) + overscan;
  start = Math.max(0, start);
  end = Math.min(count, Math.max(end, start + 1));
  return {
    start,
    end,
    before: start * itemHeight,
    after: (count - end) * itemHeight,
  };
}

/** Cumulative offsets for a variable-width list. `offsets` has length n+1. */
export function cumulativeOffsets(widths: number[]): number[] {
  const offsets = new Array<number>(widths.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < widths.length; i++) offsets[i + 1] = offsets[i]! + widths[i]!;
  return offsets;
}

/**
 * Window a variable-width list (columns) given the visible scroll span
 * `[scroll, scroll + viewport]` and a leading dead-zone (frozen columns) of
 * `lead` pixels that always cover the start of the viewport.
 */
export function windowVariable(
  offsets: number[],
  scroll: number,
  viewport: number,
  lead: number,
  overscanPx: number,
): Window {
  const count = offsets.length - 1;
  if (count === 0) return { start: 0, end: 0, before: 0, after: 0 };
  const total = offsets[count]!;
  const viewStart = scroll + lead - overscanPx;
  const viewEnd = scroll + viewport + overscanPx;

  let start = 0;
  while (start < count && offsets[start + 1]! <= viewStart) start++;
  let end = start;
  while (end < count && offsets[end]! < viewEnd) end++;
  end = Math.max(end, start + 1);
  end = Math.min(end, count);

  return {
    start,
    end,
    before: offsets[start]!,
    after: total - offsets[end]!,
  };
}
