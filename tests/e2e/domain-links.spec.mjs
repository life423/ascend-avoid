import { test, expect } from '@playwright/test';
import { playFromEntry } from './helpers/enter-game.mjs';

test('canonical, privacy and friend links use the primary domain', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ascendavoid.com/');
  await playFromEntry(page);
  await page.evaluate(() => window.drawerUI.open());
  const menu = page.getByRole('dialog', { name: 'Game Menu' });
  const invite = menu.locator('.invite-link');
  await expect(invite).toHaveText('ascendavoid.com ↗');
  await expect(invite).toHaveAttribute('href', 'https://ascendavoid.com/');
  const qr = menu.getByRole('img', { name: 'QR code to play Ascend Avoid at ascendavoid.com' });
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await invite.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('domain-menu-links.png'), scale: 'css' });
  const policy = await request.get('/privacy-policy.html');
  expect(policy.status()).toBe(200);
  const html = await policy.text();
  expect(html).toContain('href="https://ascendavoid.com/privacy-policy.html"');
  expect(html).toContain('site data for ascendavoid.com');
  expect(html).toContain('previous ascend.drewclark.io');
});
