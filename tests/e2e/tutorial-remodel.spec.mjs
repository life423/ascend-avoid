import { test, expect } from '@playwright/test';
import { openLesson, readPractice, practiceInput, playPractice, settled } from './helpers/practice.mjs';
test.skip(!process.env.PRACTICE_E2E, 'explicit local tutorial checks');
test.beforeEach(({page})=>{page.on('pageerror',error=>{throw error;});});

test('desktop practice exposes the shared mouse switch without firing or losing preferences',async({page,hasTouch})=>{
  test.skip(hasTouch,'mouse preference is a desktop control');
  await openLesson(page,'combat');
  const control=page.locator('.practice-panel').getByRole('switch',{name:'Mouse control',exact:true});
  await expect(control).toHaveAttribute('aria-checked','false');
  const before=await readPractice(page);
  await control.click();await expect(control).toHaveAttribute('aria-checked','true');
  expect(await page.evaluate(()=>localStorage.getItem('ascend.mouseFollow'))).toBe('on');
  expect((await readPractice(page)).me.gulping).toBe(before.me.gulping);
  await control.focus();await page.keyboard.press('Space');
  await expect(control).toHaveAttribute('aria-checked','false');
  expect((await readPractice(page)).me.gulping).toBe(before.me.gulping);
  expect(await page.evaluate(()=>window.game.currentGameMode.cannonHits.length)).toBe(0);
  await page.screenshot({path:test.info().outputPath('tutorial-mouse-switch.png'),scale:'css'});
  await page.getByRole('button',{name:'Exit tutorial',exact:true}).click();
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled===false);
  await expect(page.locator('.app-header').getByRole('switch',{name:'Mouse control',exact:true})).toHaveAttribute('aria-checked','false');
});

test('old completions are retained while new combat and rear-cover mastery remain honest',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ascend.practice.v1',JSON.stringify({version:1,offered:true,status:'completed',lessons:{basics:'completed',weapon:'completed',blackhole:'completed',defense:'completed'}})));
  await page.goto('/');await page.waitForFunction(()=>!!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await expect(page.locator('.practice-offer')).toBeHidden();
  await page.evaluate(()=>window.drawerUI.open());await page.getByRole('button',{name:'Practice / Tutorials',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Practice / Tutorials'});
  for(const id of ['basics','weapon','blackhole'])await expect(picker.locator(`[data-lesson="${id}"]`)).toContainText('Completed');
  await expect(picker.locator('[data-lesson="combat"]')).toContainText('Ready to try');
  await expect(picker.locator('[data-lesson="defense"]')).toContainText('Updated — try rear cover');
  expect(await picker.locator('[data-lesson]').count()).toBe(5);
  await page.screenshot({path:test.info().outputPath('five-lesson-picker.png'),scale:'css'});
});

test('reading waits for Ready, wrong-direction puffs restore only the attempt, then rear escape succeeds',async({page,browserName,hasTouch})=>{
  test.setTimeout(60000);await openLesson(page,'defense');
  await page.waitForTimeout(1800);expect((await readPractice(page)).phase).toBe('ready');
  expect(await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getState().gustWaves.size)).toBe(0);
  await page.getByRole('button',{name:'Ready',exact:true}).click();await settled(page);
  const input=await practiceInput(page,browserName,hasTouch);
  try{
    for(let miss=0;miss<2;miss++){
      const attempt=(await readPractice(page)).attempt;
      await input.move(-1,0);
      await expect.poll(async()=>Math.abs((await readPractice(page)).me.facing)).toBeGreaterThan(2.8);
      await input.move();await input.tap();
      await page.waitForFunction(a=>window.game.currentGameMode.multiplayerManager.getState().practice.attempt>a,attempt);
      await input.stop();await settled(page);
      const v=await readPractice(page);expect(v.stage).toBe('rear-cover');expect(v.passed).toBe(0);expect(v.failures).toBe(miss+1);
      await expect(page.locator('.practice-feedback')).toBeVisible();
    }
    await expect(page.locator('.practice-hint')).toContainText('quick tap');
    await page.screenshot({path:test.info().outputPath('rear-wave-retry-hint.png'),scale:'css'});
    const result=await playPractice(page,input);expect(result.completed).toContain('defense');
  }finally{await input.close();}
});

test('injured escape blocks both breathing actions and heals after actual movement',async({page,browserName,hasTouch})=>{
  test.setTimeout(60000);await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try{
    const injured=await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='waiting'});
    expect(injured.me.injured).toBe(true);await input.tap();await input.hold();await page.waitForTimeout(250);await input.stop();
    const blocked=await readPractice(page);expect(blocked.me.inhaling).toBe(false);expect(Number.isFinite(blocked.me.stamina)).toBe(true);expect(blocked.me.stamina).toBe(injured.me.stamina);
    expect(await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getState().gustWaves.size)).toBe(0);
    const result=await playPractice(page,input);expect(result.time).toBeGreaterThanOrEqual(injured.me.injuryEnds);expect(result.me.injured).toBe(false);
  }finally{await input.close();}
});

test('a real practice knockout uses the shared safe respawn before restoring its checkpoint',async({page,browserName,hasTouch})=>{
  test.setTimeout(60000);await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try{
    const injured=await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='waiting'});
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().state==='dead',{}, {timeout:14000});
    await expect(page.locator('.practice-instruction')).toContainText('respawn in clear space');
    await page.waitForFunction(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return p.state==='alive'&&p.spawnProtected;});
    expect((await readPractice(page)).phase).toBe('reset');
    await page.screenshot({path:test.info().outputPath('practice-safe-respawn.png'),scale:'css'});
    await page.waitForFunction(a=>window.game.currentGameMode.multiplayerManager.getState().practice.attempt>a,injured.attempt);
    expect((await readPractice(page)).stage).toBe('injured-escape');expect((await readPractice(page)).passed).toBe(1);
  }finally{await input.close();}
});

test('a missed shatter shot restores ammunition and the proven aim without repeating the aim step',async({page,browserName,hasTouch})=>{
  test.setTimeout(45000);await openLesson(page,'combat');const input=await practiceInput(page,browserName,hasTouch);
  try{
    const aimed=await playPractice(page,input,{until:v=>v.stage==='shatter'&&v.phase==='waiting'});
    await input.aim(0,1);await expect.poll(async()=>(await readPractice(page)).me.facing).toBeGreaterThan(1.3);
    await input.stop();await input.tap();
    await page.waitForFunction(a=>window.game.currentGameMode.multiplayerManager.getState().practice.attempt>a,aimed.attempt);
    await input.stop();await settled(page);const restored=await readPractice(page);
    expect(restored.stage).toBe('shatter');expect(restored.passed).toBe(1);expect(restored.me.gulping).toBeTruthy();
    expect(Math.abs(restored.me.facing+Math.PI/4)).toBeLessThan(.1);
    await expect(page.locator('.practice-feedback')).toContainText('restored');
    const result=await playPractice(page,input);expect(result.completed).toContain('combat');
  }finally{await input.close();}
});

test('injury details have a reachable disclosure and preserve the readable Ready stage',async({page,browserName,hasTouch})=>{
  test.setTimeout(45000);await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='ready'});
    const summary=page.locator('.practice-panel summary');expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
    if(hasTouch)await summary.tap();else await summary.click();
    await expect(page.locator('.practice-panel details')).toHaveAttribute('open','');
    await page.waitForTimeout(180);
    const targetClear=await page.evaluate(()=>{
      const m=window.game.currentGameMode,s=m.multiplayerManager.getState(),t=s.players.get(s.practice.targetId),v=m.renderView,c=window.game.canvas,box=c.getBoundingClientRect();
      const top=box.top+((t.y-14-v.y)*v.scale+c.height/2)*box.width/c.width;
      return {top,panel:document.querySelector('.practice-panel').getBoundingClientRect().bottom};
    });
    expect(targetClear.top,'opening injury details must leave the outlined pursuer visible').toBeGreaterThan(targetClear.panel);
    expect((await readPractice(page)).phase).toBe('ready');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThan(2);
    for(const name of ['Ready','Skip lesson','Exit tutorial']){
      const control=page.getByRole('button',{name,exact:true});
      expect(await control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit));})).toBe(true);
    }
    await page.screenshot({path:test.info().outputPath('expanded-injury-details.png'),scale:'css'});
    const ready=page.getByRole('button',{name:'Ready',exact:true});
    if(hasTouch)await ready.tap();else await ready.click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await expect(page.locator('.practice-panel details')).toBeHidden();
    const result=await playPractice(page,input);expect(result.completed).toContain('defense');
  }finally{await input.close();}
});
