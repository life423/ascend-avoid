import { test, expect } from '@playwright/test';
import { playFromEntry } from './helpers/enter-game.mjs';

test('privacy policy is public and reachable from entry and the game menu', async ({ page, request }) => {
  const policy = await request.get('/privacy-policy.html');
  expect(policy.status()).toBe(200);
  expect(policy.headers()['content-type']).toContain('text/html');
  expect(await policy.text()).toContain('<title>Privacy Policy | Ascend Avoid</title>');

  await page.goto('/');
  const entry = page.getByRole('dialog', { name: 'Ascend Avoid' });
  await entry.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page).toHaveURL(/\/privacy-policy\.html$/);
  await expect(page.getByRole('heading', { name: 'Ascend Avoid Privacy Policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Retention and deletion' })).toBeVisible();
  await expect(page.getByText('30-day retention', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: "Drew Clark's website" })).toHaveAttribute('href', 'https://drewclark.io/');

  await page.goBack();
  await expect(entry).toBeVisible();
  await playFromEntry(page);
  await page.evaluate(() => window.drawerUI.open());
  const menu = page.getByRole('dialog', { name: 'Game Menu' });
  await menu.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('heading', { name: 'Ascend Avoid Privacy Policy' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Ascend Avoid' }).click();
  await expect(page).toHaveURL(/\/$/);
});
