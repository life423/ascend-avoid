import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
test('tutorial promotion stays on the join screen and lessons remain available through the menu', async ({ page }) => {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  const join = page.getByRole('dialog', { name: 'Ascend Avoid', exact: true });
  await expect(join.getByRole('button', { name: 'Tutorial', exact: true })).toBeVisible();
  await join.getByRole('button', { name: 'Play now', exact: true }).click();
  await page.waitForFunction(() => {
    const mode = window.game?.currentGameMode;
    return mode?.multiplayerManager?.getLocalPlayer() && !mode.introPlaying;
  });
  await expect(join).toBeHidden();
  await expect(page.locator('.practice-offer')).toBeHidden();
  await page.evaluate(() => window.drawerUI.open());
  await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Practice / Tutorials' })).toBeVisible();
});
