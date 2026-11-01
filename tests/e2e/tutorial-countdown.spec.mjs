import { test, expect } from '@playwright/test';
import { openLesson, readPractice, practiceInput } from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local tutorial checks');
test.beforeEach(({page})=>page.on('pageerror',e=>{throw e;}));

test('the full tutorial starts automatically with a visible countdown and a prepared direction', async ({page,browserName,hasTouch})=>{
  await openLesson(page,'basics',true);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await expect(page.locator('.practice-countdown')).toBeVisible();
    await expect(page.getByRole('button',{name:'Start now',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
    const before=await readPractice(page);expect(before.phase).toBe('countdown');
    await input.move(1,0);
    await page.screenshot({path:test.info().outputPath('sequence-countdown.png'),scale:'css'});
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await expect.poll(async()=>(await readPractice(page)).me.x-before.me.x).toBeGreaterThan(6);
    expect((await readPractice(page)).attempt).toBe(before.attempt);
    await expect(page.locator('.practice-countdown')).toBeHidden();
  } finally { await input.close(); }
});

test('Pause preserves the actual shot and Start now immediately overrides the countdown',async({page,browserName,hasTouch})=>{
  await openLesson(page,'basics',true);
  await page.getByRole('button',{name:'Skip lesson',exact:true}).click();
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.lesson==='combat');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='ready');
  const before=await readPractice(page);
  await page.waitForTimeout(3300);
  const after=await readPractice(page);expect(after.phase).toBe('ready');expect(after.me.gulping).toBe(before.me.gulping);expect(after.failures).toBe(0);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await input.move(1,0);
    await input.tapButton(page.getByRole('button',{name:'Start now',exact:true}));
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting',null,{timeout:1200});
    await expect.poll(async()=>(await readPractice(page)).me.x-before.me.x).toBeGreaterThan(6);
    expect((await readPractice(page)).me.gulping).toBe(before.me.gulping);
  } finally { await input.close(); }
});

test('Start now can bypass an active countdown and reduced motion keeps the digits still',async({page,browserName,hasTouch})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await openLesson(page,'basics',true);
  expect(await page.locator('.practice-countdown strong').evaluate(el=>el.getAnimations().length)).toBe(0);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await input.tapButton(page.getByRole('button',{name:'Start now',exact:true}));
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting',null,{timeout:1200});
    await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeHidden();
  } finally { await input.close(); }
});

test('opening lesson selection or hiding the page pauses automatic starting',async({page})=>{
  await openLesson(page,'basics',true);
  await page.getByRole('button',{name:'Choose any lesson',exact:true}).click();
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='ready');
  await page.getByRole('button',{name:'Start full tutorial',exact:true}).click();
  await expect(page.locator('.practice-countdown')).toBeVisible();
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='ready');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(3200);
  expect((await readPractice(page)).phase).toBe('ready');
  await expect(page.locator('.practice-countdown')).toBeHidden();
  await expect(page.getByRole('button',{name:'Start now',exact:true})).toBeVisible();
});

test('automatic starting discards a tap begun during preparation without firing the captive',async({page,browserName,hasTouch})=>{
  await openLesson(page,'basics',true);
  await page.getByRole('button',{name:'Skip lesson',exact:true}).click();
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.lesson==='combat');
  const before=await readPractice(page);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await page.waitForFunction(()=>{
      const m=window.game.currentGameMode,s=m.multiplayerManager.getState();
      return s.practice.countdownEndsAt-m.worldNow(s,performance.now())<100;
    });
    await input.hold();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await input.releaseAction(); await page.waitForTimeout(180);
    const after=await readPractice(page);expect(after.me.gulping).toBe(before.me.gulping);expect(after.me.inhaling).toBe(false);expect(after.failures).toBe(0);
    expect(await page.evaluate(()=>window.game.currentGameMode.cannonHits.length)).toBe(0);
  } finally {await input.close();}
});

test('a very short viewport still shows the countdown without covering touch controls',async({page,browserName,hasTouch})=>{
  await openLesson(page,'basics',true);
  await page.setViewportSize({width:568,height:240});
  await expect.poll(()=>page.evaluate(()=>{
    const circle=document.querySelector('.practice-countdown'),heading=document.querySelector('.practice-heading');
    return !circle.hidden||heading.textContent.includes('Starts in');
  })).toBe(true);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await input.tapButton(page.getByRole('button',{name:'Start now',exact:true}));
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await page.waitForTimeout(300);
    await expect(page.locator('.practice-heading')).not.toContainText('Starts in');
  } finally {await input.close();}
});
