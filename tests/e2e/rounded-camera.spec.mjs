import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {Client} from 'colyseus.js';
import {practiceInput} from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await enterGame(page);await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 await send(page,'test:clearHoles');
}
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
const read=page=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),v=m.lastView;return {v,p:{x:m.predicted?.x??p.x,y:m.predicted?.y??p.y,size:p.width,state:p.state},w:m.multiplayerManager.room.state.worldWidth,h:m.multiplayerManager.room.state.worldHeight};});
function check(s){
 const {v,p,w,h}=s;
 for(const x of [v.x-v.width/2,v.x+v.width/2])for(const y of [v.y-v.height/2,v.y+v.height/2]){
  expect(x).toBeGreaterThanOrEqual(-.01);expect(y).toBeGreaterThanOrEqual(-.01);expect(x).toBeLessThanOrEqual(w+.01);expect(y).toBeLessThanOrEqual(h+.01);
 }
 if(p.state==='alive')for(const d of [p.x+p.size/2-v.x+v.width/2,v.x+v.width/2-p.x-p.size/2,p.y+p.size/2-v.y+v.height/2,v.y+v.height/2-p.y-p.size/2])expect(d).toBeGreaterThanOrEqual(p.size*.1-.1);
}

test('a giant can see a nearby rival against the curved wall before and during inhale', async ({page, baseURL, browserName, hasTouch}) => {
  if (!hasTouch) await page.setViewportSize({width:1280, height:720});
  await start(page);
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const rival = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, {name:'Corner rival'});
  rival.onMessage('*', () => {});
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    const rivalPosition = () => page.evaluate(id => {
      const mode = window.game.currentGameMode, rival = mode.multiplayerManager.getState().players.get(id);
      return rival ? {x:rival.x, y:rival.y, width:rival.width, protected:rival.spawnProtected} : null;
    }, rival.sessionId);
    // Keep the random spawn away from the giant while staging the two bodies on separate sockets.
    const parkedAt = {x:3500, y:700};
    rival.send('test:protect', {ms:30_000});
    rival.send('test:moveTo', parkedAt);
    await expect.poll(rivalPosition).toEqual({...parkedAt, width:20, protected:true});
    await send(page, 'test:setGems', {count:2_000_000});
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width === 1470);
    // The southwest corner keeps the encounter clear of the score and leaderboard.
    const giantAt = {x:25, y:2705}; // Width 1470 places its center at (760, 3440).
    const rivalAt = {x:166, y:3920}; // A 20-wide peer clears the rounded wall margin here.
    const southwest = 3 * Math.PI / 4;
    // Turn using real controls away from the wall. The large move into the fixture then
    // snaps prediction to the server pose instead of blending away residual wall contact.
    await send(page, 'test:moveTo', {x:1365, y:1365});
    await page.waitForFunction(() => {
      const mode = window.game.currentGameMode, player = mode.multiplayerManager.getLocalPlayer();
      const at = mode.predicted ?? player;
      return Math.hypot(at.x + player.width / 2 - 2100, at.y + player.height / 2 - 2100) < 20;
    }, undefined, {timeout:8000});
    await input.move(-1 / Math.SQRT2, 1 / Math.SQRT2);
    await page.waitForFunction(angle => Math.abs(Math.sin((window.game.currentGameMode.localFacing - angle) / 2)) < .02,
      southwest);
    await input.stop();
    await page.waitForTimeout(400); // Let release inertia settle before restoring the exact starting pose.
    await send(page, 'test:moveTo', giantAt);
    await send(page, 'test:face', {angle:southwest});
    await send(page, 'test:protect', {ms:0});
    await expect.poll(() => page.evaluate(giantAt => {
      const mode = window.game.currentGameMode, local = mode.multiplayerManager.getLocalPlayer();
      // Upkeep shrinks width around the center, so the top-left pose drifts even when stationary.
      const p = mode.predicted ?? local, inset = (1470 - local.width) / 2;
      return {
        giant: local.state === 'alive' && local.width > 1460,
        serverAtCorner: Math.hypot(local.x - giantAt.x - inset, local.y - giantAt.y - inset) < 8,
        giantAtCorner: Math.hypot(p.x - giantAt.x - inset, p.y - giantAt.y - inset) < 16,
        zoomSettled: mode.cameraRig.short > 4050,
      };
    }, giantAt), {timeout:10_000}).toEqual({giant:true, serverAtCorner:true, giantAtCorner:true, zoomSettled:true});
    // Keep the real peer in place while checking steady camera geometry during suction.
    rival.send('test:protect', {ms:15_000});
    rival.send('test:moveTo', rivalAt);
    await expect.poll(rivalPosition).toEqual({...rivalAt, width:20, protected:true});
    await page.waitForFunction(({id, rivalAt}) => {
      const drawn = window.game.currentGameMode.drawnPositions.get(id);
      return drawn && Math.hypot(drawn.x - rivalAt.x, drawn.y - rivalAt.y) < 1;
    }, {id:rival.sessionId, rivalAt}, {timeout:5000});

    const rendered = () => page.evaluate(id => {
      const mode = window.game.currentGameMode, manager = mode.multiplayerManager;
      const local = manager.getLocalPlayer(), remote = manager.getState().players.get(id);
      const drawn = mode.drawnPositions.get(id), view = mode.lastView;
      const x = drawn.x + remote.width / 2, y = drawn.y + remote.height / 2;
      const radius = (mode.drawnSizes.get(id)?.size ?? remote.width) / 2;
      const inset = Math.min(x - view.x + view.width / 2, view.x + view.width / 2 - x,
        y - view.y + view.height / 2, view.y + view.height / 2 - y);
      return {scale:view.scale, diskInset:inset - radius, rivalState:remote.state, capturedBy:remote.capturedBy,
        inhaling:local.inhaling, facing:mode.localFacing};
    }, rival.sessionId);
    const idle = await rendered();
    const checkRival = sample => {
      expect(sample.rivalState).toBe('alive');
      expect(sample.capturedBy).toBe('');
      expect(sample.diskInset, 'the drawn rival body fits inside the canvas').toBeGreaterThanOrEqual(-.1);
    };
    check(await read(page));
    checkRival(idle);
    await page.screenshot({path:test.info().outputPath('corner-rival-idle.png'), scale:'css'});
    await input.hold();
    await expect.poll(async () => (await rendered()).inhaling).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(100);
      const active = await rendered();
      expect(active.inhaling).toBe(true);
      expect(Math.abs(Math.sin((active.facing - southwest) / 2))).toBeLessThan(.04);
      checkRival(active);
      // Normal giant upkeep and its size spring can still change scale by a subpixel amount.
      expect(Math.abs(active.scale / idle.scale - 1)).toBeLessThan(.001);
    }
    await page.screenshot({path:test.info().outputPath('corner-rival-inhale.png'), scale:'css'});
    await input.releaseAction();
    await expect.poll(async () => (await rendered()).inhaling).toBe(false);
    checkRival(await rendered());
  } finally {
    await input.close();
    await rival.leave();
  }
});

for(const [label,gems]of [['small',0],['large',1000],['giant',1e9]])test(`${label}: all rounded corners keep the viewport inside and the player visible while moving`,async({page,browserName,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await send(page,'test:setGems',{count:gems});
 await page.waitForFunction(label=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return label==='giant'?p.width>1200:label==='large'?p.width>290:p.width===20;},label);
 const size=(await read(page)).p.size,input=await practiceInput(page,browserName,hasTouch);
 try{
  for(const sx of [-1,1])for(const sy of [-1,1])for(const deg of [15,45,75]){
   const a=deg*Math.PI/180,inset=Math.max(700,size/2+8),inner=Math.max(0,700-size/2-8),x=(sx<0?inset:4200-inset)+sx*inner*Math.cos(a)-size/2,y=(sy<0?inset:4200-inset)+sy*inner*Math.sin(a)-size/2;
   await send(page,'test:moveTo',{x,y});
   await page.waitForFunction(({x,y})=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return Math.hypot(p.x-x,p.y-y)<18&&Math.hypot(m.predicted.x-p.x,m.predicted.y-p.y)<10;},{x,y});
   await page.waitForTimeout(35);check(await read(page));
   if(deg===45){
    await page.screenshot({path:test.info().outputPath(`${label}-${sx}-${sy}.png`),scale:'css'});
    await input.move(-sy/Math.SQRT2,sx/Math.SQRT2);
    for(let i=0;i<3;i++){await page.waitForTimeout(80);check(await read(page));}
    await input.stop();await page.waitForTimeout(150);
   }
  }
  if(hasTouch){const {width,height}=page.viewportSize();await page.setViewportSize({width:height,height:width});await page.waitForTimeout(150);check(await read(page));await page.screenshot({path:test.info().outputPath(`${label}-rotated.png`),scale:'css'});}
  expect(errors).toEqual([]);
 }finally{await input.close();}
});

test('growth, knockout hold and respawn retain curved framing',async({page})=>{
 await start(page);await send(page,'test:moveTo',{x:205,y:205});await page.waitForTimeout(150);
 await send(page,'test:setGems',{count:1e9});
 for(let i=0;i<10;i++){await page.waitForTimeout(80);check(await read(page));}
 await send(page,'test:setGems',{count:0});await page.waitForTimeout(100);check(await read(page));
 await send(page,'test:protect',{ms:0});await send(page,'test:hit');
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().state==='dead');check(await read(page));
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().state==='alive');check(await read(page));
});
