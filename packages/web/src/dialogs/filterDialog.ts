import type { DataValue, FieldFilter, MemberFilter, SliceField } from '@pvotly/core';
import type { PivotContext } from '../context';
import { h } from '../dom';
import { resolveStrings } from '../i18n';

function currentFilter(ctx: PivotContext, uniqueName: string): FieldFilter | undefined {
  const s = ctx.engine.getSlice();
  const all = [...(s.rows ?? []), ...(s.columns ?? []), ...(s.reportFilters ?? [])] as SliceField[];
  return all.find((f) => f.uniqueName === uniqueName)?.filter;
}

/** Open a member-checklist + value/label filter dialog for a field. */
export function openFilterDialog(ctx: PivotContext, uniqueName: string): void {
  const engine = ctx.engine;
  const t = resolveStrings(engine.getConfiguration().localization);
  const members = engine.getMembers(uniqueName);
  const caption = engine.getDataset().fieldCaption(uniqueName);
  const existing = currentFilter(ctx, uniqueName);
  let activePane: 'members' | 'value' = 'members';

  const included = new Set<string>();
  const keyOf = (v: DataValue) => (v instanceof Date ? `d${v.getTime()}` : String(v));
  if (existing?.type === 'members') {
    const mf = existing as MemberFilter;
    if (mf.include) mf.include.forEach((v) => included.add(keyOf(v)));
    else {
      members.forEach((v) => included.add(keyOf(v)));
      (mf.exclude ?? []).forEach((v) => included.delete(keyOf(v)));
    }
  } else {
    members.forEach((v) => included.add(keyOf(v)));
  }

  const content = h('div', { class: 'ph-filter-dialog' });

  // Tabs
  const tabBar = h('div', { class: 'ph-tabs' });
  const panes = h('div', { class: 'ph-tab-panes' });
  const tabs: Array<{ name: string; pane: HTMLElement }> = [];
  const addTab = (name: string, key: 'members' | 'value', pane: HTMLElement, active = false) => {
    const btn = h('button', {
      class: `ph-tab${active ? ' ph-active' : ''}`,
      text: name,
      attrs: { type: 'button' },
      on: {
        click: () => {
          activePane = key;
          tabBar.querySelectorAll('.ph-tab').forEach((el) => el.classList.remove('ph-active'));
          panes.querySelectorAll('.ph-tab-pane').forEach((p) => ((p as HTMLElement).style.display = 'none'));
          btn.classList.add('ph-active');
          pane.style.display = '';
        },
      },
    });
    pane.classList.add('ph-tab-pane');
    pane.style.display = active ? '' : 'none';
    tabBar.append(btn);
    panes.append(pane);
    tabs.push({ name, pane });
  };

  // ---- Members pane ----
  const membersPane = h('div', {});
  const search = h('input', {
    class: 'ph-input',
    attrs: { type: 'search', placeholder: t.searchMembers },
  }) as HTMLInputElement;
  const list = h('div', { class: 'ph-member-list' });
  const checks = new Map<string, HTMLInputElement>();
  const renderMembers = (q: string) => {
    list.replaceChildren();
    for (const m of members) {
      const cap = engine.getDataset().memberCaption(uniqueName, m);
      if (q && !cap.toLowerCase().includes(q.toLowerCase())) continue;
      const k = keyOf(m);
      const cb = h('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
      cb.checked = included.has(k);
      cb.addEventListener('change', () => (cb.checked ? included.add(k) : included.delete(k)));
      checks.set(k, cb);
      list.append(h('label', { class: 'ph-member' }, cb, h('span', { text: cap })));
    }
  };
  search.addEventListener('input', () => renderMembers(search.value));
  renderMembers('');

  const selAll = h('button', {
    class: 'ph-btn ph-btn-sm',
    text: t.selectAll,
    attrs: { type: 'button' },
    on: {
      click: () => {
        members.forEach((m) => included.add(keyOf(m)));
        renderMembers(search.value);
      },
    },
  });
  const clearAll = h('button', {
    class: 'ph-btn ph-btn-sm',
    text: t.clear,
    attrs: { type: 'button' },
    on: {
      click: () => {
        included.clear();
        renderMembers(search.value);
      },
    },
  });
  membersPane.append(search, h('div', { class: 'ph-member-actions' }, selAll, clearAll), list);
  addTab(t.members, 'members', membersPane, true);

  // ---- Value (Top N) pane ----
  const valuePane = h('div', { class: 'ph-value-filter' });
  const measures = engine.getSlice().measures ?? [];
  const measureSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  for (const m of measures) measureSel.append(h('option', { text: m.caption ?? m.uniqueName, attrs: { value: m.uniqueName } }));
  const opSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  for (const op of ['top', 'bottom', 'greater', 'less', 'greaterEqual', 'lessEqual', 'equal']) {
    opSel.append(h('option', { text: op, attrs: { value: op } }));
  }
  const numInput = h('input', { class: 'ph-input', attrs: { type: 'number', value: '10' } }) as HTMLInputElement;
  valuePane.append(
    h('p', { class: 'ph-hint', text: t.keepMembersByValue }),
    h('div', { class: 'ph-row' }, opSel, numInput),
    h('div', { class: 'ph-row' }, h('span', { text: t.by }), measureSel),
  );
  if (measures.length) addTab(t.value, 'value', valuePane);

  // ---- Footer ----
  const footer = h('div', { class: 'ph-dialog-footer' });
  const apply = h('button', {
    class: 'ph-btn ph-btn-primary',
    text: t.apply,
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (activePane === 'value' && measures.length) {
          const count = Number(numInput.value) || 0;
          const op = opSel.value as never;
          const measure = measureSel.value;
          const query =
            op === 'top' || op === 'bottom'
              ? { op, count }
              : { op, value: count };
          engine.setFilter(uniqueName, { type: 'value', measure, query } as FieldFilter);
        } else {
          const total = members.length;
          if (included.size === total) engine.clearFilter(uniqueName);
          else {
            const include = members.filter((m) => included.has(keyOf(m)));
            engine.setFilter(uniqueName, { type: 'members', include });
          }
        }
        ctx.closeDialog();
      },
    },
  });
  const clearBtn = h('button', {
    class: 'ph-btn',
    text: t.clearFilter,
    attrs: { type: 'button' },
    on: {
      click: () => {
        engine.clearFilter(uniqueName);
        ctx.closeDialog();
      },
    },
  });
  const cancel = h('button', {
    class: 'ph-btn',
    text: t.cancel,
    attrs: { type: 'button' },
    on: { click: () => ctx.closeDialog() },
  });
  footer.append(clearBtn, cancel, apply);

  content.append(tabBar, panes, footer);
  ctx.openDialog(content, `${t.filterTitle}: ${caption}`);
}
