import { describe, expect, it } from 'vitest';
import { clearInternCache, pathKey, prefixKeys } from './tree';

const seg = (value: unknown) => ({ uniqueName: 'f', value: value as never });

describe('member-token interning (shared-items cache)', () => {
  it('is deterministic and collision-free', () => {
    const a = pathKey([seg('USA'), seg('West')]);
    const b = pathKey([seg('USA'), seg('West')]);
    const c = pathKey([seg('USA'), seg('East')]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('avoids prefix-concatenation collisions', () => {
    // With a real delimiter, "1"+"23" must not collide with "12"+"3".
    const k1 = pathKey([seg('1'), seg('23')]);
    const k2 = pathKey([seg('12'), seg('3')]);
    expect(k1).not.toBe(k2);
  });

  it('distinguishes the number 1 from the string "1"', () => {
    expect(pathKey([seg(1)])).not.toBe(pathKey([seg('1')]));
  });

  it('prefixKeys yields the cumulative prefixes ending at the leaf key', () => {
    const vals = ['USA', 'West', 'LA'];
    const keys = prefixKeys(vals);
    expect(keys[0]).toBe(''); // grand total
    expect(keys).toHaveLength(vals.length + 1);
    expect(keys[keys.length - 1]).toBe(pathKey(vals.map(seg)));
  });

  it('clearInternCache resets the dictionary reproducibly', () => {
    clearInternCache();
    const k1 = pathKey([seg('X'), seg('Y')]);
    clearInternCache();
    const k2 = pathKey([seg('X'), seg('Y')]);
    expect(k2).toBe(k1);
  });
});
