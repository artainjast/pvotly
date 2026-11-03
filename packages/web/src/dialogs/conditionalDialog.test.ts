import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConditionalFormat, Localization } from '@pvotly/core';
import { PivotTable } from '../PivotTable';

const DATA = [
  { country: 'USA', revenue: 100, units: 3 },
  { country: 'Canada', revenue: 300, units: 5 },
];

let pivot: PivotTable | undefined;

afterEach(() => {
  pivot?.destroy();
  pivot = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(conditions: ConditionalFormat[] = [], localization?: Localization): PivotTable {
  const host = document.createElement('div');
  document.body.append(host);
  pivot = new PivotTable(host, {
    dataSource: { data: DATA },
    slice: {
      rows: [{ uniqueName: 'country' }],
      measures: [
        { uniqueName: 'revenue', caption: 'Revenue', aggregation: 'sum' },
        { uniqueName: 'units', aggregation: 'sum' },
      ],
    },
    conditions,
    localization,
  });
  pivot.openConditionalDialog();
  return pivot;
}

function ui() {
  const form = document.querySelector<HTMLElement>('.ph-cond-form')!;
  const selects = form.querySelectorAll('select');
  const nums = form.querySelectorAll<HTMLInputElement>(':scope > input.ph-input-num');
  const colors = form.querySelectorAll<HTMLInputElement>('input[type="color"]');
  return {
    form,
    measure: selects[0]!,
    op: selects[1]!,
    v1: nums[0]!,
    v2: nums[1]!,
    bg: colors[0]!,
    fg: colors[1]!,
    submit: form.querySelector<HTMLButtonElement>('.ph-btn-primary')!,
    cancelEdit: form.querySelector<HTMLButtonElement>('.ph-cond-cancel-edit')!,
  };
}

const rows = () => [...document.querySelectorAll<HTMLElement>('.ph-cond-item')];
const editRow = (i: number) => rows()[i]!.querySelector<HTMLButtonElement>('.ph-cond-edit')!.click();
const removeRow = (i: number) => rows()[i]!.querySelector<HTMLButtonElement>('.ph-cond-remove')!.click();
const footerButtons = () => document.querySelectorAll<HTMLButtonElement>('.ph-dialog-footer .ph-btn');
const apply = () => footerButtons()[1]!.click();
const cancelDialog = () => footerButtons()[0]!.click();
const committed = () => pivot!.engine.getConfiguration().conditions ?? [];

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}
function isInvalid(input: HTMLInputElement) {
  return input.classList.contains('ph-input-invalid') && input.getAttribute('aria-invalid') === 'true';
}
function expectAddMode() {
  const f = ui();
  expect(f.measure.value).toBe('');
  expect(f.op.value).toBe('>');
  expect(f.v1.value).toBe('');
  expect(f.v2.value).toBe('');
  expect(f.bg.value).toBe('#fff3cd');
  expect(f.fg.value).toBe('#664d03');
  expect(f.v1.hidden).toBe(false);
  expect(f.v2.hidden).toBe(true);
  expect(f.submit.textContent).toBe('+ Add rule');
  expect(f.cancelEdit.hidden).toBe(true);
  expect(isInvalid(f.v1) || isInvalid(f.v2)).toBe(false);
  expect(document.querySelector('.ph-cond-item-editing')).toBeNull();
  expect(document.activeElement).toBe(f.measure);
}

const R0: ConditionalFormat = {
  measure: 'revenue',
  condition: { op: '>', value: 10 },
  format: { backgroundColor: '#111111', color: '#222222' },
};
const R1: ConditionalFormat = {
  measure: 'units',
  condition: { op: 'between', from: 1, to: 5 },
  format: { backgroundColor: '#ff0000', color: '#00ff00', fontWeight: 'bold' },
};
const R2: ConditionalFormat = {
  condition: { op: '<', value: 0 },
  format: { backgroundColor: '#333333', color: '#444444' },
};

describe('conditional dialog — editing', () => {
  it('loads a rule into the form and marks only its row', () => {
    mount([R0, R1, R2]);
    editRow(1);
    const f = ui();
    expect(f.measure.value).toBe('units');
    expect(f.op.value).toBe('between');
    expect([f.v1.value, f.v2.value]).toEqual(['1', '5']);
    expect(f.v2.hidden).toBe(false);
    expect([f.bg.value, f.fg.value]).toEqual(['#ff0000', '#00ff00']);
    expect(f.submit.textContent).toBe('Update rule');
    expect(f.cancelEdit.hidden).toBe(false);
    expect(document.activeElement).toBe(f.measure);
    expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    expect(rows()[1]!.classList.contains('ph-cond-item-editing')).toBe(true);

    editRow(0);
    expect(ui().measure.value).toBe('revenue');
    expect(ui().op.value).toBe('>');
    expect(ui().v1.value).toBe('10');
    expect(ui().v2.hidden).toBe(true);
    expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual(['true', null, null]);
  });

  it('updates the rule in place and only commits on Apply', () => {
    const p = mount([R0, R1, R2]);
    const setConditions = vi.spyOn(p.engine, 'setConditions');
    editRow(1);
    type(ui().v2, '9');
    ui().submit.click();

    expect(setConditions).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(3);
    expect(rows()[1]!.textContent).toContain('units between 1 and 9');
    expectAddMode();

    apply();
    expect(setConditions).toHaveBeenCalledTimes(1);
    expect(committed()).toEqual([
      R0,
      { measure: 'units', condition: { op: 'between', from: 1, to: 9 }, format: R1.format },
      R2,
    ]);
    expect(document.querySelector('.ph-cond-form')).toBeNull();
  });

  it('cancel edit discards the draft and returns to add mode', () => {
    mount([R0, R1]);
    editRow(0);
    type(ui().v1, '999');
    choose(ui().measure, 'units');
    ui().cancelEdit.click();
    expectAddMode();
    expect(rows()[0]!.textContent).toContain('Revenue greater than 10');
    apply();
    expect(committed()).toEqual([R0, R1]);
  });

  it('dialog Cancel leaves the engine untouched after local add / update / remove', () => {
    mount([R0, R1]);
    editRow(0);
    type(ui().v1, '50');
    ui().submit.click();
    removeRow(1);
    type(ui().v1, '7');
    ui().submit.click();
    cancelDialog();
    expect(committed()).toEqual([R0, R1]);
    pivot!.openConditionalDialog();
    expect(rows()).toHaveLength(2);
  });

  it('removing the edited rule resets the form', () => {
    mount([R0, R1]);
    editRow(1);
    removeRow(1);
    expect(rows()).toHaveLength(1);
    expectAddMode();
  });

  it('removing another rule keeps the edit pointed at the same rule', () => {
    mount([R0, R1, R2]);
    editRow(2);
    type(ui().v1, '-5');
    removeRow(0);
    expect(ui().v1.value).toBe('-5');
    expect(rows()[1]!.getAttribute('aria-current')).toBe('true');
    editRow(1);
    type(ui().v1, '-6');
    removeRow(0);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.getAttribute('aria-current')).toBe('true');
    ui().submit.click();
    apply();
    expect(committed()).toEqual([{ ...R2, condition: { op: '<', value: -6 } }]);
  });

  it('removing a later rule keeps the edit target', () => {
    mount([R0, R1, R2]);
    editRow(0);
    removeRow(2);
    expect(rows()[0]!.getAttribute('aria-current')).toBe('true');
    type(ui().v1, '11');
    ui().submit.click();
    apply();
    expect(committed()).toEqual([{ ...R0, condition: { op: '>', value: 11 } }, R1]);
  });
});

describe('conditional dialog — adding', () => {
  it('adds a rule, then resets the form and focuses the first input', () => {
    mount();
    const f = ui();
    choose(f.measure, 'revenue');
    choose(f.op, 'between');
    type(f.v1, '1');
    type(f.v2, '2');
    f.bg.value = '#123456';
    f.submit.click();

    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain('Revenue between 1 and 2');
    expectAddMode();

    apply();
    expect(committed()).toEqual([
      {
        measure: 'revenue',
        condition: { op: 'between', from: 1, to: 2 },
        format: { backgroundColor: '#123456', color: '#664d03' },
      },
    ]);
  });

  it('appends after an update instead of replacing the old edit target', () => {
    mount([R0]);
    editRow(0);
    ui().submit.click();
    type(ui().v1, '7');
    ui().submit.click();
    expect(rows()).toHaveLength(2);
    apply();
    expect(committed()[0]).toEqual(R0);
    expect(committed()[1]!.condition).toEqual({ op: '>', value: 7 });
  });
});

describe('conditional dialog — validation', () => {
  const BAD = ['', '   ', 'abc', '1,5', 'NaN', 'Infinity', '-Infinity', '1e309'];
  const GOOD: Array<[string, number]> = [
    ['0', 0],
    ['-2.5', -2.5],
    [' 42 ', 42],
  ];

  it.each(['>', '>=', '<', '<=', '=', '!='])('"%s" requires a finite number', (op) => {
    mount();
    const f = ui();
    choose(f.op, op);
    for (const raw of BAD) {
      type(f.v1, raw);
      f.submit.click();
      expect(rows(), `accepted ${JSON.stringify(raw)}`).toHaveLength(0);
      expect(isInvalid(f.v1)).toBe(true);
      expect(document.activeElement).toBe(f.v1);
    }
    for (const [raw] of GOOD) {
      choose(f.op, op);
      type(f.v1, raw);
      f.submit.click();
    }
    expect(rows()).toHaveLength(GOOD.length);
    apply();
    expect(committed().map((r) => r.condition)).toEqual(GOOD.map(([, value]) => ({ op, value })));
  });

  it('between validates both endpoints and focuses the first invalid one', () => {
    mount();
    const f = ui();
    choose(f.op, 'between');

    type(f.v1, '');
    type(f.v2, '3');
    f.submit.click();
    expect([isInvalid(f.v1), isInvalid(f.v2)]).toEqual([true, false]);
    expect(document.activeElement).toBe(f.v1);

    type(f.v1, '1');
    type(f.v2, 'x');
    f.submit.click();
    expect([isInvalid(f.v1), isInvalid(f.v2)]).toEqual([false, true]);
    expect(document.activeElement).toBe(f.v2);

    type(f.v1, 'y');
    type(f.v2, '');
    f.submit.click();
    expect([isInvalid(f.v1), isInvalid(f.v2)]).toEqual([true, true]);
    expect(document.activeElement).toBe(f.v1);
    expect(rows()).toHaveLength(0);
  });

  it('contains rejects blank text but keeps meaningful spaces', () => {
    mount();
    const f = ui();
    choose(f.op, 'contains');
    type(f.v1, '   ');
    f.submit.click();
    expect(rows()).toHaveLength(0);
    expect(isInvalid(f.v1)).toBe(true);
    choose(f.op, 'contains');
    type(f.v1, ' foo ');
    f.submit.click();
    apply();
    expect(committed()[0]!.condition).toEqual({ op: 'contains', value: ' foo ' });
  });

  it('clears markers on input and on operator change', () => {
    mount();
    const f = ui();
    f.submit.click();
    expect(isInvalid(f.v1)).toBe(true);
    type(f.v1, '1');
    expect(isInvalid(f.v1)).toBe(false);

    choose(f.op, 'between');
    type(f.v1, '');
    f.submit.click();
    expect(isInvalid(f.v1) && isInvalid(f.v2)).toBe(true);
    choose(f.op, 'isTrue');
    expect(isInvalid(f.v1) || isInvalid(f.v2)).toBe(false);
  });

  it('a failed update keeps edit mode, the draft and the rules', () => {
    const p = mount([R0, R1]);
    const setConditions = vi.spyOn(p.engine, 'setConditions');
    editRow(0);
    type(ui().v1, 'oops');
    ui().submit.click();
    expect(ui().submit.textContent).toBe('Update rule');
    expect(ui().v1.value).toBe('oops');
    expect(rows()[0]!.getAttribute('aria-current')).toBe('true');
    expect(rows()[0]!.textContent).toContain('greater than 10');
    expect(setConditions).not.toHaveBeenCalled();
  });
});

describe('conditional dialog — boolean operators', () => {
  it.each(['isTrue', 'isFalse'] as const)('%s round-trips without operands', (op) => {
    mount([{ condition: { op }, format: { backgroundColor: '#abcdef', color: '#000000' } }]);
    editRow(0);
    const f = ui();
    expect(f.op.value).toBe(op);
    expect(f.v1.hidden && f.v2.hidden).toBe(true);
    type(f.fg, '#ffffff');
    f.submit.click();
    apply();
    expect(committed()[0]!.condition).toStrictEqual({ op });
    expect(committed()[0]!.format).toEqual({ backgroundColor: '#abcdef', color: '#ffffff' });

    pivot!.openConditionalDialog();
    expect(rows()[0]!.textContent).toContain(op === 'isTrue' ? 'All measures is true' : 'All measures is false');
  });

  it('adds a boolean rule with empty value inputs', () => {
    mount();
    const f = ui();
    choose(f.op, 'isFalse');
    f.submit.click();
    expect(rows()).toHaveLength(1);
    apply();
    expect(committed()[0]!.condition).toStrictEqual({ op: 'isFalse' });
  });
});

describe('conditional dialog — localized descriptions', () => {
  const L: Localization = {
    opGreaterThan: 'GT',
    opGreaterOrEqual: 'GE',
    opLessThan: 'LT',
    opLessOrEqual: 'LE',
    opEquals: 'EQ',
    opNotEquals: 'NE',
    opBetween: 'BETWEEN',
    opContains: 'CONTAINS',
    opIsTrue: 'TRUE?',
    opIsFalse: 'FALSE?',
    conditionAnd: 'AND',
    allMeasures: 'ALL',
    editRule: 'EDIT',
    updateRule: 'UPDATE',
    cancelEdit: 'CANCEL-EDIT',
  };

  it('uses localized operators and measure captions', () => {
    mount(
      [
        { measure: 'revenue', condition: { op: 'between', from: 1, to: 2 }, format: {} },
        { measure: 'units', condition: { op: '>=', value: 5 }, format: {} },
        { measure: 'ghost', condition: { op: 'contains', value: 'x' }, format: {} },
        { condition: { op: 'isTrue' }, format: {} },
        { condition: { op: '!=', value: 3 }, format: {} },
      ],
      L,
    );
    expect(rows().map((r) => r.querySelector('.ph-cond-desc')!.textContent)).toEqual([
      'Revenue BETWEEN 1 AND 2',
      'units GE 5',
      'ghost CONTAINS "x"',
      'ALL TRUE?',
      'ALL NE 3',
    ]);
    expect([...ui().op.options].map((o) => o.text)).toEqual([
      'GT', 'GE', 'LT', 'LE', 'EQ', 'NE', 'BETWEEN', 'CONTAINS', 'TRUE?', 'FALSE?',
    ]);
    const edit = rows()[0]!.querySelector('.ph-cond-edit')!;
    expect(edit.getAttribute('aria-label')).toBe('EDIT');
    editRow(0);
    expect(ui().submit.textContent).toBe('UPDATE');
    expect(ui().cancelEdit.textContent).toBe('CANCEL-EDIT');
    apply();
    expect(committed()[0]!.measure).toBe('revenue');
  });
});

describe('conditional dialog — preserving what the form cannot show', () => {
  it('keeps a measure that is no longer in the slice', () => {
    mount([{ measure: 'ghost', condition: { op: '>', value: 1 }, format: {} }]);
    const optionCount = ui().measure.options.length;
    editRow(0);
    expect(ui().measure.value).toBe('ghost');
    type(ui().v1, '2');
    ui().submit.click();
    expect(ui().measure.options.length).toBe(optionCount);
    apply();
    expect(committed()[0]!.measure).toBe('ghost');
  });

  it('keeps string = / != rules as strings while editing', () => {
    mount([
      { condition: { op: '=', value: '5' }, format: {} },
      { condition: { op: '!=', value: 'abc' }, format: {} },
      { condition: { op: '=', value: 'USA' }, format: {} },
      { condition: { op: '=', value: '001' }, format: {} },
    ]);
    editRow(0);
    ui().submit.click();
    editRow(1);
    choose(ui().op, '=');
    ui().submit.click();
    editRow(2);
    type(ui().v1, 'Canada');
    ui().submit.click();
    editRow(3);
    type(ui().v1, '002');
    ui().submit.click();
    apply();
    expect(committed().map((r) => r.condition)).toEqual([
      { op: '=', value: '5' },
      { op: '=', value: 'abc' },
      { op: '=', value: 'Canada' },
      { op: '=', value: '002' },
    ]);
  });

  it('rejects a blank string operand and keeps numeric = rules numeric', () => {
    mount([
      { condition: { op: '=', value: 'USA' }, format: {} },
      { condition: { op: '=', value: 5 }, format: {} },
    ]);
    editRow(0);
    type(ui().v1, '  ');
    ui().submit.click();
    expect(isInvalid(ui().v1)).toBe(true);
    editRow(1);
    type(ui().v1, 'abc');
    ui().submit.click();
    expect(isInvalid(ui().v1)).toBe(true);
    type(ui().v1, '6');
    ui().submit.click();
    apply();
    expect(committed().map((r) => r.condition)).toEqual([
      { op: '=', value: 'USA' },
      { op: '=', value: 6 },
    ]);
  });

  it('keeps operands the inputs cannot show unless they are edited', () => {
    mount([
      { condition: { op: 'contains', value: 'foo\nbar' }, format: { color: '#000000' } },
      { condition: { op: 'between', from: 1, to: 2 }, format: {} },
    ]);
    editRow(0);
    type(ui().fg, '#ffffff');
    ui().submit.click();
    editRow(1);
    type(ui().v2, '3');
    ui().submit.click();
    apply();
    expect(committed()[0]).toEqual({
      condition: { op: 'contains', value: 'foo\nbar' },
      format: { color: '#ffffff' },
    });
    expect(committed()[1]!.condition).toEqual({ op: 'between', from: 1, to: 3 });
  });

  it('keeps colors the picker cannot show unless they are changed', () => {
    mount([{ condition: { op: '>', value: 1 }, format: { backgroundColor: 'red', fontStyle: 'italic' } }]);
    editRow(0);
    expect(ui().bg.value).toBe('#fff3cd');
    ui().submit.click();
    editRow(0);
    type(ui().fg, '#010203');
    ui().submit.click();
    apply();
    const format = committed()[0]!.format;
    expect(format).toEqual({ backgroundColor: 'red', fontStyle: 'italic', color: '#010203' });
  });
});

describe('conditional dialog — layout', () => {
  it('uses one prominent form row in a wider dialog', () => {
    mount();
    const dialog = document.querySelector<HTMLElement>('.ph-dialog')!;
    expect(dialog.style.width).toBe('760px');
    expect(dialog.style.maxWidth).toBe('94%');
    const f = ui();
    expect(f.form.querySelector('.ph-row')).toBeNull();
    expect([...f.form.children]).toEqual([
      f.measure,
      f.op,
      f.v1,
      f.v2,
      f.bg.parentElement,
      f.fg.parentElement,
      f.submit,
      f.cancelEdit,
    ]);
    expect(f.submit.classList.contains('ph-btn-primary')).toBe(true);
  });
});
