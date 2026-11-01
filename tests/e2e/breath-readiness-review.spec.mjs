import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.LOCAL_LOOP_REVIEW !== '1', 'local real-control readiness regression');
test('exhausted held inhale needs a fresh press after refilling', async ({ page,browserName,hasTouch },info) => {
  expect(new URL(process.env.E2E_URL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  await page.addInitScript(()=>{localStorage.setItem('ascend.mouseFollow','off');localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,status:'not-started',lessons:{}}));});
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testWeapons:false,testCalm:true})}));
  await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
  const input=await practiceInput(page,browserName,hasTouch);
  const status=()=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{inhaling:p.inhaling,stamina:m.stamina,breath:m.breath.phase,holding:!!m.controls?.press?.held,release:m.controls?.releaseToInhale,waves:m.multiplayerManager.getState().gustWaves.size};});
  try{
    await input.hold();await expect.poll(async()=>(await status()).inhaling).toBe(true);
    await expect.poll(async()=>(await status()).inhaling,{timeout:9000}).toBe(false);
    await expect.poll(async()=>(await status()).release).toBe(true);
    await page.screenshot({path:info.outputPath('exhausted-release-cue.png'),scale:'css'});
    await expect.poll(async()=>(await status()).stamina,{timeout:5000}).toBeGreaterThan(.95);
    const heldAfterRefill=await status();expect(heldAfterRefill.holding).toBe(true);expect(heldAfterRefill.inhaling).toBe(false);
    expect(heldAfterRefill.release).toBe(true);
    await page.screenshot({path:info.outputPath('full-breath-still-held.png'),scale:'css'});
    await input.releaseAction();await expect.poll(async()=>(await status()).release).toBe(false);expect((await status()).waves).toBe(0);
    await input.hold();await expect.poll(async()=>(await status()).inhaling).toBe(true);expect((await status()).release).toBe(false);
    await writeFile(info.outputPath('breath-diagnostic.json'),JSON.stringify({heldAfterRefill,afterFreshPress:await status(),method:'Isolated zero-bot/zero-field diagnostic using real controls; no stamina grants. Exhaustion shows an existing-control cue, retained after refilling, cleared by release/new press; no automatic inhale or puff.'},null,2));
  }finally{await input.close();}
});
