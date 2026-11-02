import {test,expect} from '@playwright/test';
import {openLesson,readPractice,practiceInput,playPractice} from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E,'explicit local tutorial checks');
test.beforeEach(({page})=>page.on('pageerror',e=>{throw e;}));

test('Ready waits without a countdown and a held stick survives the automatic grow-to-capture transition',async({page,browserName,hasTouch})=>{
  await openLesson(page,'basics',true);const input=await practiceInput(page,browserName,hasTouch);
  try{
    const before=await readPractice(page);expect(before.phase).toBe('ready');
    await expect(page.locator('.practice-countdown')).toHaveCount(0);
    await input.move(1,0);await page.waitForTimeout(3300);
    const waiting=await readPractice(page);expect(waiting.phase).toBe('ready');expect(waiting.me.x).toBeCloseTo(before.me.x,1);
    await input.tapButton(page.getByRole('button',{name:'Ready',exact:true}));
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.stage==='capture');
    const moved=await readPractice(page);
    await expect.poll(async()=>(await readPractice(page)).me.x-moved.me.x).toBeGreaterThan(6);
    if(hasTouch)expect(await page.evaluate(()=>!!window.game.currentGameMode.controls.stick)).toBe(true);
    await page.screenshot({path:test.info().outputPath('held-stick-after-transition.png'),scale:'css'});
  }finally{await input.close();}
});

test('the captured player and visible rival stay in the same arena without a capture-to-aim teleport',async({page,browserName,hasTouch})=>{
  test.setTimeout(90000);await openLesson(page,'basics',true);const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>v.lesson==='basics'&&v.phase==='complete'});
    const before=await page.evaluate(()=>{const m=window.game.currentGameMode,s=m.multiplayerManager.getState(),p=m.multiplayerManager.getLocalPlayer();
      const entry=[...s.players.entries()].find(([id])=>id.includes('smaller-rival'));
      const t=entry?.[1],v=m.renderView,box=m.game.canvas.getBoundingClientRect();
      const sx=box.width/m.game.canvas.width,r=(t.width/2+12)*v.scale*sx;
      const x=box.left+((t.x+t.width/2-v.x)*v.scale+m.game.canvas.width/2)*sx,y=box.top+((t.y+t.height/2-v.y)*v.scale+m.game.canvas.height/2)*sx;
      return{x:p.x+p.width/2,y:p.y+p.height/2,ammo:p.gulping,rival:entry[0],width:s.worldWidth,height:s.worldHeight,
        visible:x-r>=0&&x+r<=innerWidth&&y-r>document.querySelector('.practice-panel').getBoundingClientRect().bottom&&y+r<=innerHeight};});
    expect(before.visible).toBe(true);
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.lesson==='combat');
    const after=await readPractice(page);expect(after.phase).toBe('ready');expect(after.me.gulping).toBe(before.ammo);
    expect(after.targetId).toBe(before.rival);expect(after.me.x).toBeCloseTo(before.x,1);expect(after.me.y).toBeCloseTo(before.y,1);
    expect(await page.evaluate(()=>{const s=window.game.currentGameMode.multiplayerManager.getState();return[s.worldWidth,s.worldHeight];})).toEqual([before.width,before.height]);
    await page.screenshot({path:test.info().outputPath('capture-to-aim-continuity.png'),scale:'css'});
  }finally{await input.close();}
});

test('a prepared joystick moves immediately on Ready for injured escape without lifting the thumb',async({page,browserName,hasTouch})=>{
  test.setTimeout(90000);await openLesson(page,'defense');const input=await practiceInput(page,browserName,hasTouch);
  try{
    await playPractice(page,input,{until:v=>v.stage==='injured-escape'&&v.phase==='ready'});
    const before=await readPractice(page);await input.move(1,0);
    await input.tapButton(page.getByRole('button',{name:'Ready',exact:true}));
    await expect.poll(async()=>(await readPractice(page)).me.x-before.me.x,{timeout:2000}).toBeGreaterThan(6);
    const started=await readPractice(page);expect(started.phase).toBe('waiting');expect(started.me.injured).toBe(true);
    if(hasTouch)expect(await page.evaluate(()=>!!window.game.currentGameMode.controls.stick)).toBe(true);
    await page.screenshot({path:test.info().outputPath('injured-ready-held-stick.png'),scale:'css'});
  }finally{await input.close();}
});
