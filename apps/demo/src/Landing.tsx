import { useEffect, useRef, useState } from 'react';
import { PivotTable, type PivotTableHandle } from '@pvotly/react';
import type { ThemeTokens } from '@pvotly/web';
import { SALES } from './data';

/* ----------------------------------------------------------------------------
 * Pvotly landing — the "split" hero variant from the Claude Design comp,
 * rebuilt as a real React page wired to live @pvotly/react tables.
 * -------------------------------------------------------------------------- */

type Theme = 'light' | 'dark';

interface LandingProps {
  theme: Theme;
  onToggleTheme(): void;
}

const FRAMEWORKS = [
  { name: 'React', color: '#61dafb' },
  { name: 'Vue', color: '#42b883' },
  { name: 'Svelte', color: '#ff3e00' },
  { name: 'Angular', color: '#dd0031' },
  { name: 'Vanilla TS', color: '#3178c6' },
  { name: 'Web Components', color: '#8801b8' },
  { name: 'CDN / UMD', color: '#ff8a00' },
  { name: 'Headless', color: '#4147c9' },
];

const FEATURES = [
  {
    color: 'var(--pv-accent)',
    title: 'Framework-free engine',
    body: 'A zero-dependency aggregation core. Slice, dice, drill, and total — the same logic in any UI, or none.',
    icon: 'M4 7l8-4 8 4-8 4-8-4Z M4 12l8 4 8-4 M4 17l8 4 8-4',
  },
  {
    color: 'var(--pv-orange)',
    title: 'Drag-and-drop field list',
    body: 'A WebDataRocks-style fields dialog with report filters, rows, columns and values zones — fully keyboard accessible.',
    icon: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  },
  {
    color: 'var(--pv-purple)',
    title: 'Themeable to the pixel',
    body: 'Every header, total, accent and grid line is a typed token. Pass a `tokens` prop or wire your own design system.',
    icon: 'M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6Z',
  },
  {
    color: 'var(--pv-accent)',
    title: '15+ aggregations & calc fields',
    body: 'Sum, avg, min/max, distinct count, median, stdev, plus custom aggregators and formula-based calculated measures.',
    icon: 'M4 4h16v4H4Z M4 12h7v8H4Z M14 12h6v8h-6Z',
  },
  {
    color: 'var(--pv-orange)',
    title: 'Virtualized & fast',
    body: 'A single linear aggregation pass plus row/column virtualization keeps the DOM tiny at a million rows.',
    icon: 'M3 12h4l3 8 4-16 3 8h4',
  },
  {
    color: 'var(--pv-purple)',
    title: 'Excel-style outline rows',
    body: "Switch rows to a gutter layout — boxed −/+ expanders step through every level, just like a spreadsheet's outline.",
    icon: 'M4 5h16 M4 5v14 M9 9h11 M9 9v10 M14 13h6 M7 5v0 M12 9v0',
  },
];

const BENCH = [
  { label: 'Pvotly', ms: 86, w: '24%' },
  { label: 'Library B', ms: 240, w: '62%' },
  { label: 'Library C', ms: 410, w: '100%' },
];

const PKG = {
  npm: 'npm i @pvotly/web @pvotly/react',
  pnpm: 'pnpm add @pvotly/web @pvotly/react',
  yarn: 'yarn add @pvotly/web @pvotly/react',
  cdn: 'https://cdn.jsdelivr.net/npm/@pvotly/web/global',
};

interface Preset {
  label: string;
  swatch: string;
  base: Theme;
  tokens: ThemeTokens;
}
const PRESETS: Preset[] = [
  { label: 'Default', swatch: '#4147c9', base: 'light', tokens: { accent: '#4147c9', headerBackground: '#eef0ff' } },
  {
    label: 'Midnight',
    swatch: '#22d3ee',
    base: 'dark',
    tokens: { accent: '#22d3ee', headerBackground: '#10263a', background: '#0b1620' },
  },
  {
    label: 'Mint',
    swatch: '#16a34a',
    base: 'light',
    tokens: { accent: '#16a34a', headerBackground: '#e7f7ee' },
  },
  {
    label: 'Sunset',
    swatch: '#ff8a00',
    base: 'light',
    tokens: { accent: '#ff8a00', headerBackground: '#fff1e0', background: '#fffaf4' },
  },
];

function Check({ stroke }: { stroke: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2">
      <path d="M4 12.5l5 5 11-12" />
    </svg>
  );
}

const MEASURES = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'units', label: 'Units' },
  { value: 'price', label: 'Price' },
  { value: 'discount', label: 'Discount' },
] as const;
const AGGS = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count', label: 'Count' },
] as const;
const LAYOUTS = [
  { value: 'gutter', label: 'Outline rows' },
  { value: 'compact', label: 'Compact rows' },
] as const;

/** Reveal once on scroll-in; returns a ref + whether it has entered the viewport. */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          ob.disconnect();
        }
      },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** Animate 0 → `to` with an ease-out cubic once the element scrolls into view. */
function CountUp({ to, dur = 1300, format }: { to: number; dur?: number; format?: (n: number) => string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.5);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, dur]);
  return <span ref={ref}>{format ? format(val) : Math.round(val).toString()}</span>;
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="lp-field">
      <span className="lp-field-label">{label}</span>
      <span className="lp-select">
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

/** Benchmark bars that fill from zero once scrolled into view. */
function Bars() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  return (
    <div className="lp-reveal lp-bars" ref={ref}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--pv-fg-faint)',
          marginBottom: 22,
        }}
      >
        Time to pivot · representative
      </div>
      {BENCH.map((b) => (
        <div key={b.label}>
          <div className="lp-bar-row">
            <span style={{ color: 'var(--pv-fg)', fontWeight: 500 }}>{b.label}</span>
            <span className="ms">
              <CountUp to={b.ms} dur={1100} /> ms
            </span>
          </div>
          <div className="lp-bar">
            <i style={{ width: seen ? b.w : '0%' }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 0, fontSize: 11.5, color: 'var(--pv-fg-faint)', lineHeight: 1.5 }}>
        Synthetic dataset on an M2 laptop. Measure on your own data — exports are deterministic.
      </div>
    </div>
  );
}

export default function Landing({ theme, onToggleTheme }: LandingProps) {
  const [copied, setCopied] = useState(false);
  const [pkg, setPkg] = useState<keyof typeof PKG>('npm');
  const [pkgCopied, setPkgCopied] = useState(false);
  const [preset, setPreset] = useState(0);
  const [measure, setMeasure] = useState<(typeof MEASURES)[number]['value']>('revenue');
  const [agg, setAgg] = useState<(typeof AGGS)[number]['value']>('sum');
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]['value']>('gutter');
  const playRef = useRef<PivotTableHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll: toggle `.is-in` on every `.lp-reveal` as it enters view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.lp-reveal'));
    const ob = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            ob.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -7% 0px' },
    );
    els.forEach((el) => ob.observe(el));
    return () => ob.disconnect();
  }, []);

  const copy = (text: string, mark: (v: boolean) => void) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    mark(true);
    window.setTimeout(() => mark(false), 1600);
  };

  const p = PRESETS[preset]!;

  return (
    <div className="lp" ref={rootRef}>
      {/* ---------------- NAV ---------------- */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#/">
            <span className="pv-mark">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
                <rect x="0.6" y="0.6" width="22.8" height="22.8" rx="6.6" fill="var(--pv-accent)" />
                <rect x="5.4" y="5.4" width="5.4" height="5.4" rx="1.5" fill="#fff" />
                <rect x="5.4" y="13.2" width="5.4" height="5.4" rx="1.5" fill="#fff" opacity="0.5" />
                <rect x="13.2" y="13.2" width="5.4" height="5.4" rx="1.5" fill="#fff" opacity="0.5" />
              </svg>
            </span>
            <span className="lp-brand-name">Pvotly</span>
          </a>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#playground">Playground</a>
            <a href="#performance">Performance</a>
            <a href="#theming">Theming</a>
            <a href="#/basic">Docs</a>
          </div>
          <div style={{ flex: 1 }} />
          <button className="lp-iconbtn" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
              </svg>
            )}
          </button>
          <a className="lp-btn" href="#/basic">
            Get started
          </a>
        </div>
      </nav>

      {/* ---------------- HERO ---------------- */}
      <header id="top" className="lp-hero">
        <div className="lp-hero-bg" aria-hidden>
          <span className="lp-blob a" />
          <span className="lp-blob b" />
          <span className="lp-blob c" />
        </div>
        <div className="lp-hero-stage">
          <div className="lp-hero-copy">
            <div className="lp-meta lp-reveal" style={{ ['--rd' as string]: '0ms' }}>
              <span className="lp-pill">
                <span className="dot" />
                v2.4 · MIT licensed
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--pv-fg-muted)', fontWeight: 500 }}>
                Zero runtime deps
              </span>
            </div>
            <h1 className="lp-h1 lp-reveal" style={{ ['--rd' as string]: '80ms' }}>
              Pivot tables,
              <br />
              unbundled from
              <br />
              your framework.
            </h1>
            <p className="lp-lede lp-reveal" style={{ ['--rd' as string]: '170ms' }}>
              Pvotly pairs a fast, fully-typed aggregation <strong>engine</strong> with thin UI bindings — so the
              same pivot logic runs in React, Vue, Svelte, or plain TypeScript. Themeable to the pixel, tested to
              the edge.
            </p>
            <div className="lp-cta lp-reveal" style={{ ['--rd' as string]: '260ms' }}>
              <button className="lp-copybtn" onClick={() => copy('npm i @pvotly/web', setCopied)}>
                <span className="sigil">$</span> npm i @pvotly/web
                <span style={{ color: 'var(--pv-fg-faint)', display: 'inline-flex' }}>
                  {copied ? (
                    <Check stroke="var(--pv-orange)" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="9" y="9" width="11" height="11" rx="2.5" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                  )}
                </span>
              </button>
              <a className="lp-cta-primary" href="#/basic">
                Open the playground →
              </a>
            </div>
            <div className="lp-trust lp-reveal" style={{ ['--rd' as string]: '350ms' }}>
              <span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--pv-orange)" strokeWidth="1.8">
                  <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3Z" />
                  <path d="M9 12l2 2 4-4.5" />
                </svg>
                740+ tests · green CI
              </span>
              <span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--pv-purple)" strokeWidth="1.8">
                  <path d="M4 7l8-4 8 4-8 4-8-4Z" />
                  <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
                </svg>
                Tiny core, gzipped
              </span>
            </div>
          </div>

          <div className="lp-hero-demo lp-reveal" style={{ ['--rd' as string]: '180ms' }}>
            <div className="lp-window lp-float">
              <div className="lp-window-bar">
                <span className="lp-traffic">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-window-title">revenue · country × category</span>
                <span className="lp-live">
                  <i />
                  live
                </span>
              </div>
              <div className="lp-window-body">
                <PivotTable
                  key={`hero-${theme}`}
                  theme={theme}
                  toolbar={false}
                  fieldList={false}
                  height={332}
                  dataSource={{ data: SALES }}
                  slice={{
                    rows: [{ uniqueName: 'country' }],
                    columns: [{ uniqueName: 'category' }],
                    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- FRAMEWORKS ---------------- */}
      <section className="lp-marquee-sec">
        <div className="lp-marquee-label">One engine · every renderer</div>
        <div className="lp-marquee">
          {[0, 1].map((dup) => (
            <div className="row" key={dup} aria-hidden={dup === 1}>
              {FRAMEWORKS.map((fw) => (
                <span className="lp-fw" key={fw.name + dup}>
                  <i style={{ background: fw.color }} />
                  {fw.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section id="features" className="lp-section">
        <div className="lp-reveal" style={{ maxWidth: 640 }}>
          <span className="lp-eyebrow">Why Pvotly</span>
          <h2 className="lp-h2">A pivot core that gets out of your way.</h2>
          <p className="lp-sub">
            Aggregation lives in a framework-free package. The UI bindings are thin, headless, and yours to style.
          </p>
        </div>
        <div className="lp-feature-grid lp-reveal">
          {FEATURES.map((ft) => (
            <div className="lp-card" key={ft.title}>
              <div className="lp-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ft.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ft.icon} />
                </svg>
              </div>
              <h3>{ft.title}</h3>
              <p>{ft.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- PLAYGROUND (real drag-and-drop) ---------------- */}
      <section id="playground" className="lp-section" style={{ paddingTop: 40 }}>
        <div
          className="lp-reveal"
          style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 30 }}
        >
          <div style={{ maxWidth: 560 }}>
            <span className="lp-eyebrow">Live playground</span>
            <h2 className="lp-h2">Drag a field. Watch it pivot.</h2>
            <p className="lp-sub">
              This is the real widget — open the field list, drag fields between rows, columns and values, sort a
              header, or expand a row. No mock-ups.
            </p>
          </div>
          <div className="lp-controls">
            <Select label="Measure" value={measure} options={MEASURES} onChange={setMeasure} />
            <Select label="Aggregation" value={agg} options={AGGS} onChange={setAgg} />
            <Select label="Row layout" value={layout} options={LAYOUTS} onChange={setLayout} />
          </div>
        </div>
        <div className="lp-window">
          <div className="lp-window-bar">
            <span className="lp-traffic">
              <i />
              <i />
              <i />
            </span>
            <span className="lp-window-title">playground.tsx — full field list + outline rows</span>
          </div>
          <div className="lp-window-body">
            <PivotTable
              key={`play-${theme}-${measure}-${agg}-${layout}`}
              ref={playRef}
              theme={theme}
              height={460}
              reportFilterBar
              dataSource={{ data: SALES }}
              slice={{
                reportFilters: [{ uniqueName: 'channel' }],
                rows: [{ uniqueName: 'country' }, { uniqueName: 'category' }],
                columns: [],
                measures: [{ uniqueName: measure, aggregation: agg }],
              }}
              options={{ grid: { rowLayout: layout, rowLabelsCaption: 'Row Labels' } }}
            />
          </div>
        </div>
      </section>

      {/* ---------------- PERFORMANCE ---------------- */}
      <section id="performance" className="lp-section">
        <div className="lp-split">
          <div className="lp-reveal">
            <span className="lp-eyebrow">Performance</span>
            <h2 className="lp-h2">Built for a million rows.</h2>
            <p className="lp-sub">
              The aggregator runs a single linear pass with typed accumulators. Row and column virtualization keep
              the DOM tiny no matter how deep the pivot goes.
            </p>
            <div className="lp-stats">
              <div>
                <div className="lp-stat-n">
                  <CountUp
                    to={1_000_000}
                    format={(n) => (n >= 1_000_000 ? '1M' : `${Math.round(n / 1000)}K`)}
                  />
                </div>
                <div className="lp-stat-l">rows aggregated</div>
              </div>
              <div>
                <div className="lp-stat-n accent">
                  <CountUp to={86} />
                  <span style={{ fontSize: 24 }}>ms</span>
                </div>
                <div className="lp-stat-l">single-pass pivot</div>
              </div>
            </div>
          </div>
          <Bars />
        </div>
      </section>

      {/* ---------------- THEMING (live token swap) ---------------- */}
      <section id="theming" className="lp-band">
        <div className="lp-wrap">
          <div className="lp-split">
            <div className="lp-reveal">
              <span className="lp-eyebrow">Theming</span>
              <h2 className="lp-h2">Every cell is a CSS variable.</h2>
              <p className="lp-sub">
                No theme lock-in. Headers, totals, accents and grid lines are all typed tokens. Click a preset — the
                same grid below re-themes through the <code>tokens</code> prop.
              </p>
              <div className="lp-chips">
                {PRESETS.map((tp, i) => (
                  <button className="lp-chip" key={tp.label} data-active={i === preset} onClick={() => setPreset(i)}>
                    <span className="sw" style={{ background: tp.swatch }} />
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="lp-window lp-reveal">
              <div className="lp-window-bar">
                <span className="lp-traffic">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-window-title">theme = {p.label.toLowerCase()}</span>
              </div>
              <div className="lp-window-body">
                <PivotTable
                  key={`theme-${preset}`}
                  theme={p.base}
                  tokens={p.tokens}
                  toolbar={false}
                  fieldList={false}
                  height={300}
                  dataSource={{ data: SALES }}
                  slice={{
                    rows: [{ uniqueName: 'country' }],
                    columns: [{ uniqueName: 'category' }],
                    measures: [{ uniqueName: 'revenue', aggregation: 'sum' }],
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- INSTALL ---------------- */}
      <section id="install" className="lp-section">
        <div className="lp-reveal" style={{ maxWidth: 620, marginBottom: 40 }}>
          <span className="lp-eyebrow">Install</span>
          <h2 className="lp-h2">Drop it into your stack.</h2>
        </div>
        <div className="lp-install-grid lp-reveal">
          <div className="lp-pkgcard">
            <div className="lp-pkgtabs">
              {(Object.keys(PKG) as Array<keyof typeof PKG>).map((k) => (
                <button key={k} data-active={k === pkg} onClick={() => setPkg(k)}>
                  {k}
                </button>
              ))}
            </div>
            <div className="lp-pkgcmd">
              <span style={{ color: 'var(--pv-accent)', fontFamily: 'var(--fc-font-mono)', fontSize: 14 }}>
                {pkg === 'cdn' ? '↘' : '$'}
              </span>
              <code>{PKG[pkg]}</code>
              <button className="lp-iconbtn" style={{ width: 30, height: 30 }} aria-label="copy" onClick={() => copy(PKG[pkg], setPkgCopied)}>
                {pkgCopied ? (
                  <Check stroke="var(--pv-orange)" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="9" y="9" width="11" height="11" rx="2.5" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="lp-code">
            <div className="lp-codebar">
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#ff8a00', opacity: 0.8 }} />
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#4147c9', opacity: 0.8 }} />
              <span style={{ width: 10, height: 10, borderRadius: 9999, background: '#8801b8', opacity: 0.8 }} />
              <span className="ttl">report.tsx</span>
            </div>
            <pre>
              <span style={{ color: '#a371f7' }}>import</span> {'{ PivotTable }'} <span style={{ color: '#a371f7' }}>from</span>{' '}
              <span style={{ color: '#ffa657' }}>'@pvotly/react'</span>
              {'\n\n'}
              <span style={{ color: '#7ee787' }}>&lt;PivotTable</span>
              {'\n  '}
              <span style={{ color: '#79c0ff' }}>dataSource</span>={'{{ data: sales }}'}
              {'\n  '}
              <span style={{ color: '#79c0ff' }}>slice</span>={'{{'}
              {'\n    rows: ['}
              <span style={{ color: '#ffa657' }}>{"{ uniqueName: 'region' }"}</span>],
              {'\n    columns: ['}
              <span style={{ color: '#ffa657' }}>{"{ uniqueName: 'quarter' }"}</span>],
              {'\n    measures: ['}
              <span style={{ color: '#ffa657' }}>{"{ uniqueName: 'revenue', aggregation: 'sum' }"}</span>],
              {'\n  }}'}
              {'\n'}
              <span style={{ color: '#7ee787' }}>/&gt;</span>
            </pre>
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="lp-footer">
        <span>© {2026} Pvotly · MIT licensed</span>
        <span style={{ display: 'flex', gap: 18 }}>
          <a href="#features">Features</a>
          <a href="#/basic">Docs</a>
          <a href="#playground">Playground</a>
          <a href="#theming">Theming</a>
        </span>
      </footer>
    </div>
  );
}
