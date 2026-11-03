import type { ConditionalFormat, ConditionExpr, MeasureConfig } from '@pvotly/core';
import type { PivotContext } from '../context';
import { h } from '../dom';
import { resolveStrings, type UIStrings } from '../i18n';

type OpValue = ConditionExpr['op'];

interface OpDef {
  value: OpValue;
  label: string;
  needs: 'one' | 'two' | 'none';
}

const DEFAULT_BG = '#fff3cd';
const DEFAULT_FG = '#664d03';

function buildOps(t: UIStrings): OpDef[] {
  return [
    { value: '>', label: t.opGreaterThan, needs: 'one' },
    { value: '>=', label: t.opGreaterOrEqual, needs: 'one' },
    { value: '<', label: t.opLessThan, needs: 'one' },
    { value: '<=', label: t.opLessOrEqual, needs: 'one' },
    { value: '=', label: t.opEquals, needs: 'one' },
    { value: '!=', label: t.opNotEquals, needs: 'one' },
    { value: 'between', label: t.opBetween, needs: 'two' },
    { value: 'contains', label: t.opContains, needs: 'one' },
    { value: 'isTrue', label: t.opIsTrue, needs: 'none' },
    { value: 'isFalse', label: t.opIsFalse, needs: 'none' },
  ];
}

/** A finite number, or `undefined` for empty / malformed / infinite input. */
function parseNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** `<input type="color">` only holds `#rrggbb`; anything else can't be shown in the picker. */
function toPickerColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

/** The rule being edited, plus what the form must keep from it on update. */
interface EditState {
  index: number;
  original: ConditionalFormat;
  bgTouched: boolean;
  fgTouched: boolean;
}

/** Open the conditional-formatting rules editor. */
export function openConditionalDialog(ctx: PivotContext): void {
  const engine = ctx.engine;
  const t = resolveStrings(engine.getConfiguration().localization);
  const OPS = buildOps(t);
  const rules: ConditionalFormat[] = (engine.getConfiguration().conditions ?? []).map((c) => ({ ...c }));
  const measures = engine.getSlice().measures ?? [];
  let editing: EditState | null = null;

  const content = h('div', { class: 'ph-cond-dialog' });
  const list = h('div', { class: 'ph-cond-list' });

  const renderList = () => {
    list.replaceChildren();
    if (!rules.length) list.append(h('p', { class: 'ph-hint', text: t.noRulesYet }));
    rules.forEach((rule, i) => {
      const isEditing = editing?.index === i;
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
          {
            class: isEditing ? 'ph-cond-item ph-cond-item-editing' : 'ph-cond-item',
            attrs: { 'aria-current': isEditing ? 'true' : undefined },
          },
          swatch,
          h('span', { class: 'ph-cond-desc', text: describeRule(rule, t, OPS, measures) }),
          h('button', {
            class: 'ph-btn ph-btn-sm ph-cond-edit',
            text: '✎',
            title: t.editRule,
            attrs: { type: 'button', 'aria-label': t.editRule },
            on: { click: () => startEdit(i) },
          }),
          h('button', {
            class: 'ph-btn ph-btn-sm ph-cond-remove',
            text: '✕',
            title: t.remove,
            attrs: { type: 'button', 'aria-label': t.remove },
            on: { click: () => removeRule(i) },
          }),
        ),
      );
    });
  };

  // Rule form
  const measureSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  measureSel.append(h('option', { text: t.allMeasures, attrs: { value: '' } }));
  for (const m of measures) measureSel.append(h('option', { text: m.caption ?? m.uniqueName, attrs: { value: m.uniqueName } }));
  // Holds a rule's measure that is no longer in the slice, so updating that rule keeps its target.
  let staleMeasureOption: HTMLOptionElement | null = null;

  const opSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  for (const op of OPS) opSel.append(h('option', { text: op.label, attrs: { value: op.value } }));

  const v1 = h('input', { class: 'ph-input ph-input-num', attrs: { type: 'text', placeholder: t.valuePlaceholder } }) as HTMLInputElement;
  const v2 = h('input', { class: 'ph-input ph-input-num', attrs: { type: 'text', placeholder: t.toPlaceholder } }) as HTMLInputElement;

  const bg = h('input', { attrs: { type: 'color', value: DEFAULT_BG } }) as HTMLInputElement;
  const fg = h('input', { attrs: { type: 'color', value: DEFAULT_FG } }) as HTMLInputElement;

  const setInvalid = (input: HTMLInputElement, invalid: boolean) => {
    input.classList.toggle('ph-input-invalid', invalid);
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const clearInvalid = () => {
    setInvalid(v1, false);
    setInvalid(v2, false);
  };

  const syncValueInputs = () => {
    const needs = OPS.find((o) => o.value === opSel.value)?.needs ?? 'one';
    v1.hidden = needs === 'none';
    v2.hidden = needs !== 'two';
  };

  const setMeasure = (name: string | undefined) => {
    staleMeasureOption?.remove();
    staleMeasureOption = null;
    if (name && !measures.some((m) => m.uniqueName === name)) {
      staleMeasureOption = h('option', { text: name, attrs: { value: name } });
      measureSel.append(staleMeasureOption);
    }
    measureSel.value = name ?? '';
  };

  opSel.addEventListener('change', () => {
    clearInvalid();
    syncValueInputs();
  });
  v1.addEventListener('input', () => setInvalid(v1, false));
  v2.addEventListener('input', () => setInvalid(v2, false));
  const touch = (key: 'bgTouched' | 'fgTouched') => () => {
    if (editing) editing[key] = true;
  };
  bg.addEventListener('input', touch('bgTouched'));
  bg.addEventListener('change', touch('bgTouched'));
  fg.addEventListener('input', touch('fgTouched'));
  fg.addEventListener('change', touch('fgTouched'));

  /** Build the condition from the form, or mark the offending inputs and return `null`. */
  const readCondition = (): ConditionExpr | null => {
    clearInvalid();
    const op = opSel.value as OpValue;
    const invalid: HTMLInputElement[] = [];
    let condition: ConditionExpr | null = null;
    switch (op) {
      case 'isTrue':
      case 'isFalse':
        condition = { op };
        break;
      case 'contains':
        if (v1.value.trim() === '') invalid.push(v1);
        else condition = { op, value: v1.value };
        break;
      case 'between': {
        const from = parseNumber(v1.value);
        const to = parseNumber(v2.value);
        if (from === undefined) invalid.push(v1);
        if (to === undefined) invalid.push(v2);
        if (from !== undefined && to !== undefined) condition = { op, from, to };
        break;
      }
      default: {
        // Core also allows string operands for = / !=; keep one the user didn't change.
        const orig = editing?.original.condition;
        if (
          (op === '=' || op === '!=') &&
          (orig?.op === '=' || orig?.op === '!=') &&
          typeof orig.value === 'string' &&
          v1.value === orig.value
        ) {
          condition = { op, value: orig.value };
          break;
        }
        const value = parseNumber(v1.value);
        if (value === undefined) invalid.push(v1);
        else condition = { op, value };
      }
    }
    for (const input of invalid) setInvalid(input, true);
    invalid[0]?.focus();
    return condition;
  };

  const resetForm = () => {
    editing = null;
    setMeasure(undefined);
    opSel.value = '>';
    v1.value = '';
    v2.value = '';
    bg.value = DEFAULT_BG;
    fg.value = DEFAULT_FG;
    clearInvalid();
    syncValueInputs();
    addBtn.textContent = t.addRule;
    cancelEditBtn.hidden = true;
    renderList();
    measureSel.focus();
  };

  const startEdit = (index: number) => {
    const rule = rules[index];
    if (!rule) return;
    editing = { index, original: rule, bgTouched: false, fgTouched: false };
    setMeasure(rule.measure);
    const c = rule.condition;
    opSel.value = c.op;
    v1.value = c.op === 'between' ? String(c.from) : 'value' in c ? String(c.value) : '';
    v2.value = c.op === 'between' ? String(c.to) : '';
    bg.value = toPickerColor(rule.format.backgroundColor) ?? DEFAULT_BG;
    fg.value = toPickerColor(rule.format.color) ?? DEFAULT_FG;
    clearInvalid();
    syncValueInputs();
    addBtn.textContent = t.updateRule;
    cancelEditBtn.hidden = false;
    renderList();
    measureSel.focus();
  };

  const removeRule = (index: number) => {
    rules.splice(index, 1);
    if (editing && index === editing.index) {
      resetForm();
      return;
    }
    if (editing && index < editing.index) editing.index--;
    renderList();
  };

  const submit = () => {
    const condition = readCondition();
    if (!condition) return;
    const original = editing?.original;
    // Keep style properties the form doesn't expose, and colors the user didn't touch.
    const format = { ...original?.format };
    if (!editing || editing.bgTouched) format.backgroundColor = bg.value;
    if (!editing || editing.fgTouched) format.color = fg.value;
    const rule: ConditionalFormat = { ...original, measure: measureSel.value || undefined, condition, format };
    if (editing) rules[editing.index] = rule;
    else rules.push(rule);
    resetForm();
  };

  const addBtn = h('button', {
    class: 'ph-btn ph-btn-primary',
    text: t.addRule,
    attrs: { type: 'button' },
    on: { click: submit },
  });

  const cancelEditBtn = h('button', {
    class: 'ph-btn ph-cond-cancel-edit',
    text: t.cancelEdit,
    attrs: { type: 'button' },
    on: { click: () => resetForm() },
  });
  cancelEditBtn.hidden = true;
  syncValueInputs();

  const form = h(
    'div',
    { class: 'ph-cond-form' },
    measureSel,
    opSel,
    v1,
    v2,
    h('label', { class: 'ph-cond-color' }, h('span', { text: t.fill }), bg),
    h('label', { class: 'ph-cond-color' }, h('span', { text: t.text }), fg),
    addBtn,
    cancelEditBtn,
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
  ctx.openDialog(content, t.conditionalDialogTitle, { width: '760px' });
}

function describeRule(
  rule: ConditionalFormat,
  t: UIStrings,
  ops: readonly OpDef[],
  measures: readonly MeasureConfig[],
): string {
  const target = rule.measure
    ? measures.find((m) => m.uniqueName === rule.measure)?.caption || rule.measure
    : t.allMeasures;
  const c = rule.condition;
  const label = ops.find((o) => o.value === c.op)?.label ?? c.op;
  switch (c.op) {
    case 'between':
      return `${target} ${label} ${c.from} ${t.conditionAnd} ${c.to}`;
    case 'contains':
      return `${target} ${label} "${c.value}"`;
    case 'isTrue':
    case 'isFalse':
      return `${target} ${label}`;
    default:
      return `${target} ${label} ${c.value}`;
  }
}
