import type { NumberFormat } from '@pvotly/core';
import type { PivotContext } from '../context';
import { h } from '../dom';
import { resolveStrings } from '../i18n';

/** Open the number-format editor for the default (and per-measure) format. */
export function openFormatDialog(ctx: PivotContext): void {
  const engine = ctx.engine;
  const config = engine.getConfiguration();
  const t = resolveStrings(config.localization);
  const formats = config.formats ?? [];
  const measures = engine.getSlice().measures ?? [];

  // Target selector: default format ('') or a measure's own named format.
  const targetSel = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  targetSel.append(h('option', { text: t.defaultAll, attrs: { value: '' } }));
  for (const m of measures) targetSel.append(h('option', { text: m.caption ?? m.uniqueName, attrs: { value: m.uniqueName } }));

  const find = (name: string): NumberFormat =>
    formats.find((f) => f.name === name) ?? { name, decimalPlaces: 2, thousandsSeparator: ',', decimalSeparator: '.' };

  const decimals = numInput(t.decimalPlaces, 0, 10);
  const thousands = textInput(t.thousandsSeparator);
  const decimalSep = textInput(t.decimalSeparator);
  const currency = textInput(t.currencySymbol);
  const currencyAlign = selectInput(t.currencyPosition, [
    ['left', t.left],
    ['right', t.right],
  ]);
  const negative = selectInput(t.negatives, [
    ['minus', t.negativeMinus],
    ['parentheses', t.negativeParentheses],
    ['redMinus', t.negativeRedMinus],
  ]);
  const percent = checkboxInput(t.showAsPercent);
  const nullVal = textInput(t.blankNullText);

  const load = (name: string) => {
    const f = find(name);
    decimals.input.value = String(f.decimalPlaces ?? 2);
    thousands.input.value = f.thousandsSeparator ?? ',';
    decimalSep.input.value = f.decimalSeparator ?? '.';
    currency.input.value = f.currencySymbol ?? '';
    currencyAlign.input.value = f.currencySymbolAlign ?? 'left';
    negative.input.value = f.negativeFormat ?? 'minus';
    percent.input.checked = !!f.isPercent;
    nullVal.input.value = f.nullValue ?? '';
  };
  load('');
  targetSel.addEventListener('change', () => load(targetSel.value === '' ? '' : measureFormatName(targetSel.value)));

  const measureFormatName = (measureName: string) =>
    measures.find((m) => m.uniqueName === measureName)?.format ?? '';

  const apply = h('button', {
    class: 'ph-btn ph-btn-primary',
    text: t.apply,
    attrs: { type: 'button' },
    on: {
      click: () => {
        const targetMeasure = targetSel.value;
        const name = targetMeasure === '' ? '' : `fmt_${targetMeasure}`;
        const fmt: NumberFormat = {
          name,
          decimalPlaces: Number(decimals.input.value),
          thousandsSeparator: thousands.input.value,
          decimalSeparator: decimalSep.input.value || '.',
          currencySymbol: currency.input.value,
          currencySymbolAlign: currencyAlign.input.value as 'left' | 'right',
          negativeFormat: negative.input.value as NumberFormat['negativeFormat'],
          isPercent: percent.input.checked,
          nullValue: nullVal.input.value,
        };
        const next = (config.formats ?? []).filter((f) => f.name !== name);
        next.push(fmt);
        engine.setFormats(next);
        if (targetMeasure !== '') engine.setMeasureFormat(targetMeasure, name);
        ctx.closeDialog();
      },
    },
  });

  const content = h(
    'div',
    { class: 'ph-format-dialog' },
    field(t.applyTo, targetSel),
    decimals.row,
    thousands.row,
    decimalSep.row,
    currency.row,
    currencyAlign.row,
    negative.row,
    percent.row,
    nullVal.row,
    h(
      'div',
      { class: 'ph-dialog-footer' },
      h('button', { class: 'ph-btn', text: t.cancel, attrs: { type: 'button' }, on: { click: () => ctx.closeDialog() } }),
      apply,
    ),
  );
  ctx.openDialog(content, t.formatTitle2);
}

function field(label: string, input: HTMLElement): HTMLElement {
  return h('label', { class: 'ph-field' }, h('span', { text: label }), input);
}

function numInput(label: string, min: number, max: number) {
  const input = h('input', { class: 'ph-input', attrs: { type: 'number', min, max } }) as HTMLInputElement;
  return { input, row: field(label, input) };
}
function textInput(label: string) {
  const input = h('input', { class: 'ph-input' }) as HTMLInputElement;
  return { input, row: field(label, input) };
}
function selectInput(label: string, options: Array<[string, string]>) {
  const input = h('select', { class: 'ph-input' }) as HTMLSelectElement;
  for (const [v, l] of options) input.append(h('option', { text: l, attrs: { value: v } }));
  return { input, row: field(label, input) };
}
function checkboxInput(label: string) {
  const input = h('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
  return { input, row: h('label', { class: 'ph-field ph-field-check' }, input, h('span', { text: label })) };
}
