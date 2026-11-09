export async function playFromEntry(page) {
  const spawned = () => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer();
  await page.waitForFunction(() => !!document.querySelector('.join-dialog[open]') ||
    !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  const entry = page.getByRole('dialog', { name: 'Ascend Avoid' });
  if (await entry.isVisible()) {
    await entry.getByRole('button', { name: /^Play( now)?$/ }).click();
    await entry.waitFor({ state: 'hidden' });
  }
  await page.waitForFunction(spawned);
}

export async function enterGame(page, url = '/') {
  await page.goto(url);
  await playFromEntry(page);
}
