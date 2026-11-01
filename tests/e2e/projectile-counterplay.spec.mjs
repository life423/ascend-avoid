import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
import { orbitalPosition, weaponProfile } from '../../server/dist/game/weaponKit.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local weapon checks');
async function prepare(page, baseURL, kind, small = false) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off');
    window.shotPaint = { hot: 0, cold: 0, arrows: 0, longDashes: 0 };
    const line = CanvasRenderingContext2D.prototype.lineTo, move = CanvasRenderingContext2D.prototype.moveTo;
    CanvasRenderingContext2D.prototype.moveTo = function(x,y) {
      this.lastShotPoint = {x,y};
      if (x === 10 && y === 0 && this.fillStyle === '#ff896f') {
        window.shotPaint.arrows++;
        const transform=this.getTransform(),r=this.canvas.getBoundingClientRect();
        window.shotPaint.arrowPoint={x:r.left+transform.e*r.width/this.canvas.width,y:r.top+transform.f*r.height/this.canvas.height};
      }
      return move.call(this,x,y);
    };
    CanvasRenderingContext2D.prototype.lineTo = function(x,y) {
      if (this.strokeStyle === '#ff896f') window.shotPaint.hot++;
      if (this.strokeStyle === '#a7c6d6') window.shotPaint.cold++;
      if (this.getLineDash().length && this.lastShotPoint && Math.hypot(x-this.lastShotPoint.x,y-this.lastShotPoint.y)>350) window.shotPaint.longDashes++;
      this.lastShotPoint = {x,y}; return line.call(this,x,y);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true}),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const room = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/,'ws')).joinById(room,{name:'Weapon builder'}); peer.onMessage('*',()=>{});
  peer.send('test:setGems',{count:1000});
  await expect.poll(()=>peer.state.players?.get(peer.sessionId)?.gems).toBe(1000);
  const width=peer.state.players.get(peer.sessionId).width;
  peer.send('test:moveTo',{x:2000-width/2,y:2000-width/2}); peer.send('test:face',{angle:0});
  peer.send('test:pinwheel',{kind,x:2000,y:2000});
  await expect.poll(()=>peer.state.pinwheel.phase).toBe('carried');
  peer.send('placeWeapon'); await expect.poll(()=>peer.state.pinwheel.phase).toBe('charging');
  const w=peer.state.pinwheel, profile=weaponProfile(kind);
  const at=profile.orbit?orbitalPosition(w.originX,w.originY,profile.shotMs-650,4200,4200,kind):w;
  const horizontal = page.viewportSize().width <= page.viewportSize().height;
  await page.evaluate(({x,y,small})=>{
    const m=window.game.currentGameMode,room=m.multiplayerManager.room;
    room.send('test:setGems',{count:small?0:100});
    room.send('test:protect',{ms:small?0:10000});
    const p=m.multiplayerManager.getLocalPlayer();
    room.send('test:moveTo',{x:x-p.width/2,y:y-p.height/2});
  },{x:at.x+(small?(horizontal?618:0):280),y:at.y+(small?(horizontal?0:618):150),small});
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems===0||window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems===100);
  return {peer,errors,horizontal};
}

for(const kind of ['pinwheel','sentinel','ricochet']) test(`${kind}: compact charge, hollow capsules and live tracers without dotted firing lanes`,async({page,baseURL})=>{
  const {peer,errors}=await prepare(page,baseURL,kind);
  try {
    await expect.poll(()=>peer.state.pinwheel.phase).toBe('active');
    await page.evaluate(()=>{window.shotPaint.hot=window.shotPaint.cold=window.shotPaint.longDashes=0;});
    if(kind!=='pinwheel') {
      await expect.poll(()=>peer.state.pinwheel.nextShotAt-peer.state.time).toBeLessThan(600);
      await page.screenshot({path:test.info().outputPath(`${kind}-muzzle-charge.png`),scale:'css'});
    }
    await expect.poll(()=>page.evaluate(()=>window.shotPaint.cold)).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath(`${kind}-hollow-launch.png`),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>window.shotPaint.hot)).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath(`${kind}-live-tracers.png`),scale:'css'});
    expect(await page.evaluate(()=>window.shotPaint.longDashes)).toBe(0);
    expect(errors).toEqual([]);
  } finally {await peer.leave();}
});

test('an offscreen satellite shot gives a compact edge cue and ordinary controls can sidestep it',async({page,baseURL,browserName,hasTouch})=>{
  const {peer,errors,horizontal}=await prepare(page,baseURL,'sentinel',true);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await expect.poll(()=>page.evaluate(()=>window.shotPaint.arrows),{timeout:8000}).toBeGreaterThan(0);
    expect(await page.evaluate(()=>{const p=window.shotPaint.arrowPoint;return document.elementFromPoint(p.x,p.y)?.tagName;})).toBe('CANVAS');
    await page.screenshot({path:test.info().outputPath('satellite-edge-warning.png'),scale:'css'});
    await input.move(horizontal?0:-1,horizontal?-1:0);
    await page.waitForTimeout(1400);
    const result=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return {alive:p.state,injury:p.injuredUntil};});
    expect(result.alive).toBe('alive'); expect(result.injury).toBe(0); expect(errors).toEqual([]);
  } finally {await input.close();await peer.leave();}
});
