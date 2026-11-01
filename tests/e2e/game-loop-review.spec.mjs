import { test, expect } from '@playwright/test';
import { practiceInput } from './helpers/practice.mjs';
import { writeFile } from 'node:fs/promises';

// Explicit opt-in and loopback only. Natural game rooms, no test: messages or seeded rewards.
test.skip(process.env.LOCAL_LOOP_REVIEW !== '1', 'local observational review, not a deterministic release test');
test.use({ video: 'on' });

const managed = process.env.LOOP_BREATH === 'managed';
test(`observe ordinary opening play with visible-world decisions and real controls (${managed ? 'release and refill' : 'continuous hold'})`, async ({ page, browserName, hasTouch }, info) => {
  test.setTimeout(210000);
  const base = process.env.E2E_URL || '';
  expect(new URL(base).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('ascend.mouseFollow', 'off'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({ url: route.request().url().replace('/joinOrCreate/', '/create/') }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  await page.screenshot({ path: info.outputPath('first-visit.png'), scale: 'css' });
  const offer = page.getByRole('button', { name: 'Not now', exact: true });
  if (await offer.isVisible()) await offer.click();
  await page.evaluate(() => {
    window.loopEvents = [];
    const room = window.game.currentGameMode.multiplayerManager.getRoom();
    for (const type of ['capture','launch','partCollected','weaponAssembled','weaponPlaced','credit','parry','combatReward','impact'])
      room.onMessage(type, data => { if (window.loopEvents.length < 2500) window.loopEvents.push({ type, time: room.state.time, ...data }); });
  });
  const input = await practiceInput(page, browserName, hasTouch), samples = [], began = Date.now();
  let lastSample = -1, lastShot = '', lastPuff = 0, refilling = false;
  try {
    while (Date.now() - began < 150000) {
      const v = await page.evaluate(() => {
        const m = window.game.currentGameMode, manager = m.multiplayerManager, s = manager.getState(), p = manager.getLocalPlayer(), view = m.renderView;
        const seen = (x,y,r=0) => view && Math.abs(x-view.x)<=view.width/2+r && Math.abs(y-view.y)<=view.height/2+r;
        const all = [s.pinwheel,...s.weaponSets.values()];
        return { time:s.time,id:manager.getRoom().sessionId,me:{x:p.x+p.width/2,y:p.y+p.height/2,width:p.width,gems:p.gems,state:p.state,
          facing:p.facing,injured:p.breathingBlocked,captured:p.capturedBy,flying:p.flying,gulping:p.gulping,inhaling:p.inhaling,stunned:p.stunned,
          stamina:m.stamina,breath:m.breath.phase,holding:!!m.controls?.press?.held},
          world:{width:s.worldWidth,height:s.worldHeight},view,occupants:s.players.size,
          others:[...s.players.values()].filter(o=>o!==p&&o.state==='alive'&&!o.capturedBy&&!o.flying&&seen(o.x+o.width/2,o.y+o.height/2,o.width/2))
            .map(o=>({x:o.x+o.width/2,y:o.y+o.height/2,width:o.width,injured:o.breathingBlocked,protected:o.spawnProtected})),
          gems:[...s.gems.values()].filter(g=>!g.falling&&!(g.locked&&g.owner===manager.getRoom().sessionId)&&seen(g.x,g.y,12)).map(g=>({x:g.x,y:g.y})),
          builds:all.map(w=>({owner:w.owner,phase:w.phase,kind:w.kind,parts:[...w.parts.values()].filter(part=>!part.carriedBy&&seen(part.x,part.y,48)).map(part=>({x:part.x,y:part.y}))})),
          active:all.filter(w=>w.phase==='active').length,bolts:all.reduce((n,w)=>n+w.bolts.size,0) };
      });
      expect(v.occupants).toBe(20);
      expect(v.view.x-v.view.width/2).toBeGreaterThanOrEqual(-1);
      expect(v.view.y-v.view.height/2).toBeGreaterThanOrEqual(-1);
      expect(v.view.x+v.view.width/2).toBeLessThanOrEqual(v.world.width+1);
      expect(v.view.y+v.view.height/2).toBeLessThanOrEqual(v.world.height+1);
      const second = Math.floor((Date.now()-began)/1000);
      if (Math.floor(second/5)>lastSample) {
        samples.push({ second,...v.me,active:v.active,bolts:v.bolts,seenPlayers:v.others.length,visibleParts:v.builds.reduce((n,w)=>n+w.parts.length,0) });
        lastSample=Math.floor(second/5);
        if (second%30<5) await page.screenshot({ path:info.outputPath(`opening-${second}s.png`),scale:'css' });
      }
      const point=v.me, d=o=>Math.hypot(o.x-point.x,o.y-point.y), toward=async o=>{const length=d(o)||1;await input.move((o.x-point.x)/length,(o.y-point.y)/length);};
      if(point.state!=='alive'||point.captured||point.flying) await input.stop();
      else if(point.gulping){
        await input.releaseAction();const target=v.others.filter(o=>!o.protected).sort((a,b)=>d(a)-d(b))[0];
        if(target){const length=d(target)||1,angle=Math.atan2(target.y-point.y,target.x-point.x),gap=Math.abs(Math.atan2(Math.sin(angle-point.facing),Math.cos(angle-point.facing)));
          if(gap>.12)await input.aim((target.x-point.x)/length,(target.y-point.y)/length);
          else if(lastShot!==point.gulping){await input.stop();await input.tap();lastShot=point.gulping;}
        }else if(lastShot!==point.gulping){await input.stop();await input.tap();lastShot=point.gulping;}
      }else{
        lastShot='';
        const threat=v.others.filter(o=>!o.injured&&o.width>=point.width*1.3&&d(o)-(o.width+point.width)/2<250).sort((a,b)=>d(a)-d(b))[0];
        const carried=v.builds.some(w=>w.owner===v.id&&w.phase==='carried');
        if(threat){await input.releaseAction();await toward({x:point.x*2-threat.x,y:point.y*2-threat.y});if(!point.injured&&Date.now()-lastPuff>2000){await input.tap();lastPuff=Date.now();}}
        else if(carried){await input.releaseAction();const place=page.getByRole('button',{name:'Place weapon',exact:true});if(await place.isVisible()){if(hasTouch)await input.tapButton(place);else await page.keyboard.press('e');}}
        else{
          const owned=v.builds.find(w=>w.owner===v.id&&w.phase==='parts');
          const part=(owned?[owned]:v.builds.filter(w=>!w.owner&&w.phase==='parts')).flatMap(w=>w.parts).sort((a,b)=>d(a)-d(b))[0];
          const prey=v.others.filter(o=>!o.protected&&(o.injured||point.width>=o.width*1.3)&&d(o)<300+point.width).sort((a,b)=>d(a)-d(b))[0];
          const goal=part||prey||v.gems.sort((a,b)=>d(a)-d(b))[0];
          if(managed && point.stamina<.15)refilling=true;
          if(point.stamina>=.75)refilling=false;
          if(goal){await toward(goal);if(refilling)await input.releaseAction();else await input.hold();}else{await input.releaseAction();await toward({x:v.world.width/2,y:v.world.height/2});}
        }
      }
      await page.waitForTimeout(260);
    }
    await input.stop();
    const events=await page.evaluate(()=>window.loopEvents), id=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getRoom().sessionId);
    const own=events.filter(e=>e.byId===id||e.targetId===id||e.id===id);
    const report=info.outputPath('opening-observations.json');
    await writeFile(report,JSON.stringify({project:info.project.name,managedBreath:managed,id,method:'150 seconds ordinary fresh arena, 20 occupants, current built client/server, visible-world scripted choices and normal keyboard/touch input; no game fixtures, grants, teleports or tutorial. Not a human playtest or latency benchmark.',samples,ownEvents:own,errors},null,2));
    await info.attach('opening-observations',{path:report,contentType:'application/json'});
    await page.screenshot({path:info.outputPath('opening-end.png'),scale:'css'});
    expect(errors).toEqual([]);
    expect(samples.length).toBeGreaterThanOrEqual(25);
  }finally{await input.close();}
});
