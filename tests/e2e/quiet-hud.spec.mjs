import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
test('starter tips disappear automatically and can be replayed briefly on demand', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('ascend.guideSeen'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  const guide = page.locator('.first-session-guide');
  await expect(guide).toBeVisible();
  await expect(guide).toBeHidden({ timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem('ascend.guideSeen'))).toBe('true');
  await page.evaluate(() => window.dispatchEvent(new Event('ascend:replay-guide')));
  await expect(guide).toBeVisible();
  await expect(guide).toBeHidden({ timeout: 5000 });
});
