import { test, expect } from '@playwright/test';
import { LESSONS, openLesson, readPractice, practiceInput, playPractice } from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local production tutorial checks');
const errors = new WeakMap();
test.beforeEach(({page}) => { const list=[]; errors.set(page,list); page.on('pageerror',e=>list.push(e.message)); });
test.afterEach(({page}) => expect(errors.get(page)).toEqual([]));

for (const lesson of LESSONS) {
  test(`${lesson}: complete the real lesson with ordinary controls`, async ({page,browserName,hasTouch}) => {
    test.setTimeout(100000);
    await openLesson(page,lesson);
    const input=await practiceInput(page,browserName,hasTouch);
    try {
      const visited=new Set();
      const result=await playPractice(page,input,{onStage:async v=>{
        visited.add(v.stage);
        if(v.lesson==='combat'&&v.stage==='aim'&&v.phase==='waiting'){
          await page.waitForTimeout(120);
          const visible=await page.evaluate(()=>{
            const m=window.game.currentGameMode,s=m.multiplayerManager.getState(),t=s.players.get(s.practice.targetId),view=m.renderView,c=window.game.canvas,box=c.getBoundingClientRect(),panel=document.querySelector('.practice-panel').getBoundingClientRect();
            const ratio=box.width/c.width,r=(t.width/2+14)*view.scale*ratio;
            const x=box.left+((t.x+t.width/2-view.x)*view.scale+c.width/2)*ratio,y=box.top+((t.y+t.height/2-view.y)*view.scale+c.height/2)*ratio;
            return x-r>=0&&x+r<=innerWidth&&y-r>panel.bottom&&y+r<=innerHeight;
          });
          expect(visible,'the outlined aiming rival must be visible below the lesson panel').toBe(true);
        }
        if (['waiting','resolving'].includes(v.phase)&&['aim','shatter','wound','steal','finish','rear-cover','injured-escape','shoot','place'].includes(v.stage)) await page.screenshot({path:test.info().outputPath(`${lesson}-${v.stage}.png`),scale:'css'});
      }});
      expect(result.completed.split(',')).toContain(lesson);
      await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ascend.practice.v2')).lessons[id],lesson)).toBe('completed');
      expect(result.me.injured).toBe(false);
      expect(result.failures).toBe(0);
      if(lesson==='combat')expect([...visited]).toEqual(expect.arrayContaining(['aim','shatter','wound','approach','steal','finish']));
      if(lesson==='defense')expect([...visited]).toEqual(['rear-cover','injured-escape']);
      await expect(page.getByRole('button',{name:'Play now',exact:true})).toBeVisible();
    } finally { await input.close(); }
  });
}

test('the full tutorial advances through all five lessons and preserves the captured opponent',async({page,browserName,hasTouch})=>{
  test.setTimeout(160000);await openLesson(page,'basics',true);
  const input=await practiceInput(page,browserName,hasTouch),order=[];let captive='';
  try{
    const result=await playPractice(page,input,{maxMs:140000,until:v=>v.lesson==='weapon'&&v.phase==='complete',onStage:async v=>{
      if(order.at(-1)!==v.lesson)order.push(v.lesson);
      if(v.lesson==='combat'&&v.stage==='aim')captive=v.me.gulping;
    }});
    expect(order).toEqual(LESSONS);expect(result.completed.split(',')).toEqual(LESSONS);expect(captive).toMatch(/^practice-basics-ammo-/);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ascend.practice.v2')).status)).toBe('completed');
    await page.screenshot({path:test.info().outputPath('five-lessons-completed.png'),scale:'css'});
    await page.getByRole('button',{name:'Play now',exact:true}).click();
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled===false);
    expect(await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping)).toBeFalsy();
  }finally{await input.close();}
});

test('a 320px phone completes the full sequence with reduced motion and reachable controls',async({page,browserName,hasTouch})=>{
  test.skip(browserName!=='chromium'||!hasTouch,'one trusted small-phone sequence');test.setTimeout(160000);
  await page.setViewportSize({width:320,height:812});await page.emulateMedia({reducedMotion:'reduce'});
  await openLesson(page,'basics',true);const input=await practiceInput(page,browserName,hasTouch),seen=new Set();
  try{
    const result=await playPractice(page,input,{maxMs:140000,until:v=>v.lesson==='weapon'&&v.phase==='complete',onStage:async v=>{
      const bounds=await page.locator('.practice-panel').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(321);expect(bounds.y+bounds.height).toBeLessThan(642);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThan(2);
      if(!seen.has(v.lesson)){seen.add(v.lesson);await page.screenshot({path:test.info().outputPath(`320-${v.lesson}.png`),scale:'css'});}
    }});
    expect(result.completed.split(',')).toEqual(LESSONS);expect([...seen]).toEqual(LESSONS);
  }finally{await input.close();}
});
