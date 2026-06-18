import { test, expect, type Locator, type Page } from '@playwright/test';

/** Simulate an HTML5 drag-and-drop (Playwright mouse drags don't fire native DnD). */
async function dndSimulate(page: Page, source: Locator, target: Locator): Promise<void> {
  const s = await source.elementHandle();
  const t = await target.elementHandle();
  await page.evaluate(
    ([sEl, tEl]) => {
      const dt = new DataTransfer();
      const ev = (type: string) =>
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
      sEl!.dispatchEvent(ev('dragstart'));
      tEl!.dispatchEvent(ev('dragenter'));
      tEl!.dispatchEvent(ev('dragover'));
      tEl!.dispatchEvent(ev('drop'));
      sEl!.dispatchEvent(ev('dragend'));
    },
    [s, t],
  );
}

test.describe('basic pivot rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/basic');
    await expect(page.locator('.ph-table')).toBeVisible();
  });

  test('renders the crosstab with row + column members and grand totals', async ({ page }) => {
    const table = page.locator('.ph-table');
    await expect(table).toContainText('USA');
    await expect(table).toContainText('Canada');
    await expect(table.locator('.ph-col-head')).toContainText(['Cars']);
    // A grand total row exists.
    await expect(page.locator('.ph-table .ph-grand-total').first()).toBeVisible();
    // Body cells render formatted numbers.
    const firstCell = page.locator('.ph-cell').first();
    await expect(firstCell).not.toBeEmpty();
  });

  test('field list shows the configured axes', async ({ page }) => {
    await expect(page.locator('.ph-fieldlist')).toBeVisible();
    await expect(page.locator('.ph-fl-area[data-axis="rows"]')).toContainText('country');
    await expect(page.locator('.ph-fl-area[data-axis="measures"]')).toContainText('revenue');
  });

  test('the Fields button opens the modal configurator with all four zones', async ({ page }) => {
    await page.getByRole('button', { name: 'Fields' }).click();
    const dialog = page.locator('.ph-fields-dialog');
    await expect(dialog).toBeVisible();
    for (const label of ['Report Filters', 'Columns', 'Rows', 'Values']) {
      await expect(dialog.locator('.ph-zone-head', { hasText: label })).toBeVisible();
    }
    // All-fields checklist is present with at least one active (checked) field.
    await expect(dialog.locator('.ph-ff-row')).not.toHaveCount(0);
    await expect(dialog.locator('.ph-ff-check:checked')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('Fields dialog can place a field on a zone and Apply updates the grid', async ({ page }) => {
    await page.getByRole('button', { name: 'Fields' }).click();
    const dialog = page.locator('.ph-fields-dialog');
    await expect(dialog).toBeVisible();
    // Check the first inactive field to add it to the layout. Use click() (not
    // check()) because toggling re-renders the list and detaches the node,
    // which check()'s post-verification would wait on forever.
    const inactive = dialog.locator('.ph-ff-row:not(.ph-ff-active) .ph-ff-check').first();
    await inactive.click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.ph-table')).toBeVisible();
  });

  test('changing an aggregation updates the grid', async ({ page }) => {
    const select = page.locator('.ph-fl-area[data-axis="measures"] .ph-agg-select').first();
    const before = await page.locator('.ph-cell').first().textContent();
    await select.selectOption('count');
    // Re-render happens on a microtask.
    await expect
      .poll(async () => page.locator('.ph-cell').first().textContent())
      .not.toBe(before);
  });

  test('opens the filter dialog from a field chip', async ({ page }) => {
    await page
      .locator('.ph-fl-area[data-axis="rows"] .ph-chip')
      .first()
      .locator('button[title="Filter"]')
      .click();
    await expect(page.locator('.ph-dialog')).toBeVisible();
    await expect(page.locator('.ph-dialog-title')).toContainText('Filter');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.ph-dialog')).toBeHidden();
  });

  test('opens the export menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.locator('.ph-menu')).toBeVisible();
    await expect(page.locator('.ph-menu-item')).toContainText(['To CSV']);
  });

  test('opens the format dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Format' }).click();
    await expect(page.locator('.ph-dialog')).toBeVisible();
    await expect(page.locator('.ph-dialog-title')).toContainText('Format');
  });
});

test.describe('hierarchical rows expand/collapse', () => {
  test('collapsing a parent row removes its child rows', async ({ page }) => {
    await page.goto('/#/totals');
    await expect(page.locator('.ph-table')).toBeVisible();
    const rowsBefore = await page.locator('.ph-table tbody tr').count();
    const toggle = page.locator('.ph-row-head .ph-toggle').first();
    await toggle.click();
    await expect
      .poll(async () => page.locator('.ph-table tbody tr').count())
      .toBeLessThan(rowsBefore);
  });
});

test.describe('Fields dialog drag-and-drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/basic');
    await expect(page.locator('.ph-table')).toBeVisible();
    await page.getByRole('button', { name: 'Fields' }).click();
    await expect(page.locator('.ph-fields-dialog')).toBeVisible();
  });

  test('field rows and zone chips are actually draggable', async ({ page }) => {
    await expect(page.locator('.ph-fields-dialog .ph-ff-row').first()).toHaveAttribute(
      'draggable',
      'true',
    );
    await expect(page.locator('.ph-fields-dialog .ph-zone-chip').first()).toHaveAttribute(
      'draggable',
      'true',
    );
  });

  test('dragging a field from the list into the Columns zone places it there', async ({ page }) => {
    const dialog = page.locator('.ph-fields-dialog');
    const colsZone = dialog.locator('.ph-zone', {
      has: page.locator('.ph-zone-head', { hasText: 'Columns' }),
    });
    const src = dialog.locator('.ph-ff-row:not(.ph-ff-active)').first();
    const field = await src.getAttribute('data-field');

    await dndSimulate(page, src, colsZone.locator('.ph-zone-body'));

    await expect(colsZone.locator(`.ph-zone-chip[data-field="${field}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.ph-table')).toBeVisible();
  });

  test('dragging a zone chip back onto the field list removes it', async ({ page }) => {
    const dialog = page.locator('.ph-fields-dialog');
    const chip = dialog.locator('.ph-zone-chip').first();
    const field = await chip.getAttribute('data-field');
    await dndSimulate(page, chip, dialog.locator('.ph-ff-list'));
    await expect(dialog.locator(`.ph-zone-chip[data-field="${field}"]`)).toHaveCount(0);
  });
});
