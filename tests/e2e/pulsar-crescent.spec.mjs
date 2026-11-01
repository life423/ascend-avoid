import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local Pulsar checks');
async function prepare(page, baseURL, hit=false) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');
    window.pulsarPaint=[];
    const arc=CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc=function(x,y,r,start,end,...rest){
      if(this.lineWidth===4&&(this.strokeStyle.includes('241, 211, 255')||this.strokeStyle==='#f1d3ff')) {
        window.pulsarPaint.push({r,span:end-start});if(window.pulsarPaint.length>60)window.pulsarPaint.shift();
      }
      return arc.call(this,x,y,r,start,end,...rest);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({
    url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true}),
  }));
  await page.goto('/');
  await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
  const roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
  const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:'Crescent builder'});peer.onMessage('*',()=>{});
  peer.send('test:setGems',{count:1000});
  await expect.poll(()=>peer.state.players?.get(peer.sessionId)?.gems).toBe(1000);
  const width=peer.state.players.get(peer.sessionId).width;
  peer.send('test:moveTo',{x:2000-width/2,y:2000-width/2});peer.send('test:face',{angle:0});
  peer.send('test:pinwheel',{kind:'pulsar',x:2000,y:2000});
  await expect.poll(()=>peer.state.pinwheel.phase).toBe('carried');
  peer.send('placeWeapon');await expect.poll(()=>peer.state.pinwheel.phase).toBe('charging');
  const {x,y}=peer.state.pinwheel;
  await page.evaluate(({x,y,hit})=>{
    const m=window.game.currentGameMode,r=m.multiplayerManager.room;
    r.send('test:setGems',{count:100});r.send('test:protect',{ms:hit?0:15000});
    r.send('test:moveTo',{x:x+(hit?180:0)-50.75,y:y+(hit?0:-220)-50.75});
  },{x,y,hit});
  return {peer,errors};
}

test('Pulsar charges in one direction, emits only a crescent and turns independently during recovery',async({page,baseURL})=>{
  const {peer,errors}=await prepare(page,baseURL);
  try {
    await expect.poll(()=>peer.state.pinwheel.phase,{intervals:[20,50]}).toBe('active');
    const heading=peer.state.pinwheel.angle;
    await page.waitForTimeout(400);expect(peer.state.pinwheel.angle).toBeCloseTo(heading,5);
    await page.screenshot({path:test.info().outputPath('pulsar-locked-charge.png'),scale:'css'});
    await expect.poll(()=>peer.state.pinwheel.pulseAt,{intervals:[20,50]}).toBeGreaterThan(0);
    const wave={at:peer.state.pinwheel.pulseAt,angle:peer.state.pinwheel.pulseFacing,x:peer.state.pinwheel.pulseX,y:peer.state.pinwheel.pulseY};
    await page.waitForTimeout(380);
    expect(peer.state.pinwheel.pulseFacing).toBe(wave.angle);
    expect(peer.state.pinwheel.pulseX).toBe(wave.x);expect(peer.state.pinwheel.pulseY).toBe(wave.y);
    expect(peer.state.pinwheel.angle).toBeGreaterThan(wave.angle);
    await expect.poll(()=>page.evaluate(()=>window.pulsarPaint.length)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.pulsarPaint.every(p=>Math.abs(p.span-Math.PI/2)<1e-6))).toBe(true);
    await page.screenshot({path:test.info().outputPath('pulsar-traveling-crescent.png'),scale:'css'});
    await page.waitForTimeout(1300);
    const locked=peer.state.pinwheel.angle;
    expect(locked-wave.angle).toBeCloseTo(Math.PI/6,4);
    await page.waitForTimeout(300);expect(peer.state.pinwheel.angle).toBeCloseTo(locked,4);
    expect(errors).toEqual([]);
  } finally {await peer.leave();}
});

test('a real crescent hit leaves keyboard or thumb steering and rotation available',async({page,baseURL,browserName,hasTouch})=>{
  const {peer,errors}=await prepare(page,baseURL,true),input=await practiceInput(page,browserName,hasTouch);
  try {
    await page.waitForFunction(()=>{const m=window.game.currentGameMode,s=m.multiplayerManager.room.state,p=m.multiplayerManager.getLocalPlayer();return p.injuredUntil>s.time;});
    const before=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return {y:p.y+p.height/2,facing:p.facing};});
    await input.move(0,1);await page.waitForTimeout(220);
    const after=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return {y:p.y+p.height/2,facing:p.facing,stunned:p.stunned,sliding:p.sliding};});
    expect(after.y-before.y).toBeGreaterThan(6);expect(Math.abs(after.facing-before.facing)).toBeGreaterThan(.05);
    expect(after.stunned).toBe(false);expect(after.sliding).toBe(false);expect(errors).toEqual([]);
  } finally {await input.close();await peer.leave();}
});
