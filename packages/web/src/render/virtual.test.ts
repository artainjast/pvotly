import { describe, expect, it } from 'vitest';
import { cumulativeOffsets, windowUniform, windowVariable } from './virtual';

describe('windowUniform', () => {
  it('windows a uniform list to the visible viewport + overscan', () => {
    const w = windowUniform(1000, 30, 600, 300, 2);
    // first visible row = floor(600/30)=20, minus overscan 2 => 18
    expect(w.start).toBe(18);
    // last = ceil((600+300)/30)=30 + 2 => 32
    expect(w.end).toBe(32);
    expect(w.before).toBe(18 * 30);
    expect(w.after).toBe((1000 - 32) * 30);
  });

  it('clamps to bounds at the top', () => {
    const w = windowUniform(1000, 30, 0, 300, 4);
    expect(w.start).toBe(0);
    expect(w.before).toBe(0);
  });

  it('returns the full range for an empty/zero-height list', () => {
    expect(windowUniform(0, 30, 0, 300, 4)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    expect(windowUniform(10, 0, 0, 300, 4)).toEqual({ start: 0, end: 10, before: 0, after: 0 });
  });
});

describe('windowVariable', () => {
  it('windows variable-width columns honoring a frozen lead zone', () => {
    const widths = Array.from({ length: 100 }, () => 50); // 5000px total
    const offsets = cumulativeOffsets(widths);
    expect(offsets[100]).toBe(5000);
    // scroll 1000, viewport 400, lead 0, no overscan
    const w = windowVariable(offsets, 1000, 400, 0, 0);
    expect(w.start).toBe(20); // 1000/50
    expect(w.end).toBe(28); // up to 1400/50
    expect(w.before).toBe(1000);
    expect(w.after).toBe(5000 - 28 * 50);
  });

  it('skips columns hidden behind the frozen lead', () => {
    const widths = Array.from({ length: 20 }, () => 100);
    const offsets = cumulativeOffsets(widths);
    const w = windowVariable(offsets, 0, 300, 200, 0);
    // dead-zone of 200px means first two columns are covered
    expect(w.start).toBe(2);
  });
});
