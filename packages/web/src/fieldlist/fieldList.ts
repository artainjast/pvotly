import type { AggregationType, FieldInfo, MeasureConfig, SliceField } from '@pvotly/core';
import { AGGREGATION_LABELS } from '@pvotly/core';
import type { PivotContext } from '../context';
import type { Axis } from '@pvotly/core';
import { ICONS } from '../icons';
import { clear, h } from '../dom';
import { resolveStrings, type UIStrings } from '../i18n';
import { openFilterDialog } from '../dialogs/filterDialog';

const DND_TYPE = 'text/pivot-field';

interface AreaDef {
  axis: Axis;
  label: string;
}

/** Render the drag-and-drop configurator panel. */
export function mountFieldList(ctx: PivotContext, container: HTMLElement): void {
  const engine = ctx.engine;
  const slice = engine.getSlice();
  const fields = engine.getFields();
  const t = resolveStrings(engine.getConfiguration().localization);
  const areas: AreaDef[] = [
    { axis: 'reportFilters', label: t.reportFilters },
    { axis: 'columns', label: t.columns },
    { axis: 'rows', label: t.rows },
    { axis: 'measures', label: t.values },
  ];

  const used = new Set<string>([
    ...(slice.rows ?? []).map((f) => f.uniqueName),
    ...(slice.columns ?? []).map((f) => f.uniqueName),
    ...(slice.reportFilters ?? []).map((f) => f.uniqueName),
    ...(slice.measures ?? []).map((m) => m.uniqueName),
  ]);
  const available = fields.filter((f) => !used.has(f.uniqueName));

  clear(container);
  const panel = h('div', { class: 'ph-fieldlist' });

  panel.append(h('div', { class: 'ph-fl-title', text: t.fields }));

  // Available fields
  const allBox = h('div', { class: 'ph-fl-available', attrs: { 'data-axis': 'available' } });
  for (const f of available) {
    allBox.append(makeFieldChip(ctx, f, t));
  }
  wireDropZone(ctx, allBox, 'available');
  panel.append(allBox);

  // Drop areas
  const areasWrap = h('div', { class: 'ph-fl-areas' });
  for (const area of areas) {
    const box = h('div', { class: 'ph-fl-area', attrs: { 'data-axis': area.axis } });
    const label = h('div', { class: 'ph-fl-area-label', html: `${ICONS.grip} ${escapeHtml(area.label)}` });
    if (area.axis === 'measures') label.append(valuesAxisToggle(ctx, t));
    box.append(label);
    const items = h('div', { class: 'ph-fl-items' });

    if (area.axis === 'measures') {
      for (const m of slice.measures ?? []) items.append(makeMeasureChip(ctx, m, t));
    } else {
      const list = (slice[area.axis] ?? []) as SliceField[];
      for (const sf of list) {
        const info = fields.find((f) => f.uniqueName === sf.uniqueName);
        items.append(makeAxisChip(ctx, sf, area.axis, info, t));
      }
    }
    wireDropZone(ctx, items, area.axis);
    box.append(items);
    areasWrap.append(box);
  }
  panel.append(areasWrap);
  container.append(panel);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A small "Values on columns / rows" axis switch shown in the Values area. */
function valuesAxisToggle(ctx: PivotContext, t: UIStrings): HTMLElement {
  const axis = ctx.table.getValuesAxis();
  const onRows = axis === 'rows';
  return h('button', {
    class: `ph-fl-axis-toggle${onRows ? ' ph-active' : ''}`,
    html: ICONS.grid,
    title: onRows ? t.valuesAsColumns : t.valuesAsRows,
    attrs: { type: 'button', 'aria-label': onRows ? t.valuesAsColumns : t.valuesAsRows, 'aria-pressed': onRows ? 'true' : 'false' },
    on: {
      click: (e) => {
        e.stopPropagation();
        ctx.table.setValuesAxis(onRows ? 'columns' : 'rows');
      },
    },
  });
}

function makeFieldChip(ctx: PivotContext, f: FieldInfo, t: UIStrings): HTMLElement {
  const chip = h('div', {
    class: `ph-chip ph-chip-available${f.isMeasure ? ' ph-chip-measure' : ''}`,
    attrs: { draggable: 'true', 'data-field': f.uniqueName },
    title: t.dragToArea,
  });
  chip.append(h('span', { class: 'ph-chip-label', text: f.caption }));
  wireDrag(chip, f.uniqueName);
  chip.addEventListener('dblclick', () => {
    ctx.engine.setFieldAxis(f.uniqueName, f.isMeasure ? 'measures' : 'rows');
  });
  return chip;
}

function makeAxisChip(
  ctx: PivotContext,
  sf: SliceField,
  axis: Axis,
  info: FieldInfo | undefined,
  t: UIStrings,
): HTMLElement {
  const chip = h('div', {
    class: 'ph-chip ph-chip-axis',
    attrs: { draggable: 'true', 'data-field': sf.uniqueName },
  });
  chip.append(h('span', { class: 'ph-chip-label', text: info?.caption ?? sf.uniqueName }));

  if (axis === 'rows' || axis === 'columns') {
    const dir = sf.sort ?? 'asc';
    chip.append(
      h('button', {
        class: 'ph-chip-btn',
        html: dir === 'desc' ? ICONS.sortDesc : ICONS.sortAsc,
        title: `${t.sort} (${dir})`,
        attrs: { type: 'button' },
        on: {
          click: (e) => {
            e.stopPropagation();
            const next: SliceField['sort'] = dir === 'asc' ? 'desc' : dir === 'desc' ? 'unsorted' : 'asc';
            ctx.engine.sortField(sf.uniqueName, next);
          },
        },
      }),
    );
  }

  chip.append(
    h('button', {
      class: `ph-chip-btn${sf.filter ? ' ph-active' : ''}`,
      html: ICONS.filter,
      title: t.filter,
      attrs: { type: 'button' },
      on: {
        click: (e) => {
          e.stopPropagation();
          openFilterDialog(ctx, sf.uniqueName);
        },
      },
    }),
  );
  chip.append(removeBtn(ctx, sf.uniqueName, t));
  wireDrag(chip, sf.uniqueName);
  return chip;
}

function makeMeasureChip(ctx: PivotContext, m: MeasureConfig, t: UIStrings): HTMLElement {
  const chip = h('div', {
    class: 'ph-chip ph-chip-value',
    attrs: { draggable: 'true', 'data-field': m.uniqueName },
  });
  chip.append(h('span', { class: 'ph-chip-label', text: m.caption ?? m.uniqueName }));

  if (!m.formula) {
    const select = h('select', { class: 'ph-agg-select', title: t.aggregation });
    for (const [type, label] of Object.entries(AGGREGATION_LABELS)) {
      const opt = h('option', { text: label, attrs: { value: type } });
      if ((m.aggregation ?? 'sum') === type) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener('change', () =>
      ctx.engine.setAggregation(m.uniqueName, select.value as AggregationType),
    );
    select.addEventListener('click', (e) => e.stopPropagation());
    chip.append(select);
  } else {
    chip.append(h('span', { class: 'ph-chip-formula', text: 'ƒx', title: m.formula }));
  }
  chip.append(removeBtn(ctx, m.uniqueName, t));
  wireDrag(chip, m.uniqueName);
  return chip;
}

function removeBtn(ctx: PivotContext, uniqueName: string, t: UIStrings): HTMLElement {
  return h('button', {
    class: 'ph-chip-btn ph-chip-remove',
    html: ICONS.remove,
    title: t.remove,
    attrs: { type: 'button' },
    on: {
      click: (e) => {
        e.stopPropagation();
        ctx.engine.removeField(uniqueName);
      },
    },
  });
}

function wireDrag(el: HTMLElement, field: string): void {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData(DND_TYPE, field);
    e.dataTransfer?.setData('text/plain', field);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    el.classList.add('ph-dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('ph-dragging'));
}

function wireDropZone(ctx: PivotContext, zone: HTMLElement, axis: Axis | 'available'): void {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    zone.classList.add('ph-drop-hover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('ph-drop-hover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('ph-drop-hover');
    const field = e.dataTransfer?.getData(DND_TYPE) || e.dataTransfer?.getData('text/plain');
    if (!field) return;
    const index = dropIndex(zone, e.clientY);
    if (axis === 'available') ctx.engine.removeField(field);
    else ctx.engine.setFieldAxis(field, axis, index);
  });
}

/** Compute the insertion index from the pointer position within a zone. */
function dropIndex(zone: HTMLElement, clientY: number): number | undefined {
  const chips = [...zone.querySelectorAll('.ph-chip')] as HTMLElement[];
  for (let i = 0; i < chips.length; i++) {
    const rect = chips[i]!.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return undefined;
}
