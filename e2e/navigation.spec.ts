import { test, expect } from '@playwright/test';

test.describe('docs site navigation', () => {
  test('the landing page renders at the root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lp-brand')).toContainText('Pvotly');
    await expect(page.locator('#playground')).toBeAttached();
    // The hero embeds a real, live pivot grid.
    await expect(page.locator('.lp-hero-demo .ph-table')).toBeVisible();
  });

  test('loads the docs with the sidebar', async ({ page }) => {
    await page.goto('/#/basic');
    await expect(page.locator('.docs-brand')).toContainText('Pvotly');
    await expect(page.locator('.docs-sidebar nav')).toBeVisible();
    await expect(page.locator('[data-testid="nav-basic"]')).toBeVisible();
  });

  test('navigates between samples via the sidebar', async ({ page }) => {
    await page.goto('/#/basic');
    await page.locator('[data-testid="nav-vanilla"]').click();
    await expect(page).toHaveURL(/#\/vanilla/);
    await expect(page.locator('[data-testid="sample-vanilla"]')).toBeVisible();
    await expect(page.locator('.ph-table')).toBeVisible();
  });

  test('shows the code tab', async ({ page }) => {
    await page.goto('/#/basic');
    await page.locator('[data-testid="tab-code"]').click();
    await expect(page.locator('[data-testid="code"]')).toBeVisible();
    await expect(page.locator('[data-testid="code"]')).toContainText('PivotTable');
    await page.locator('[data-testid="tab-live"]').click();
    await expect(page.locator('.ph-table')).toBeVisible();
  });

  test('every sidebar sample renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/#/basic');
    const links = page.locator('.docs-link');
    const count = await links.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      await links.nth(i).click();
      await expect(page.locator('.docs-main')).toBeVisible();
      // Either a live pivot or some content renders.
      await page.waitForTimeout(150);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
