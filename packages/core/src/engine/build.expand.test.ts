import { describe, expect, it } from 'vitest';
import { Dataset } from '../data/dataset';
import { buildGrid } from './build';
import { SALES } from '../__fixtures__/sales';
import type { HeaderNode, MeasureConfig, PivotConfiguration, Slice } from '../types';

/* -------------------------------------------------------------------------- *
 * Expand / collapse state for a two-level row axis [country, category].
 *
 * SALES fixture, sorted ascending by compareValues:
 *   Countries:  Canada < USA
 *   Categories within each: Bikes < Cars
 *
 * Revenue reference values:
 *   Canada/Bikes 80 + 120 = 200    Canada/Cars 300       Canada total 500
 *   USA/Bikes 50                   USA/Cars 100 + 200 = 300  USA total 350
 *   Grand total = 850
 *
 * Default grid type is 'compact'. In compact layout each node emits ONE line;
 * an expanded parent emits a leading subtotal line (isTotal=true) and then its
 * children. A collapsed parent emits a single line with no children and
 * isTotal=false.
 * -------------------------------------------------------------------------- */

const CANADA_REVENUE = 500;
const USA_REVENUE = 350;

const revenueSum: MeasureConfig = { uniqueName: 'revenue', aggregation: 'sum' };

function gridForSlice(slice: Slice): ReturnType<typeof buildGrid> {
  const dataset = new Dataset({ data: SALES });
  const config: PivotConfiguration = { dataSource: { data: SALES }, slice };
  return buildGrid(dataset, config);
}

const twoLevelRows = (): Slice['rows'] => [
  { uniqueName: 'country' },
  { uniqueName: 'category' },
];

function captionsOf(leaves: HeaderNode[]): string[] {
  return leaves.map((l) => l.caption);
}

/** Drop the trailing grand-total leaf for clearer member-level assertions. */
function memberLeaves(leaves: HeaderNode[]): HeaderNode[] {
  return leaves.filter((l) => !l.isGrandTotal);
}

function findLeaf(leaves: HeaderNode[], caption: string, level?: number): HeaderNode | undefined {
  return leaves.find((l) => l.caption === caption && (level === undefined || l.level === level));
}

describe('buildGrid expand state (two-level rows [country, category])', () => {
  /* ------------------------------------------------------------------ */
  /* Default: fully expanded                                             */
  /* ------------------------------------------------------------------ */
  describe('default (no expands/drills)', () => {
    it('is fully expanded, showing every child row in pre-order', () => {
      const grid = gridForSlice({ rows: twoLevelRows(), measures: [revenueSum] });

      // Pre-order compact: Canada(subtotal), Canada/Bikes, Canada/Cars,
      // USA(subtotal), USA/Bikes, USA/Cars, Grand Total.
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
    });

    it('marks both parent lines as expanded subtotals and the children as level-1 leaves', () => {
      const grid = gridForSlice({ rows: twoLevelRows(), measures: [revenueSum] });

      const canada = grid.rowLeaves[0]!;
      const usa = grid.rowLeaves[3]!;
      // Parent (subtotal) lines.
      expect(canada.caption).toBe('Canada');
      expect(canada.level).toBe(0);
      expect(canada.isTotal).toBe(true);
      expect(canada.expanded).toBe(true);
      expect(usa.caption).toBe('USA');
      expect(usa.level).toBe(0);
      expect(usa.isTotal).toBe(true);
      expect(usa.expanded).toBe(true);

      // Children rows are level 1 and not totals.
      const children = [1, 2, 4, 5].map((i) => grid.rowLeaves[i]!);
      for (const child of children) {
        expect(child.level).toBe(1);
        expect(child.isTotal).toBeFalsy();
      }
    });

    it('parent subtotal cells equal the sum of their children', () => {
      const grid = gridForSlice({ rows: twoLevelRows(), measures: [revenueSum] });
      const col0 = grid.columnLeaves[0]!;
      const m = grid.measures[0]!;

      expect(grid.getCell(grid.rowLeaves[0]!, col0, m).value).toBe(CANADA_REVENUE);
      expect(grid.getCell(grid.rowLeaves[3]!, col0, m).value).toBe(USA_REVENUE);
      // Child leaves.
      expect(grid.getCell(grid.rowLeaves[1]!, col0, m).value).toBe(200); // Canada/Bikes
      expect(grid.getCell(grid.rowLeaves[2]!, col0, m).value).toBe(300); // Canada/Cars
      expect(grid.getCell(grid.rowLeaves[4]!, col0, m).value).toBe(50); // USA/Bikes
      expect(grid.getCell(grid.rowLeaves[5]!, col0, m).value).toBe(300); // USA/Cars
    });
  });

  /* ------------------------------------------------------------------ */
  /* drills.drillAll: collapse everything to the top level               */
  /* ------------------------------------------------------------------ */
  describe('drills.drillAll = true', () => {
    it('collapses to top-level country rows only (plus grand total)', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { drillAll: true },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual(['Canada', 'USA', 'Grand Total']);
    });

    it('collapsed top-level rows are level-0 leaves, not subtotals', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { drillAll: true },
      });
      const members = memberLeaves(grid.rowLeaves);
      expect(members).toHaveLength(2);
      for (const node of members) {
        expect(node.level).toBe(0);
        expect(node.isTotal).toBeFalsy();
        // No children are shown, so the node renders collapsed.
        expect(node.expanded).toBe(false);
      }
    });

    it('a collapsed top-level row still carries the full aggregate over its descendants', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { drillAll: true },
      });
      const col0 = grid.columnLeaves[0]!;
      const m = grid.measures[0]!;
      const canada = findLeaf(grid.rowLeaves, 'Canada', 0)!;
      const usa = findLeaf(grid.rowLeaves, 'USA', 0)!;
      expect(grid.getCell(canada, col0, m).value).toBe(CANADA_REVENUE);
      expect(grid.getCell(usa, col0, m).value).toBe(USA_REVENUE);
    });
  });

  /* ------------------------------------------------------------------ */
  /* expands.expandAll: explicit full expansion                          */
  /* ------------------------------------------------------------------ */
  describe('expands.expandAll = true', () => {
    it('matches the default fully-expanded layout', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        expands: { expandAll: true },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
    });

    it('overrides drillAll when both are set (expandAll takes precedence for the default)', () => {
      // defaultExpanded resolves expandAll first, so expandAll wins over drillAll.
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        expands: { expandAll: true },
        drills: { drillAll: true },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Per-path collapse via drills.rows                                   */
  /* ------------------------------------------------------------------ */
  describe('per-path collapse: drills.rows collapses USA only', () => {
    const usaCollapsedSlice = (): Slice => ({
      rows: twoLevelRows(),
      measures: [revenueSum],
      drills: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
    });

    it('hides USA children but keeps Canada children expanded', () => {
      const grid = gridForSlice(usaCollapsedSlice());
      // Canada expanded (subtotal + 2 children), USA collapsed (single leaf line).
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Grand Total',
      ]);
    });

    it('Canada remains an expanded subtotal while USA becomes a collapsed leaf', () => {
      const grid = gridForSlice(usaCollapsedSlice());

      const canada = grid.rowLeaves[0]!;
      expect(canada.caption).toBe('Canada');
      expect(canada.level).toBe(0);
      expect(canada.isTotal).toBe(true);
      expect(canada.expanded).toBe(true);

      const usa = grid.rowLeaves[3]!;
      expect(usa.caption).toBe('USA');
      expect(usa.level).toBe(0);
      // Collapsed parent: not a subtotal line and not expanded.
      expect(usa.isTotal).toBeFalsy();
      expect(usa.expanded).toBe(false);

      // The remaining children belong to Canada and are level 1.
      expect(grid.rowLeaves[1]!.caption).toBe('Bikes');
      expect(grid.rowLeaves[1]!.level).toBe(1);
      expect(grid.rowLeaves[2]!.caption).toBe('Cars');
      expect(grid.rowLeaves[2]!.level).toBe(1);
    });

    it('the collapsed USA row carries the full USA aggregate', () => {
      const grid = gridForSlice(usaCollapsedSlice());
      const col0 = grid.columnLeaves[0]!;
      const m = grid.measures[0]!;
      const usa = grid.rowLeaves[3]!;
      expect(grid.getCell(usa, col0, m).value).toBe(USA_REVENUE);
      // Canada's children still sum correctly.
      expect(grid.getCell(grid.rowLeaves[1]!, col0, m).value).toBe(200); // Bikes
      expect(grid.getCell(grid.rowLeaves[2]!, col0, m).value).toBe(300); // Cars
    });

    it('collapsing Canada instead keeps USA children expanded (symmetry check)', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { rows: [{ tuple: [{ uniqueName: 'country', value: 'Canada' }] }] },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
      const canada = grid.rowLeaves[0]!;
      expect(canada.isTotal).toBeFalsy();
      expect(canada.expanded).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Re-expand via expands.rows after a global collapse                  */
  /* ------------------------------------------------------------------ */
  describe('per-path re-expand: expands.rows after drillAll', () => {
    it('re-expands only USA while every other country stays collapsed', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { drillAll: true },
        expands: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
      });
      // Default collapsed; USA explicitly expanded -> USA shows children, Canada stays a leaf.
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);

      const canada = grid.rowLeaves[0]!;
      expect(canada.caption).toBe('Canada');
      expect(canada.expanded).toBe(false);
      expect(canada.isTotal).toBeFalsy();

      const usa = grid.rowLeaves[1]!;
      expect(usa.caption).toBe('USA');
      expect(usa.expanded).toBe(true);
      expect(usa.isTotal).toBe(true);

      // USA's re-expanded children.
      expect(grid.rowLeaves[2]!.caption).toBe('Bikes');
      expect(grid.rowLeaves[2]!.level).toBe(1);
      expect(grid.rowLeaves[3]!.caption).toBe('Cars');
      expect(grid.rowLeaves[3]!.level).toBe(1);
    });

    it('collapsed-set wins over expanded-set when a path is in both', () => {
      // isExpanded checks collapsedSet before expandedSet, so a path listed in
      // both drills.rows and expands.rows stays collapsed.
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
        expands: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
      });
      // USA remains collapsed; Canada (default-expanded) still shows its children.
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Grand Total',
      ]);
      const usa = grid.rowLeaves[3]!;
      expect(usa.caption).toBe('USA');
      expect(usa.expanded).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* rowTree mirrors the expand state                                    */
  /* ------------------------------------------------------------------ */
  describe('rowTree expanded flags', () => {
    it('reports expanded=true for nodes with shown children and false for collapsed ones', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
      });
      const canadaRoot = grid.rowTree.find((n) => n.caption === 'Canada')!;
      const usaRoot = grid.rowTree.find((n) => n.caption === 'USA')!;
      expect(canadaRoot.expanded).toBe(true);
      expect(usaRoot.expanded).toBe(false);
      // Both roots still carry their two children in the tree regardless of expansion.
      expect(canadaRoot.children).toHaveLength(2);
      expect(usaRoot.children).toHaveLength(2);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Edge cases                                                          */
  /* ------------------------------------------------------------------ */
  describe('edge cases', () => {
    it('drillAll on a single-level row axis is a no-op for layout (already top level)', () => {
      const grid = gridForSlice({
        rows: [{ uniqueName: 'country' }],
        measures: [revenueSum],
        drills: { drillAll: true },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual(['Canada', 'USA', 'Grand Total']);
      // Top-level members are leaves, never subtotals.
      expect(grid.rowLeaves.some((l) => l.isTotal)).toBe(false);
    });

    it('a collapse path that matches no member leaves the layout fully expanded', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        drills: { rows: [{ tuple: [{ uniqueName: 'country', value: 'Atlantis' }] }] },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
    });

    it('expands.rows is harmless when the axis is already fully expanded by default', () => {
      const grid = gridForSlice({
        rows: twoLevelRows(),
        measures: [revenueSum],
        expands: { rows: [{ tuple: [{ uniqueName: 'country', value: 'USA' }] }] },
      });
      expect(captionsOf(grid.rowLeaves)).toEqual([
        'Canada',
        'Bikes',
        'Cars',
        'USA',
        'Bikes',
        'Cars',
        'Grand Total',
      ]);
    });
  });
});
