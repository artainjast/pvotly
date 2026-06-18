import type { CellStyle, ConditionalFormat, ConditionExpr, DataValue } from '../types';

function matches(value: number | DataValue, condition: ConditionExpr): boolean {
  const num = typeof value === 'number' ? value : Number(value);
  const hasNum = typeof value === 'number' || (value != null && !Number.isNaN(num));
  switch (condition.op) {
    case '=':
      return typeof condition.value === 'number' ? hasNum && num === condition.value : value === condition.value;
    case '!=':
      return typeof condition.value === 'number' ? !(hasNum && num === condition.value) : value !== condition.value;
    case '>':
      return hasNum && num > condition.value;
    case '>=':
      return hasNum && num >= condition.value;
    case '<':
      return hasNum && num < condition.value;
    case '<=':
      return hasNum && num <= condition.value;
    case 'between':
      return hasNum && num >= condition.from && num <= condition.to;
    case 'contains':
      return value != null && String(value).toLowerCase().includes(condition.value.toLowerCase());
    case 'isTrue':
      return value === true;
    case 'isFalse':
      return value === false;
    default:
      return false;
  }
}

/**
 * Resolve the merged style for a cell from the active conditional formats. Later
 * matching rules override earlier ones (last-wins), mirroring spreadsheet tools.
 */
export function resolveCellStyle(
  value: number | DataValue,
  measure: string,
  conditions: ConditionalFormat[] | undefined,
): CellStyle | undefined {
  if (!conditions || !conditions.length) return undefined;
  let style: CellStyle | undefined;
  for (const rule of conditions) {
    if (rule.measure && rule.measure !== measure) continue;
    if (matches(value, rule.condition)) {
      style = style ? { ...style, ...rule.format } : { ...rule.format };
    }
  }
  return style;
}
