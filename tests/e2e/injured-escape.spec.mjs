import { test, expect } from '@playwright/test';
import { openLesson, readPractice, practiceInput, playPractice } from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E,'explicit local injury-escape review');
test('injured escape allows reading and a delayed analog retreat on ordinary controls',async({page,browserName,hasTouch})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try {
    await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='ready'});
    const prepared=await readPractice(page);
    expect(prepared.me.injured).toBe(false);
    expect(Math.abs(prepared.target.x-prepared.me.x)).toBeCloseTo(600,0);
    await page.waitForTimeout(1200);
    const ready=page.getByRole('button',{name:'Ready',exact:true});
    await input.tapButton(ready);
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='waiting');
    await page.waitForTimeout(1100);
    await input.move(.25,0);await page.waitForTimeout(65);
    await input.move(.5,0);await page.waitForTimeout(65);
    await input.move(1,0);
    if(hasTouch)expect(await page.evaluate(()=>{
      const v=window.game.currentGameMode.controls.vector(0,0,1);return Math.hypot(v.x,v.y);
    })).toBeCloseTo(1,5);
    await page.waitForTimeout(350);
    const moving=await readPractice(page);
    expect(moving.me.x-prepared.me.x).toBeGreaterThan(25);
    expect(moving.me.injured).toBe(true);
    expect(moving.failures).toBe(0);
    await page.screenshot({path:test.info().outputPath('injured-escape-after-delayed-input.png'),scale:'css'});
    await expect.poll(async()=>(await readPractice(page)).phase,{timeout:10000,intervals:[100]}).toBe('complete');
    const result=await readPractice(page);
    expect(result.me.injured).toBe(false);expect(result.failures).toBe(0);expect(result.completed.split(',')).toContain('defense');
    expect(errors).toEqual([]);
  } finally {await input.close();}
});
