import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {gemClearOfHoles} from '../../server/dist/game/arenaPlacement.js';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local placement only');
test('the full live gem field leaves the black-hole rings clear',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:950,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!window.game.currentGameMode.introPlaying);
 const read=()=>page.evaluate(()=>{const s=window.game.currentGameMode.multiplayerManager.getState();return{time:s.time,holes:[...s.blackHoles].map(h=>({x:h.x,y:h.y,radius:h.radius,activeAt:h.activeAt})),gems:[...s.gems.values()].map(g=>({x:g.x,y:g.y,value:g.value}))};});
 const first=await read();expect(first.gems.length).toBeGreaterThanOrEqual(940);expect(first.holes.length).toBe(3);
 expect(first.gems.every(g=>gemClearOfHoles(g,first.holes))).toBe(true);
 await page.evaluate(h=>window.game.currentGameMode.multiplayerManager.room.send('test:moveTo',{x:h.x+170,y:h.y+170}),first.holes[0]);
 await page.waitForFunction(()=>{const s=window.game.currentGameMode.multiplayerManager.getState();return s.time>=[...s.blackHoles][0].activeAt;});
 const after=await read();expect(after.gems.length).toBeGreaterThanOrEqual(940);expect(after.gems.every(g=>gemClearOfHoles(g,after.holes))).toBe(true);
 writeFileSync(info.outputPath('gem-clearance.json'),JSON.stringify({gemCount:after.gems.length,holeCount:after.holes.length,overlaps:after.gems.filter(g=>!gemClearOfHoles(g,after.holes)).length},null,2));
 await page.screenshot({path:info.outputPath('clear-black-hole-ring.png'),scale:'css'});expect(errors).toEqual([]);
});
