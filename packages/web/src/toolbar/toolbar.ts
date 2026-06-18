import type { GridType } from '@pvotly/core';
import type { PivotContext } from '../context';
import type { PivotTable } from '../PivotTable';
import { ICONS } from '../icons';
import { h } from '../dom';
import { downloadExport, printGrid, type ExportFormat } from '../export';
import { openFormatDialog } from '../dialogs/formatDialog';
import { openConditionalDialog } from '../dialogs/conditionalDialog';
import { resolveStrings, type UIStrings } from '../i18n';

/** The built-in action ids that can be toggled / customized. */
export type ActionBarAction =
  | 'fields'
  | 'format'
  | 'conditional'
  | 'layout'
  | 'export'
  | 'fullscreen'
  | 'undo'
  | 'redo'
  | 'copy';

/** Per-button override. `false` hides it; an object customizes it. */
export interface ActionBarButtonConfig {
  visible?: boolean;
  /** Override the label text. */
  label?: string;
  /** Override the icon (raw SVG/HTML string). */
  icon?: string;
  /** Tooltip. */
  title?: string;
  /** Extra class name(s) added to the button. */
  className?: string;
  /** Replace the default click behavior. Receives the widget instance. */
  onClick?: (table: PivotTable) => void;
}

/** A fully custom button added to the action bar. */
export interface ActionBarItem {
  id: string;
  label?: string;
  icon?: string;
  title?: string;
  className?: string;
  onClick: (table: PivotTable) => void;
}

/**
 * Configure / style the action bar (toolbar). Each built-in action can be a
 * boolean (show/hide) or an object override; add your own buttons via `custom`.
 *
 * @example
 * ```ts
 * actionBar: {
 *   className: 'my-bar',
 *   fields: { label: 'Configure', icon: gearSvg },  // restyle a built-in
 *   conditional: false,                              // hide one
 *   custom: [{ id: 'refresh', label: 'Reload', onClick: (t) => t.refresh() }],
 * }
 * ```
 */
export interface ActionBarConfig {
  /** Hide the whole bar. */
  visible?: boolean;
  /** Class name(s) added to the bar element. */
  className?: string;
  /** Inline styles for the bar element. */
  style?: string | Partial<CSSStyleDeclaration>;
  /** Where custom buttons go relative to the built-ins (default 'end'). */
  customPosition?: 'start' | 'end';
  /** Extra custom buttons. */
  custom?: ActionBarItem[];

  fields?: boolean | ActionBarButtonConfig;
  format?: boolean | ActionBarButtonConfig;
  conditional?: boolean | ActionBarButtonConfig;
  layout?: boolean | ActionBarButtonConfig;
  export?: boolean | ActionBarButtonConfig;
  fullscreen?: boolean | ActionBarButtonConfig;
  /** Undo button (hidden unless enabled). */
  undo?: boolean | ActionBarButtonConfig;
  /** Redo button (hidden unless enabled). */
  redo?: boolean | ActionBarButtonConfig;
  /** Copy-selection button (hidden unless enabled). */
  copy?: boolean | ActionBarButtonConfig;
}

interface Resolved {
  label: string;
  icon: string;
  title: string;
  className?: string;
  onClick: () => void;
}

/** Render the toolbar into `container`, honoring the table's actionBar config. */
export function mountToolbar(ctx: PivotContext, container: HTMLElement): void {
  container.replaceChildren();
  const cfg: ActionBarConfig = ctx.table.actionBar ?? {};
  if (cfg.visible === false) return;

  const bar = h('div', {
    class: `ph-toolbar${cfg.className ? ` ${cfg.className}` : ''}`,
    attrs: { role: 'toolbar' },
  });
  if (cfg.style) {
    if (typeof cfg.style === 'string') bar.setAttribute('style', cfg.style);
    else Object.assign(bar.style, cfg.style);
  }

  const t = resolveStrings(ctx.engine.getConfiguration().localization);

  const defaults: Record<Exclude<ActionBarAction, 'layout' | 'export'>, Resolved> = {
    fields: {
      label: t.fields,
      icon: ICONS.fields,
      title: t.fields,
      onClick: () => ctx.table.openFieldsDialog(),
    },
    format: {
      label: t.format,
      icon: ICONS.format,
      title: t.formatTitle,
      onClick: () => openFormatDialog(ctx),
    },
    conditional: {
      label: t.conditional,
      icon: ICONS.paint,
      title: t.conditionalTitle,
      onClick: () => openConditionalDialog(ctx),
    },
    fullscreen: {
      label: t.fullscreen,
      icon: ICONS.fullscreen,
      title: t.fullscreen,
      onClick: () => void ctx.table.toggleFullscreen(),
    },
    undo: {
      label: t.undo,
      icon: ICONS.undo,
      title: t.undo,
      onClick: () => void ctx.table.undo(),
    },
    redo: {
      label: t.redo,
      icon: ICONS.redo,
      title: t.redo,
      onClick: () => void ctx.table.redo(),
    },
    copy: {
      label: t.copy,
      icon: ICONS.copy,
      title: t.copy,
      onClick: () => void ctx.table.copySelection(),
    },
  };

  const resolve = (
    action: ActionBarAction,
    def: Resolved,
    defaultOn = true,
  ): HTMLElement | null => {
    const raw = cfg[action];
    if (raw === false) return null;
    if (raw === undefined && !defaultOn) return null;
    const o: ActionBarButtonConfig = typeof raw === 'object' ? raw : {};
    if (o.visible === false) return null;
    const onClick = o.onClick ? () => o.onClick!(ctx.table) : def.onClick;
    return toolBtn(o.label ?? def.label, o.icon ?? def.icon, onClick, {
      title: o.title ?? def.title,
      className: o.className,
      action,
    });
  };

  const customButtons = (cfg.custom ?? []).map((item) =>
    toolBtn(item.label ?? '', item.icon ?? '', () => item.onClick(ctx.table), {
      title: item.title ?? item.label,
      className: item.className,
      action: item.id,
    }),
  );

  if (cfg.customPosition === 'start') bar.append(...customButtons);

  const fields = resolve('fields', defaults.fields);
  if (fields) bar.append(fields);
  const format = resolve('format', defaults.format);
  if (format) bar.append(format);
  const conditional = resolve('conditional', defaults.conditional);
  if (conditional) bar.append(conditional);

  const layout = layoutControl(ctx, cfg.layout, t);
  if (layout) bar.append(layout);

  const exportEl = exportControl(ctx, cfg.export, t);
  if (exportEl) bar.append(exportEl);

  // Undo / redo / copy are opt-in (hidden unless explicitly enabled).
  const undo = resolve('undo', defaults.undo, false);
  if (undo) bar.append(undo);
  const redo = resolve('redo', defaults.redo, false);
  if (redo) bar.append(redo);
  const copy = resolve('copy', defaults.copy, false);
  if (copy) bar.append(copy);

  bar.append(spacer());

  const fullscreen = resolve('fullscreen', defaults.fullscreen);
  if (fullscreen) bar.append(fullscreen);

  if (cfg.customPosition !== 'start') bar.append(...customButtons);

  container.append(bar);
}

interface BtnOpts {
  title?: string;
  className?: string;
  action?: string;
}

function toolBtn(label: string, icon: string, onClick: () => void, opts: BtnOpts = {}): HTMLElement {
  return h('button', {
    class: `ph-tool-btn${opts.className ? ` ${opts.className}` : ''}`,
    html: `${icon}${label ? `<span>${escapeHtml(label)}</span>` : ''}`,
    title: opts.title ?? label,
    attrs: { type: 'button', 'data-action': opts.action },
    on: { click: onClick },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function spacer(): HTMLElement {
  return h('span', { class: 'ph-tool-spacer' });
}

function layoutControl(
  ctx: PivotContext,
  raw: boolean | ActionBarButtonConfig | undefined,
  t: UIStrings,
): HTMLElement | null {
  if (raw === false) return null;
  const o: ActionBarButtonConfig = typeof raw === 'object' ? raw : {};
  if (o.visible === false) return null;
  const current = ctx.engine.getConfiguration().options?.grid?.type ?? 'compact';
  const sel = h('select', {
    class: `ph-tool-select${o.className ? ` ${o.className}` : ''}`,
    title: o.title ?? t.layout,
    attrs: { 'data-action': 'layout', 'aria-label': t.layout },
  }) as HTMLSelectElement;
  for (const [value, label] of [
    ['compact', t.compact],
    ['classic', t.classic],
    ['flat', t.flat],
  ] as Array<[GridType, string]>) {
    const opt = h('option', { text: label, attrs: { value } });
    if (value === current) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () =>
    ctx.engine.setOptions({
      grid: { ...ctx.engine.getConfiguration().options?.grid, type: sel.value as GridType },
    }),
  );
  return sel;
}

function exportControl(
  ctx: PivotContext,
  raw: boolean | ActionBarButtonConfig | undefined,
  t: UIStrings,
): HTMLElement | null {
  if (raw === false) return null;
  const o: ActionBarButtonConfig = typeof raw === 'object' ? raw : {};
  if (o.visible === false) return null;

  // A custom onClick turns Export into a plain button (no menu).
  if (o.onClick) {
    return toolBtn(o.label ?? t.export, o.icon ?? ICONS.export, () => o.onClick!(ctx.table), {
      title: o.title ?? t.export,
      className: o.className,
      action: 'export',
    });
  }

  const wrap = h('div', { class: 'ph-menu-wrap' });
  const menu = h('div', { class: 'ph-menu', attrs: { hidden: true } });
  const items: Array<[string, () => void]> = [
    [t.toCSV, () => downloadExport(ctx.engine.getGrid(), 'csv')],
    [t.toExcel, () => downloadExport(ctx.engine.getGrid(), 'excel')],
    [t.toHTML, () => downloadExport(ctx.engine.getGrid(), 'html')],
    [t.toJSON, () => downloadExport(ctx.engine.getGrid(), 'json')],
    [t.printPdf, () => printGrid(ctx.engine.getGrid())],
  ];
  for (const [label, action] of items) {
    menu.append(
      h('button', {
        class: 'ph-menu-item',
        text: label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            action();
            menu.hidden = true;
          },
        },
      }),
    );
  }
  const btn = toolBtn(o.label ?? t.export, o.icon ?? ICONS.export, () => {
    menu.hidden = !menu.hidden;
  }, { title: o.title ?? t.export, className: o.className, action: 'export' });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node)) menu.hidden = true;
  });
  wrap.append(btn, menu);
  return wrap;
}

export type { ExportFormat };
