import {test,expect} from '@playwright/test';
import {openLesson,readPractice,practiceInput,playPractice} from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E,'explicit local tutorial checks');
test.beforeEach(({page})=>page.on('pageerror',error=>{throw error;}));
const heldShot=page=>page.evaluate(()=>{
  const m=window.game.currentGameMode,s=m.multiplayerManager.getState(),p=m.multiplayerManager.getLocalPlayer();
  return {id:p.gulping,budget:p.gulpEndsAt-s.time,gems:p.gems,x:p.x,y:p.y,attempt:s.practice.attempt,failures:s.practice.failures,phase:s.practice.phase};
});

test('reading before aiming preserves the captured opponent and remaining shot time',async({page,browserName,hasTouch})=>{
  test.setTimeout(65000);await openLesson(page,'basics',true);const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>v.lesson==='combat'&&v.stage==='aim'&&v.phase==='ready'});
    const before=await heldShot(page);expect(before.id).toMatch(/^practice-basics-ammo-/);
    await expect(page.locator('.practice-instruction')).toContainText('Your captive waits here');
    await page.waitForTimeout(7500);
    await input.move(1,0);await input.hold();await page.waitForTimeout(250);await input.stop();
    const after=await heldShot(page);
    expect(after).toMatchObject({id:before.id,gems:before.gems,x:before.x,y:before.y,attempt:before.attempt,failures:0,phase:'ready'});
    expect(Math.abs(after.budget-before.budget)).toBeLessThan(150);
    await page.screenshot({path:test.info().outputPath('reading-before-aim.png'),scale:'css'});
    const ready=page.getByRole('button',{name:'Ready',exact:true});if(hasTouch)await ready.tap();else await ready.click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    const started=await heldShot(page);expect(started.id).toBe(before.id);expect(started.budget).toBeLessThanOrEqual(before.budget+80);
    const result=await playPractice(page,input);expect(result.completed).toContain('combat');expect(result.failures).toBe(0);
  }finally{await input.close();}
});

test('the first visible Place action deploys once without a false retry',async({page,browserName,hasTouch})=>{
  test.setTimeout(45000);await openLesson(page,'weapon');const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>(v.stage==='collect'&&v.phase==='success')||(v.stage==='place'&&v.phase==='waiting')});
    const place=page.getByRole('button',{name:/Place weapon/});
    if(hasTouch)await place.tap();else await place.click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='complete');
    const result=await readPractice(page);expect(result.completed).toContain('weapon');expect(result.failures).toBe(0);
    await page.screenshot({path:test.info().outputPath('first-place-succeeds.png'),scale:'css'});
  }finally{await input.close();}
});

test('a held puff gets immediate coaching and can be corrected in the same attempt',async({page,browserName,hasTouch})=>{
  test.setTimeout(45000);await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try{
    const ready=page.getByRole('button',{name:'Ready',exact:true});if(hasTouch)await ready.tap();else await ready.click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await input.move(1,0);await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.cue==='attacking');
    const before=await readPractice(page);await input.hold();await page.waitForTimeout(220);
    await expect(page.locator('.practice-feedback')).toContainText('That was an inhale',{timeout:1000});
    const coached=await readPractice(page);expect(coached.attempt).toBe(before.attempt);expect(coached.failures).toBe(0);
    await page.screenshot({path:test.info().outputPath('immediate-puff-coaching.png'),scale:'css'});
    await input.releaseAction();await input.tap();
    await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='ready'});
    await page.locator('.practice-panel summary').click();
    const start=page.getByRole('button',{name:'Ready',exact:true});if(hasTouch)await start.tap();else await start.click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await expect(page.locator('.practice-panel details')).toBeHidden();
    const result=await playPractice(page,input);expect(result.completed).toContain('defense');expect(result.failures).toBe(0);
  }finally{await input.close();}
});

test('aim and theft explanations stay with the next action instead of flashing',async({page,browserName,hasTouch})=>{
  test.setTimeout(45000);await openLesson(page,'combat');const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>v.stage==='shatter'&&v.phase==='waiting'});
    await expect(page.locator('.practice-instruction')).toContainText('Aim set.');
    await page.waitForTimeout(350);await expect(page.locator('.practice-instruction')).toContainText('Aim set.');
    await playPractice(page,input,{until:v=>v.stage==='steal'&&v.phase==='waiting'});
    await expect(page.locator('.practice-instruction')).toContainText('Close enough.');
    await page.waitForTimeout(350);await expect(page.locator('.practice-instruction')).toContainText('you grow and the rival shrinks');
    await page.screenshot({path:test.info().outputPath('readable-theft-cue.png'),scale:'css'});
    const result=await playPractice(page,input);expect(result.completed).toContain('combat');expect(result.failures).toBe(0);
  }finally{await input.close();}
});
