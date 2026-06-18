/**
 * The built-in, **zero-dependency** SVG adapter — the default renderer.
 *
 * Draws bar / line / area / pie charts as inline SVG using nothing but the DOM.
 * Colors come from a small built-in palette (overridable via
 * {@link ChartRenderOptions.palette}) and the surrounding `--ph-*` CSS variables
 * so charts inherit the active pvotly theme.
 */
import type { ChartAdapter, ChartData, ChartRenderOptions, ChartType } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_PALETTE = [
  'var(--ph-accent, #4f7cff)',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

type SvgAttrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: SvgAttrs = {},
  ...children: (SVGElement | string)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

function paletteAt(palette: string[], i: number): string {
  return palette[i % palette.length] as string;
}

/** "Nice" upper bound so axis gridlines land on round numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(value * 100) / 100);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface Layout {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  plotW: number;
  plotH: number;
}

function makeLayout(width: number, height: number, titleOffset: number): Layout {
  const pad = { top: 16 + titleOffset, right: 16, bottom: 48, left: 56 };
  return {
    width,
    height,
    pad,
    plotW: Math.max(1, width - pad.left - pad.right),
    plotH: Math.max(1, height - pad.top - pad.bottom),
  };
}

function num(v: number | null): number {
  return v == null ? 0 : v;
}

function seriesMax(data: ChartData): number {
  let max = 0;
  for (const s of data.series) for (const v of s.values) if (num(v) > max) max = num(v);
  return niceMax(max);
}

function addTitle(root: SVGElement, title: string | undefined, width: number): void {
  if (!title) return;
  root.append(
    svg(
      'text',
      {
        x: width / 2,
        y: 16,
        'text-anchor': 'middle',
        'font-weight': '600',
        'font-size': '14',
        fill: 'var(--ph-fg, #1a1a2e)',
      },
      title,
    ),
  );
}

function addLegend(root: SVGElement, names: string[], layout: Layout, palette: string[]): void {
  if (names.length <= 1) return;
  const y = layout.height - 14;
  let x = layout.pad.left;
  for (let i = 0; i < names.length; i++) {
    const g = svg('g');
    g.append(svg('rect', { x, y: y - 9, width: 10, height: 10, rx: 2, fill: paletteAt(palette, i) }));
    g.append(
      svg('text', { x: x + 14, y, 'font-size': '11', fill: 'var(--ph-fg-muted, #6b7280)' }, names[i] ?? ''),
    );
    root.append(g);
    x += 14 + 8 + Math.max(24, (names[i] ?? '').length * 6.5);
  }
}

function addYAxis(root: SVGElement, layout: Layout, max: number, ticks = 4): void {
  const { pad, plotW, plotH } = layout;
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const y = pad.top + plotH - t * plotH;
    root.append(
      svg('line', {
        x1: pad.left,
        y1: y,
        x2: pad.left + plotW,
        y2: y,
        stroke: 'var(--ph-border, #e5e7eb)',
        'stroke-width': '1',
      }),
    );
    root.append(
      svg(
        'text',
        { x: pad.left - 8, y: y + 3, 'text-anchor': 'end', 'font-size': '10', fill: 'var(--ph-fg-muted, #6b7280)' },
        formatTick(max * t),
      ),
    );
  }
}

function addCategoryLabels(root: SVGElement, layout: Layout, categories: string[]): void {
  const { pad, plotW, plotH } = layout;
  const band = plotW / Math.max(1, categories.length);
  categories.forEach((cat, i) => {
    const cx = pad.left + band * (i + 0.5);
    root.append(
      svg(
        'text',
        { x: cx, y: pad.top + plotH + 16, 'text-anchor': 'middle', 'font-size': '10', fill: 'var(--ph-fg-muted, #6b7280)' },
        truncate(cat, 12),
      ),
    );
  });
}

function renderBar(root: SVGElement, data: ChartData, layout: Layout, palette: string[]): void {
  const { pad, plotW, plotH } = layout;
  const max = seriesMax(data);
  addYAxis(root, layout, max);

  const nCats = Math.max(1, data.categories.length);
  const nSeries = Math.max(1, data.series.length);
  const band = plotW / nCats;
  const groupPad = band * 0.15;
  const barW = (band - groupPad * 2) / nSeries;

  data.series.forEach((s, si) => {
    s.values.forEach((raw, ci) => {
      const v = num(raw);
      const h = max > 0 ? (v / max) * plotH : 0;
      const x = pad.left + band * ci + groupPad + barW * si;
      const y = pad.top + plotH - h;
      const rect = svg('rect', {
        x,
        y,
        width: Math.max(0, barW - 1),
        height: Math.max(0, h),
        fill: paletteAt(palette, si),
        rx: 1,
      });
      rect.append(svg('title', {}, `${data.categories[ci] ?? ''} · ${s.name}: ${v}`));
      root.append(rect);
    });
  });

  addCategoryLabels(root, layout, data.categories);
  addLegend(root, data.series.map((s) => s.name), layout, palette);
}

function renderLine(root: SVGElement, data: ChartData, layout: Layout, palette: string[], fill: boolean): void {
  const { pad, plotW, plotH } = layout;
  const max = seriesMax(data);
  addYAxis(root, layout, max);

  const nCats = Math.max(1, data.categories.length);
  const band = plotW / nCats;
  const xAt = (i: number) => pad.left + band * (i + 0.5);
  const yAt = (v: number) => pad.top + plotH - (max > 0 ? (v / max) * plotH : 0);
  const baseline = pad.top + plotH;

  data.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${xAt(i)},${yAt(num(v))}`);
    if (fill && pts.length > 0) {
      const area = `${xAt(0)},${baseline} ${pts.join(' ')} ${xAt(s.values.length - 1)},${baseline}`;
      root.append(svg('polygon', { points: area, fill: paletteAt(palette, si), 'fill-opacity': '0.15', stroke: 'none' }));
    }
    if (pts.length > 0) {
      root.append(
        svg('polyline', {
          points: pts.join(' '),
          fill: 'none',
          stroke: paletteAt(palette, si),
          'stroke-width': '2',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        }),
      );
    }
    s.values.forEach((v, i) => {
      const dot = svg('circle', { cx: xAt(i), cy: yAt(num(v)), r: 3, fill: paletteAt(palette, si) });
      dot.append(svg('title', {}, `${data.categories[i] ?? ''} · ${s.name}: ${num(v)}`));
      root.append(dot);
    });
  });

  addCategoryLabels(root, layout, data.categories);
  addLegend(root, data.series.map((s) => s.name), layout, palette);
}

function renderPie(root: SVGElement, data: ChartData, layout: Layout, palette: string[]): void {
  const series = data.series[0];
  const values = series ? series.values.map(num) : [];
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  const cx = layout.pad.left + layout.plotW / 2;
  const cy = layout.pad.top + layout.plotH / 2;
  const r = Math.max(8, Math.min(layout.plotW, layout.plotH) / 2 - 8);

  if (total <= 0) {
    root.append(svg('circle', { cx, cy, r, fill: 'none', stroke: 'var(--ph-border, #e5e7eb)', 'stroke-width': '1' }));
    addLegend(root, data.categories, layout, palette);
    return;
  }

  let angle = -Math.PI / 2;
  values.forEach((raw, i) => {
    const v = Math.max(0, raw);
    if (v <= 0) return;
    const frac = v / total;
    const next = angle + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(next);
    const y2 = cy + r * Math.sin(next);
    const largeArc = frac > 0.5 ? 1 : 0;
    const path =
      frac >= 1
        ? svg('circle', { cx, cy, r, fill: paletteAt(palette, i) })
        : svg('path', {
            d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            fill: paletteAt(palette, i),
          });
    path.append(svg('title', {}, `${data.categories[i] ?? ''}: ${raw} (${(frac * 100).toFixed(1)}%)`));
    root.append(path);
    angle = next;
  });

  addLegend(root, data.categories, layout, palette);
}

/** Draw a complete chart into a fresh `<svg>` and return it (does not attach). */
function draw(data: ChartData, options: ChartRenderOptions): SVGSVGElement {
  const type: ChartType = options.type ?? data.type ?? 'bar';
  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const title = options.title ?? data.title;
  const palette = options.palette && options.palette.length > 0 ? options.palette : DEFAULT_PALETTE;

  const root = svg('svg', {
    class: 'ph-chart',
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: String(height),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'font-family': 'var(--ph-font, system-ui, sans-serif)',
  });

  addTitle(root, title, width);
  const layout = makeLayout(width, height, title ? 12 : 0);

  if (data.categories.length === 0 || data.series.length === 0) {
    root.append(
      svg(
        'text',
        { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': '12', fill: 'var(--ph-fg-muted, #6b7280)' },
        'No data',
      ),
    );
    return root;
  }

  switch (type) {
    case 'line':
      renderLine(root, data, layout, palette, false);
      break;
    case 'area':
      renderLine(root, data, layout, palette, true);
      break;
    case 'pie':
      renderPie(root, data, layout, palette);
      break;
    case 'scatter':
    case 'bar':
    default:
      renderBar(root, data, layout, palette);
      break;
  }
  return root;
}

/**
 * The default, dependency-free SVG {@link ChartAdapter}. Its instance handle is
 * the root `<svg>` element it creates.
 */
export const builtinSvgAdapter: ChartAdapter<SVGSVGElement> = {
  name: 'svg',
  render(container, data, options) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const root = draw(data, options);
    container.append(root);
    return root;
  },
  update(instance, data, options) {
    const fresh = draw(data, options);
    instance.replaceWith(fresh);
    return fresh;
  },
  destroy(instance) {
    instance.remove();
  },
};
