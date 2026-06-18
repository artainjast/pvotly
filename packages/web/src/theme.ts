/** Built-in theme names. Custom themes can be applied via any string + CSS. */
export type ThemeName = 'light' | 'dark' | (string & {});

/** Apply a theme by setting the `data-ph-theme` attribute on the root element. */
export function applyTheme(root: HTMLElement, theme: ThemeName): void {
  root.setAttribute('data-ph-theme', theme);
}

/**
 * Override theme tokens at runtime by writing CSS custom properties onto the
 * root. Keys are token names without the `--ph-` prefix (e.g. `accent`).
 */
export function setThemeTokens(root: HTMLElement, tokens: Record<string, string>): void {
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--ph-${key}`, value);
  }
}

/**
 * Strongly-typed style tokens. Pass these as the `tokens` prop/option to restyle
 * the widget without writing any CSS. Each maps to a `--ph-*` custom property.
 */
export interface ThemeTokens {
  /** Primary accent (buttons, links, active states). */
  accent?: string;
  /** Foreground/text color on accent surfaces. */
  accentForeground?: string;
  /** Body text color. */
  foreground?: string;
  /** Muted/secondary text color. */
  mutedForeground?: string;
  /** Grid background. */
  background?: string;
  /** Alternate background (toolbar, panels). */
  altBackground?: string;
  /** Header cell background. */
  headerBackground?: string;
  /** Border color. */
  border?: string;
  /** Stronger border (hover/focus). */
  borderStrong?: string;
  /** Subtotal cell background. */
  subtotalBackground?: string;
  /** Grand-total cell background. */
  grandTotalBackground?: string;
  /** Row/cell hover background. */
  hoverBackground?: string;
  /** Popover/dialog shadow. */
  shadow?: string;
  /** Font family. */
  fontFamily?: string;
  /** Base font size (e.g. '13px'). */
  fontSize?: string;
  /** Corner radius — number is treated as px. */
  radius?: string | number;
  /** Report-filter bar / chip styling. Restyle filters without writing CSS. */
  filters?: FilterStyleTokens;
}

/**
 * Style tokens for the report-filter bar and its chips. Pass under
 * {@link ThemeTokens.filters}. Numeric values for length-like fields
 * (`gap`, `chipRadius`, `chipFontSize`) are treated as px; weights stay
 * unitless.
 */
export interface FilterStyleTokens {
  /** Filter bar background. */
  barBackground?: string;
  /** Filter bar bottom border color. */
  barBorder?: string;
  /** Filter bar padding (e.g. '6px 8px'). */
  barPadding?: string;
  /** Gap between chips. */
  gap?: string | number;
  /** Chip background. */
  chipBackground?: string;
  /** Chip text color. */
  chipForeground?: string;
  /** Chip border color. */
  chipBorder?: string;
  /** Chip corner radius (default fully rounded). */
  chipRadius?: string | number;
  /** Chip padding (e.g. '5px 10px'). */
  chipPadding?: string;
  /** Chip font size. */
  chipFontSize?: string | number;
  /** Chip font weight. */
  chipFontWeight?: string | number;
  /** Chip leading-icon color. */
  chipIcon?: string;
  /** Chip hover background. */
  chipHoverBackground?: string;
  /** Chip hover text color. */
  chipHoverForeground?: string;
  /** Chip hover border color. */
  chipHoverBorder?: string;
  /** Chip label font weight. */
  labelWeight?: string | number;
}

/** Filter token → CSS var (without the `--ph-` prefix) + whether numbers are px. */
const FILTER_TOKEN_TO_VAR: Record<keyof FilterStyleTokens, { var: string; px: boolean }> = {
  barBackground: { var: 'filter-bar-bg', px: false },
  barBorder: { var: 'filter-bar-border', px: false },
  barPadding: { var: 'filter-bar-padding', px: false },
  gap: { var: 'filter-gap', px: true },
  chipBackground: { var: 'filter-chip-bg', px: false },
  chipForeground: { var: 'filter-chip-fg', px: false },
  chipBorder: { var: 'filter-chip-border', px: false },
  chipRadius: { var: 'filter-chip-radius', px: true },
  chipPadding: { var: 'filter-chip-padding', px: false },
  chipFontSize: { var: 'filter-chip-font-size', px: true },
  chipFontWeight: { var: 'filter-chip-font-weight', px: false },
  chipIcon: { var: 'filter-chip-icon', px: false },
  chipHoverBackground: { var: 'filter-chip-hover-bg', px: false },
  chipHoverForeground: { var: 'filter-chip-hover-fg', px: false },
  chipHoverBorder: { var: 'filter-chip-hover-border', px: false },
  labelWeight: { var: 'filter-chip-label-weight', px: false },
};

const TOKEN_TO_VAR: Record<Exclude<keyof ThemeTokens, 'filters'>, string> = {
  accent: 'accent',
  accentForeground: 'accent-fg',
  foreground: 'fg',
  mutedForeground: 'fg-muted',
  background: 'bg',
  altBackground: 'bg-alt',
  headerBackground: 'bg-header',
  border: 'border',
  borderStrong: 'border-strong',
  subtotalBackground: 'total-bg',
  grandTotalBackground: 'grand-bg',
  hoverBackground: 'hover',
  shadow: 'shadow',
  fontFamily: 'font',
  fontSize: 'font-size',
  radius: 'radius',
};

/** Apply a typed {@link ThemeTokens} object onto the root as CSS variables. */
export function applyTokens(root: HTMLElement, tokens: ThemeTokens): void {
  for (const key of Object.keys(tokens) as Array<keyof ThemeTokens>) {
    if (key === 'filters') {
      if (tokens.filters) applyFilterTokens(root, tokens.filters);
      continue;
    }
    const value = tokens[key];
    if (value == null) continue;
    const cssValue = key === 'radius' && typeof value === 'number' ? `${value}px` : String(value);
    root.style.setProperty(`--ph-${TOKEN_TO_VAR[key]}`, cssValue);
  }
}

/** Apply {@link FilterStyleTokens} onto the root as `--ph-filter-*` variables. */
export function applyFilterTokens(root: HTMLElement, tokens: FilterStyleTokens): void {
  for (const key of Object.keys(tokens) as Array<keyof FilterStyleTokens>) {
    const value = tokens[key];
    if (value == null) continue;
    const spec = FILTER_TOKEN_TO_VAR[key];
    const cssValue = spec.px && typeof value === 'number' ? `${value}px` : String(value);
    root.style.setProperty(`--ph-${spec.var}`, cssValue);
  }
}
