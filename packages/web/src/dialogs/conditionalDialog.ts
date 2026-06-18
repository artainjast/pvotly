import type { ConditionalFormat, ConditionExpr } from '@pvotly/core';
import type { PivotContext } from '../context';
import { h } from '../dom';
import { resolveStrings, type UIStrings } from '../i18n';

function buildOps(t: UIStrings): Array<{ value: string; label: string; needs: 'one' | 'two' | 'none' }> {
  return [
    { value: '>', label: t.opGreaterThan, needs: 'one' },
    { value: '>=', label: t.opGreaterOrEqual, needs: 'one' },
    { value: '<', label: t.opLessThan, needs: 'one' },
    { value: '<=', label: t.opLessOrEqual, needs: 'one' },
    { value: '=', label: t.opEquals, needs: 'one' },
    { value: '!=', label: t.opNotEquals, needs: 'one' },
    { value: 'between', label: t.opBetween, needs: 'two' },
    { value: 'contains', label: t.opContains, needs: 'one' },
  ];
}

/** Open the conditional-formatting rules editor. */
export function openConditionalDialog(ctx: PivotContext): void {
  const engine = ctx.engine;
  const t = resolveStrings(engine.getConfiguration().localization);
  const OPS = buildOps(t);
  const rules: ConditionalFormat[] = (engine.getConfiguration().conditions ?? []).map((c) => ({ ...c }));
  const measures = engine.getSlice().measures ?? [];

  const content = h('div', { class: 'ph-cond-dialog' });
  const list = h('div', { class: 'ph-cond-list' });

  const renderList = () => {
    list.replaceChildren();
    if (!rules.length) list.append(h('p', { class: 'ph-hint', text: t.noRulesYet }));
    rules.forEach((rule, i) => {
      const desc = describeRule(rule, t);
      const swatch = h('span', {
        class: 'ph-swatch',
        style: {
          backgroundColor: rule.format.backgroundColor ?? 'transparent',
          color: rule.format.color ?? 'inherit',
        },
        text: 'Aa',
      });
      list.append(
        h(
          'div',
          { class: 'ph-cond-item' },
          swatch,
          h('span', { class: 'ph-cond-desc', text: desc }),
          h('button', {
            class: 'ph-btn ph-btn-sm',
            text: '✕',
            attrs: { type: 'button' },
            on: {
              click: () => {
                rules.splice(i, 1);
                renderList();
              },
            },
          }),
        ),
      );
    });
  };

  // Add-rule form
  const measureSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  measureSel.append(h('option', { text: t.allMeasures, attrs: { value: '' } }));
  for (const m of measures) measureSel.append(h('option', { text: m.caption ?? m.uniqueName, attrs: { value: m.uniqueName } }));

  const opSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  for (const op of OPS) opSel.append(h('option', { text: op.label, attrs: { value: op.value } }));

  const v1 = h('input', { class: 'ph-input ph-input-num', attrs: { type: 'text', placeholder: t.valuePlaceholder } }) as HTMLInputElement;
  const v2 = h('input', { class: 'ph-input ph-input-num', attrs: { type: 'text', placeholder: t.toPlaceholder } }) as HTMLInputElement;
  v2.style.display = 'none';
  opSel.addEventListener('change', () => {
    const def = OPS.find((o) => o.value === opSel.value);
    v2.style.display = def?.needs === 'two' ? '' : 'none';
  });

  const bg = h('input', { attrs: { type: 'color', value: '#fff3cd' } }) as HTMLInputElement;
  const fg = h('input', { attrs: { type: 'color', value: '#664d03' } }) as HTMLInputElement;

  const addBtn = h('button', {
    class: 'ph-btn',
    text: t.addRule,
    attrs: { type: 'button' },
    on: {
      click: () => {
        const op = opSel.value;
        const def = OPS.find((o) => o.value === op);
        let condition: ConditionExpr;
        if (def?.needs === 'two') {
          condition = { op: 'between', from: Number(v1.value) || 0, to: Number(v2.value) || 0 };
        } else if (op === 'contains') {
          condition = { op: 'contains', value: v1.value };
        } else {
          condition = { op: op as never, value: Number(v1.value) || 0 };
        }
        const rule: ConditionalFormat = {
          measure: measureSel.value || undefined,
          condition,
          format: { backgroundColor: bg.value, color: fg.value },
        };
        rules.push(rule);
        renderList();
      },
    },
  });

  const form = h(
    'div',
    { class: 'ph-cond-form' },
    h('div', { class: 'ph-row' }, measureSel, opSel, v1, v2),
    h('div', { class: 'ph-row' }, h('span', { text: t.fill }), bg, h('span', { text: t.text }), fg, addBtn),
  );

  const footer = h(
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
          engine.setConditions(rules);
          ctx.closeDialog();
        },
      },
    }),
  );

  renderList();
  content.append(list, form, footer);
  ctx.openDialog(content, t.conditionalDialogTitle);
}

function describeRule(rule: ConditionalFormat, t: UIStrings): string {
  const target = rule.measure ?? t.allMeasures;
  const c = rule.condition;
  let cond = '';
  switch (c.op) {
    case 'between':
      cond = `between ${c.from} and ${c.to}`;
      break;
    case 'contains':
      cond = `contains "${c.value}"`;
      break;
    case 'isTrue':
      cond = 'is true';
      break;
    case 'isFalse':
      cond = 'is false';
      break;
    default:
      cond = `${c.op} ${(c as { value: unknown }).value}`;
  }
  return `${target} ${cond}`;
}
