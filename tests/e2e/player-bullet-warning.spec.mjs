import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {playerBulletScene as scene} from './helpers/player-bullet.mjs';
import {practiceInput} from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local player-projectile checks');
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus){const data=await page.evaluate(()=>({warnings:window.playerWarnings,first:window.warningTelemetry?.slice(0,3),last:window.warningTelemetry?.slice(-3)}));console.log('Warning diagnostic',JSON.stringify(data));await info.attach('warning-diagnostic',{body:JSON.stringify(data,null,2),contentType:'application/json'});}
});

for(const stock of [0,100])test(`a ${stock?'growing':'small'} threatened player gets an early, unobscured edge cue and can sidestep with ordinary controls`,async({page,baseURL,browserName,hasTouch})=>{
  const s=await scene(page,baseURL,stock),input=await practiceInput(page,browserName,hasTouch);
  try{
    await input.prepareMovement();
    await s.fire();await expect.poll(()=>page.evaluate(()=>window.playerWarnings.edges.length),{intervals:[20,30,50]}).toBeGreaterThan(0);
    const first=await page.evaluate(()=>window.playerWarnings.edges[0]);
    expect(first.distance/first.speed).toBeGreaterThan(.65);
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,first)).toBe('CANVAS');
    // Screenshots can block input long enough to turn a nominal 250ms response into
    // a much later one. Measure from the painted cue; capture the idle run instead.
    const elapsed=await page.evaluate(at=>performance.now()-at,first.at);
    if(elapsed<250)await page.waitForTimeout(250-elapsed);
    await input.move(s.horizontal?0:1,s.horizontal?1:0);
    await page.waitForTimeout(1450);
    const p=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{state:p.state,injury:p.injuredUntil};});
    expect(p.state).toBe('alive');expect(p.injury).toBe(0);expect(s.errors).toEqual([]);
    await page.screenshot({path:test.info().outputPath('player-bullet-dodged.png'),scale:'css'});
  }finally{await input.close();await s.close();}
});

test('the warning stays visible through bullet entry and an idle control really gets hit',async({page,baseURL})=>{
  const s=await scene(page,baseURL);
  try{
    await s.fire();await expect.poll(()=>page.evaluate(()=>window.playerWarnings.edges.length),{intervals:[20,30,50]}).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath('player-bullet-edge.png'),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>window.playerWarnings.halos),{intervals:[20,30,50]}).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath('player-bullet-handoff.png'),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return p.state!=='alive'||p.injuredUntil>0;})).toBe(true);
    // Once the flight is spent, the contextual warning must stop painting.
    await page.waitForTimeout(200);
    const painted=await page.evaluate(()=>window.playerWarnings.edges.length);
    await page.waitForTimeout(150);
    expect(await page.evaluate(()=>window.playerWarnings.edges.length)).toBe(painted);
    expect(s.errors).toEqual([]);
  }finally{await s.close();}
});
