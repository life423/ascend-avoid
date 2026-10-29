import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
test('optional practice offer expires and lessons remain available through the menu', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('ascend.guideSeen'); localStorage.removeItem('ascend.practice.v1'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  const guide = page.locator('.practice-offer');
  await expect(guide).toBeVisible();
  await expect(guide).toBeHidden({ timeout: 10000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.practice.v1')).offered)).toBe(true);
  await page.evaluate(() => window.drawerUI.open());
  await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Practice / Tutorials' })).toBeVisible();
});
