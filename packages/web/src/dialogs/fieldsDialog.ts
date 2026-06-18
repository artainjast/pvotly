import type { FieldInfo, MeasureConfig, Slice, SliceField } from '@pvotly/core';
import { AGGREGATION_LABELS } from '@pvotly/core';
import type { PivotContext } from '../context';
import { ICONS } from '../icons';
import { clear, h } from '../dom';
import { resolveStrings } from '../i18n';

const DND = 'text/pivot-field';

type ZoneKey = 'reportFilters' | 'columns' | 'rows' | 'measures';

interface Draft {
  reportFilters: SliceField[];
  columns: SliceField[];
  rows: SliceField[];
  measures: MeasureConfig[];
}

function cloneDraft(slice: Slice): Draft {
  const c = <T>(v: T[] | undefined): T[] => (v ? v.map((x) => ({ ...x })) : []);
  return {
    reportFilters: c(slice.reportFilters),
    columns: c(slice.columns),
    rows: c(slice.rows),
    measures: c(slice.measures),
  };
}

/**
 * The modal "Fields" configurator: an all-fields checklist (with expandable
 * date parts, measure markers and a search box) plus the four drop zones
 * (Report Filters / Columns / Rows / Values) with drag-drop + reorder, and
 * Apply/Cancel that commit or discard against a working copy of the slice.
 */
export function openFieldsDialog(ctx: PivotContext): void {
  const engine = ctx.engine;
  const t = resolveStrings(engine.getConfiguration().localization);
  const ZONES: Array<{ key: ZoneKey; label: string }> = [
    { key: 'reportFilters', label: t.reportFilters },
    { key: 'columns', label: t.columns },
    { key: 'rows', label: t.rows },
    { key: 'measures', label: t.values },
  ];
  const all = engine.getFields();
  const byName = new Map<string, FieldInfo>(all.map((f) => [f.uniqueName, f]));
  const draft = cloneDraft(engine.getSlice());

  const bases = all.filter((f) => !f.part);
  const childrenOf = (name: string) => all.filter((f) => f.part && f.field === name);

  const expandedGroups = new Set<string>();
  let search = '';

  const content = h('div', { class: 'ph-fields-dialog' });

  /* ---- draft helpers ------------------------------------------------- */

  const indexIn = (key: ZoneKey, name: string) =>
    (draft[key] as Array<{ uniqueName: string }>).findIndex((e) => e.uniqueName === name);

  const zoneOf = (name: string): ZoneKey | null => {
    for (const z of ZONES) if (indexIn(z.key, name) >= 0) return z.key;
    return null;
  };

  const captionOf = (name: string) => byName.get(name)?.caption ?? name;

  const makeMeasure = (name: string): MeasureConfig => {
    const info = byName.get(name);
    return {
      uniqueName: name,
      caption: info?.caption,
      aggregation: info?.aggregation ?? (info?.isMeasure ? 'sum' : 'count'),
    };
  };

  const removeEverywhere = (name: string) => {
    for (const z of ZONES) {
      const i = indexIn(z.key, name);
      if (i >= 0) (draft[z.key] as unknown[]).splice(i, 1);
    }
  };

  const placeIn = (key: ZoneKey, name: string, index?: number) => {
    removeEverywhere(name);
    const entry: SliceField | MeasureConfig =
      key === 'measures' ? makeMeasure(name) : { uniqueName: name };
    const arr = draft[key] as Array<SliceField | MeasureConfig>;
    if (index == null || index < 0 || index >= arr.length) arr.push(entry);
    else arr.splice(index, 0, entry);
  };

  const toggleActive = (name: string) => {
    const z = zoneOf(name);
    if (z) removeEverywhere(name);
    else placeIn(byName.get(name)?.isMeasure ? 'measures' : 'rows', name);
    render();
  };

  const reorder = (key: ZoneKey, index: number, dir: -1 | 1) => {
    const arr = draft[key] as unknown[];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    render();
  };

  /* ---- left: all fields --------------------------------------------- */

  function fieldRow(info: FieldInfo, child = false): HTMLElement {
    const active = zoneOf(info.uniqueName) != null;
    const row = h('div', {
      class: `ph-ff-row${child ? ' ph-ff-child' : ''}${active ? ' ph-ff-active' : ''}`,
      attrs: { draggable: 'true', 'data-field': info.uniqueName },
    });
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData(DND, info.uniqueName);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });

    const kids = child ? [] : childrenOf(info.uniqueName);
    const chevron = h('button', {
      class: `ph-ff-chevron${kids.length ? '' : ' ph-ff-chevron-hidden'}`,
      html: expandedGroups.has(info.uniqueName) ? ICONS.expand : ICONS.collapse,
      attrs: { type: 'button', 'aria-label': t.expand },
      on: {
        click: (e) => {
          e.stopPropagation();
          if (expandedGroups.has(info.uniqueName)) expandedGroups.delete(info.uniqueName);
          else expandedGroups.add(info.uniqueName);
          render();
        },
      },
    });

    const check = h('input', { class: 'ph-ff-check', attrs: { type: 'checkbox' } }) as HTMLInputElement;
    check.checked = active;
    check.addEventListener('change', () => toggleActive(info.uniqueName));

    row.append(
      chevron,
      check,
      h('span', { class: 'ph-ff-label', text: info.caption }),
      h('span', { class: 'ph-ff-spacer' }),
    );
    if (info.isMeasure) {
      row.append(h('span', { class: 'ph-ff-sigma', text: 'Σ', title: t.measure }));
    }
    row.append(h('span', { class: 'ph-ff-grip', html: ICONS.grip }));
    return row;
  }

  function leftPanel(): HTMLElement {
    const panel = h('div', { class: 'ph-ff-panel' });

    const head = h('div', { class: 'ph-ff-head' });
    const titleCol = h(
      'div',
      {},
      h('div', { class: 'ph-ff-head-title', text: t.allFields }),
      h('button', {
        class: 'ph-ff-expandall',
        text: expandedGroups.size ? t.collapseAll : t.expandAll,
        attrs: { type: 'button' },
        on: {
          click: () => {
            if (expandedGroups.size) expandedGroups.clear();
            else for (const b of bases) if (childrenOf(b.uniqueName).length) expandedGroups.add(b.uniqueName);
            render();
          },
        },
      }),
    );
    const searchBox = h('input', {
      class: 'ph-ff-search',
      attrs: { type: 'search', placeholder: t.search, 'aria-label': t.searchFields },
    }) as HTMLInputElement;
    searchBox.value = search;
    searchBox.addEventListener('input', () => {
      search = searchBox.value;
      renderList();
    });
    head.append(titleCol, h('span', { class: 'ph-ff-search-wrap' }, h('span', { class: 'ph-ff-search-icon', html: ICONS.filter }), searchBox));

    const list = h('div', { class: 'ph-ff-list' });
    const renderList = () => {
      clear(list);
      const term = search.trim().toLowerCase();
      for (const base of bases) {
        const kids = childrenOf(base.uniqueName);
        const matches =
          !term ||
          base.caption.toLowerCase().includes(term) ||
          kids.some((k) => k.caption.toLowerCase().includes(term));
        if (!matches) continue;
        list.append(fieldRow(base));
        if (expandedGroups.has(base.uniqueName)) {
          for (const k of kids) list.append(fieldRow(k, true));
        }
      }
      if (!list.childNodes.length) list.append(h('div', { class: 'ph-ff-empty', text: t.noMatchingFields }));
    };
    renderList();

    // Dropping back onto the field list removes a field from all zones.
    makeDropZone(list, (name) => {
      removeEverywhere(name);
      render();
    });

    panel.append(head, list);
    return panel;
  }

  /* ---- right: zones -------------------------------------------------- */

  function zoneChip(key: ZoneKey, entry: { uniqueName: string }, index: number, total: number): HTMLElement {
    const labels = AGGREGATION_LABELS as Record<string, string>;
    const aggName = String((entry as MeasureConfig).aggregation ?? 'sum');
    const label =
      key === 'measures'
        ? `${labels[aggName] ?? aggName} of ${captionOf(entry.uniqueName)}`
        : captionOf(entry.uniqueName);
    const chip = h('div', {
      class: 'ph-zone-chip',
      attrs: { draggable: 'true', 'data-field': entry.uniqueName },
    });
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData(DND, entry.uniqueName);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    chip.append(
      h('span', { class: 'ph-zone-chip-label', text: label }),
      h(
        'span',
        { class: 'ph-zone-chip-arrows' },
        arrow(key, index, -1, index === 0),
        arrow(key, index, 1, index === total - 1),
        h('button', {
          class: 'ph-zone-remove',
          html: ICONS.close,
          attrs: { type: 'button', 'aria-label': t.remove },
          on: {
            click: () => {
              removeEverywhere(entry.uniqueName);
              render();
            },
          },
        }),
      ),
    );
    return chip;
  }

  function arrow(key: ZoneKey, index: number, dir: -1 | 1, disabled: boolean): HTMLElement {
    return h('button', {
      class: `ph-zone-arrow${disabled ? ' ph-disabled' : ''}`,
      html: dir === -1 ? ICONS.sortAsc : ICONS.sortDesc,
      attrs: { type: 'button', 'aria-label': dir === -1 ? t.moveUp : t.moveDown, disabled },
      on: { click: () => !disabled && reorder(key, index, dir) },
    });
  }

  function zoneBox(def: { key: ZoneKey; label: string }): HTMLElement {
    const entries = draft[def.key] as Array<{ uniqueName: string }>;
    const box = h('div', { class: 'ph-zone' });
    box.append(
      h(
        'div',
        { class: 'ph-zone-head' },
        h('span', { text: def.label }),
        entries.length ? h('span', { class: 'ph-zone-count', text: String(entries.length) }) : false,
      ),
    );
    const body = h('div', { class: 'ph-zone-body' });
    entries.forEach((e, i) => body.append(zoneChip(def.key, e, i, entries.length)));
    body.append(h('div', { class: 'ph-zone-placeholder', text: t.dropFieldHere }));
    makeDropZone(body, (name, e) => {
      placeIn(def.key, name, dropIndex(body, e));
      render();
    });
    box.append(body);
    return box;
  }

  function zonesPanel(): HTMLElement {
    const grid = h('div', { class: 'ph-zones' });
    for (const z of ZONES) grid.append(zoneBox(z));
    return grid;
  }

  /* ---- shared drop wiring ------------------------------------------- */

  function makeDropZone(el: HTMLElement, onDrop: (name: string, e: DragEvent) => void): void {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      el.classList.add('ph-drop-hover');
    });
    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget as Node)) el.classList.remove('ph-drop-hover');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('ph-drop-hover');
      const name = e.dataTransfer?.getData(DND) || e.dataTransfer?.getData('text/plain');
      if (name) onDrop(name, e);
    });
  }

  /** Insertion index within a zone based on the pointer's vertical position. */
  function dropIndex(zone: HTMLElement, e: DragEvent): number | undefined {
    const chips = [...zone.querySelectorAll('.ph-zone-chip')] as HTMLElement[];
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i]!.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) return i;
    }
    return undefined;
  }

  /* ---- render -------------------------------------------------------- */

  function render(): void {
    clear(content);
    content.append(
      h('p', { class: 'ph-ff-subtitle', text: t.dragAndDrop }),
      h('div', { class: 'ph-fields-grid' }, leftPanel(), zonesPanel()),
      h(
        'div',
        { class: 'ph-dialog-footer' },
        h('button', {
          class: 'ph-btn',
          text: t.cancel,
          attrs: { type: 'button' },
          on: { click: () => ctx.closeDialog() },
        }),
        h('button', {
          class: 'ph-btn ph-btn-primary',
          text: t.apply,
          attrs: { type: 'button' },
          on: {
            click: () => {
              engine.setSlice({ ...engine.getSlice(), ...draft });
              ctx.closeDialog();
            },
          },
        }),
      ),
    );
  }

  render();
  ctx.openDialog(content, t.fieldsTitle, { width: '900px' });
}
