import { describe, it, expect } from 'vitest';
import { applyTokens, applyFilterTokens } from './theme';

describe('applyTokens', () => {
  it('maps typed tokens to --ph-* custom properties', () => {
    const el = document.createElement('div');
    applyTokens(el, { accent: '#f00', headerBackground: '#eee', radius: 8 });
    expect(el.style.getPropertyValue('--ph-accent')).toBe('#f00');
    expect(el.style.getPropertyValue('--ph-bg-header')).toBe('#eee');
    // numeric radius → px
    expect(el.style.getPropertyValue('--ph-radius')).toBe('8px');
  });

  it('skips null/undefined token values', () => {
    const el = document.createElement('div');
    applyTokens(el, { accent: undefined, foreground: '#111' });
    expect(el.style.getPropertyValue('--ph-accent')).toBe('');
    expect(el.style.getPropertyValue('--ph-fg')).toBe('#111');
  });

  it('applies nested filters tokens as --ph-filter-* properties', () => {
    const el = document.createElement('div');
    applyTokens(el, {
      filters: {
        chipBackground: '#fff1f2',
        chipForeground: '#e11d48',
        chipRadius: 8,
        chipFontSize: 12,
        chipFontWeight: 600,
        gap: 10,
      },
    });
    expect(el.style.getPropertyValue('--ph-filter-chip-bg')).toBe('#fff1f2');
    expect(el.style.getPropertyValue('--ph-filter-chip-fg')).toBe('#e11d48');
    // length-like numbers → px
    expect(el.style.getPropertyValue('--ph-filter-chip-radius')).toBe('8px');
    expect(el.style.getPropertyValue('--ph-filter-chip-font-size')).toBe('12px');
    expect(el.style.getPropertyValue('--ph-filter-gap')).toBe('10px');
    // weight stays unitless
    expect(el.style.getPropertyValue('--ph-filter-chip-font-weight')).toBe('600');
  });

  it('does not emit a --ph-undefined property for the filters key', () => {
    const el = document.createElement('div');
    applyTokens(el, { accent: '#f00', filters: { chipBackground: '#abc' } });
    expect(el.style.getPropertyValue('--ph-undefined')).toBe('');
    expect(el.style.getPropertyValue('--ph-filter-chip-bg')).toBe('#abc');
  });
});

describe('applyFilterTokens', () => {
  it('accepts string values verbatim', () => {
    const el = document.createElement('div');
    applyFilterTokens(el, { chipRadius: '0.5rem', barPadding: '8px 12px' });
    expect(el.style.getPropertyValue('--ph-filter-chip-radius')).toBe('0.5rem');
    expect(el.style.getPropertyValue('--ph-filter-bar-padding')).toBe('8px 12px');
  });
});
