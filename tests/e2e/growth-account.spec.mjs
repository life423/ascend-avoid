import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { writeFile } from 'node:fs/promises';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local growth accounting review only');
const read = page => page.evaluate(() => window.growthAccountDrill.read());
async function screenshot(page, info, name) {
    const details = page.locator('aside[aria-label="Local growth accounting review"] > details');
    const open = await details.evaluate(element => element.open);
    if (open) await details.locator('summary').click();
    await page.screenshot({ path: info.outputPath(name), scale: 'css' });
    if (open) await details.locator('summary').click();
}
async function action(page, name, key) {
    const count = await page.evaluate(() => window.growthAccountDrill.records.length);
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.growthAccountDrill.records.length)).toBe(count + 1);
    const record = await page.evaluate(() => window.growthAccountDrill.records.at(-1));
    expect(record.action).toBe(key); return record;
}

test('late-bank loss shrinks the real body; no-op and landing preserve it, while new gems regrow it', async ({ page, browserName, hasTouch }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await enterGame(page, '/growth-account.html');
    await page.waitForFunction(() => window.growthAccountDrill?.ready);
    const initial = await read(page); expect(initial.gems).toBeGreaterThan(1990000); expect(initial.width).toBeGreaterThan(1460);
    await screenshot(page, info, 'two-million-start.png');

    const loss = await action(page, 'Lose 500k', 'loss');
    // Upkeep remains active. These bounds demonstrate the real late-size
    // consequence without pretending the bank freezes at the chosen total.
    expect(loss.before.gems - loss.after.gems).toBeGreaterThanOrEqual(500000);
    expect(loss.before.gems - loss.after.gems).toBeLessThan(505000);
    expect(loss.after.width).toBeGreaterThan(1250); expect(loss.after.width).toBeLessThan(1300);
    expect(loss.before.width - loss.after.width).toBeGreaterThan(150);
    await screenshot(page, info, 'after-quarter-loss.png');

    const noop = await action(page, 'No-op update', 'noop');
    expect(noop.after.width).toBeLessThanOrEqual(noop.before.width + .5);
    expect(noop.after.width).toBeLessThan(1300);
    const landed = await action(page, 'Land cleanup', 'land');
    expect(landed.after.width).toBeLessThanOrEqual(landed.before.width + .5);
    expect(landed.after.width).toBeLessThan(1300); expect(landed.after.flying).toBe(false);

    const gain = await action(page, 'Receive 10k', 'gain');
    expect(gain.after.gems).toBeGreaterThan(gain.before.gems + 8000);
    expect(gain.after.width).toBeGreaterThan(gain.before.width + 10);
    expect(gain.after.width).toBeLessThan(1400);
    const secondLand = await action(page, 'Land cleanup', 'land');
    expect(secondLand.after.width).toBeLessThanOrEqual(secondLand.before.width + .5);
    await screenshot(page, info, 'earned-growth-after-landing.png');
    const transactionPath = info.outputPath('growth-transactions.json');
    await writeFile(transactionPath, await page.evaluate(() => JSON.stringify(window.growthAccountDrill.records, null, 2)));
    await info.attach('growth-transactions', { path: transactionPath, contentType: 'application/json' });

    // The review controls return keyboard/touch input to the game, without a new
    // gameplay button or a removed joystick.
    await page.locator('aside[aria-label="Local growth accounting review"] summary').click();
    const input = await practiceInput(page, browserName, hasTouch);
    try {
        await input.hold();
        await expect.poll(() => page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(true);
        await input.releaseAction();
        await expect.poll(() => page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
    } finally { await input.close(); }
    expect(errors).toEqual([]);
});
