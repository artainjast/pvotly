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
}

const TOKEN_TO_VAR: Record<keyof ThemeTokens, string> = {
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
    const value = tokens[key];
    if (value == null) continue;
    const cssValue = key === 'radius' && typeof value === 'number' ? `${value}px` : String(value);
    root.style.setProperty(`--ph-${TOKEN_TO_VAR[key]}`, cssValue);
  }
}
