import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {Client} from 'colyseus.js';
import {playerBulletScene} from './helpers/player-bullet.mjs';
import {practiceInput} from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local incoming-warning checks');

async function paintedWarning(page,info,label) {
  await page.waitForFunction(()=>!!window.playerWarnings.firstFrame);
  const frame=await page.evaluate(()=>window.playerWarnings.firstFrame);
  await writeFile(info.outputPath(`${label}.png`),Buffer.from(frame.png.split(',')[1],'base64'));
  const first=await page.evaluate(()=>window.playerWarnings.edges[0]);
  await info.attach(`${label}-telemetry`,{body:JSON.stringify(first,null,2),contentType:'application/json'});
  expect(first.alpha).toBe(1);
  const clearance=await page.evaluate(({x,y})=>{
    const m=window.game.currentGameMode,b=m.game.canvas.getBoundingClientRect(),r=30;
    return {inViewport:x-r>=b.left&&y-r>=b.top&&x+r<=b.right&&y+r<=b.bottom,
      touchesControl:(m.controls?.touchBounds()??[]).some(c=>x+r>c.left&&x-r<c.right&&y+r>c.top&&y-r<c.bottom),
      target:document.elementFromPoint(x,y)?.tagName};
  },first);
  expect(clearance.inViewport).toBe(true);expect(clearance.touchesControl).toBe(false);expect(clearance.target).toBe('CANVAS');
  return first;
}

test('an off-screen bullet first received inside the view still warns ahead of the shot',async({page,baseURL},info)=>{
  // A settled diagonal gives every aspect ratio an interior first sample with
  // space for the cue, clear of the top chrome. Physics and replication continue.
  const s=await playerBulletScene(page,baseURL,100,{entry:'edge',angle:Math.PI/4,settleCamera:true,exactShotPlacement:true,captureFrame:true,firstPaintDelay:180});
  try {
    await s.fire();const first=await paintedWarning(page,info,'first-on-screen-warning');
    expect(first.sourceOnScreen).toBe(true);
    expect(Math.hypot(first.x-first.playerX,first.y-first.playerY)).toBeLessThan(Math.hypot(first.sourceX-first.playerX,first.sourceY-first.playerY));
    // The outline is withheld while the entering body overlaps chrome; it should
    // hand off once clear, rather than being required on the very first frame.
    await expect.poll(()=>page.evaluate(()=>window.playerWarnings.halos)).toBeGreaterThan(0);
    expect(s.errors).toEqual([]);
  }finally{await s.close();}
});

test('an ordinary shot launched visibly on-screen does not trigger the surprise warning',async({page,baseURL})=>{
  const s=await playerBulletScene(page,baseURL,100,{entry:'visible'});
  try {
    await s.fire();
    await expect.poll(()=>page.evaluate(()=>window.warningTelemetry.length)).toBeGreaterThan(0);
    await expect.poll(()=>page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return p.state!=='alive'||p.injuredUntil>0;})).toBe(true);
    expect(await page.evaluate(()=>window.playerWarnings.edges.length)).toBe(0);
    expect(await page.evaluate(()=>window.playerWarnings.halos)).toBe(0);expect(s.errors).toEqual([]);
  }finally{await s.close();}
});

test('a hidden shooter whose projectile clips the edge warns before impact',async({page,baseURL},info)=>{
  // An edge placement uses one projectile radius plus the gap. A gap of -40
  // starts its center 15 units inside while the shooter's body stays outside.
  const scene=await playerBulletScene(page,baseURL,0,{entry:'edge',edgeGap:-40,settleCamera:true,exactShotPlacement:true,captureFrame:true});
  try {
    await page.evaluate(()=>{const m=window.game.currentGameMode;
      m.multiplayerManager.room.onMessage('launch',d=>{
        const v=m.renderView,s=m.multiplayerManager.getState().players.get(d.byId),center=m.centerOf(d.byId,s);
        const r=25,inside=Math.min(v.width/2-Math.abs(d.x+r-v.x),v.height/2-Math.abs(d.y+r-v.y));
        const dx=Math.max(0,Math.abs(center.x-v.x)-v.width/2),dy=Math.max(0,Math.abs(center.y-v.y)-v.height/2);
        window.clippedLaunch={inside,shooterHidden:Math.hypot(dx,dy)>s.width/2};
      });
      m.multiplayerManager.room.onMessage('impact',d=>{if(d.targetId===m.multiplayerManager.localSessionId)window.warningImpactAt=performance.now();});
    });
    await scene.fire();
    const frame=await paintedWarning(page,info,'hidden-shooter-edge');
    await page.waitForFunction(()=>!!window.warningImpactAt);
    expect(frame.at).toBeLessThan(await page.evaluate(()=>window.warningImpactAt));
    const launch=await page.evaluate(()=>window.clippedLaunch);
    expect(launch.shooterHidden).toBe(true);
    expect(launch.inside).toBeGreaterThan(0);
    expect(launch.inside).toBeLessThan(25);
    expect(scene.errors).toEqual([]);
  }finally{await scene.close();}
});

for(const [stock,angle] of [[0,Math.PI/2],[100,Math.PI/2],[400,Math.PI/4]]) {
  test(`a strict near-edge shot retains the real launch origin at ${stock} gems`,async({page,baseURL,browserName,hasTouch},info)=>{
    const s=await playerBulletScene(page,baseURL,stock,{entry:'edge',edgeGap:30,angle,settleCamera:true,exactShotPlacement:true,captureFrame:true});
    const input=await practiceInput(page,browserName,hasTouch);
    try {
      await input.prepareMovement();
      await page.evaluate(()=>{const m=window.game.currentGameMode;
        m.multiplayerManager.room.onMessage('impact',data=>{if(data.targetId===m.multiplayerManager.localSessionId)window.warningImpactAt=performance.now();});
      });
      await s.fire();const first=await paintedWarning(page,info,'strict-near-edge-warning');
      await page.waitForFunction(()=>!!window.warningImpactAt);
      expect(first.at).toBeLessThan(await page.evaluate(()=>window.warningImpactAt));
      expect(s.errors).toEqual([]);
    }finally{await input.close();await s.close();}
  });
}

for(const [origin,edgeGap,miss] of [['off-screen',120,300],['clipped',-40,100]]) {
test(`a ${origin} shot on a clear miss does not raise a warning`,async({page,baseURL})=>{
  const s=await playerBulletScene(page,baseURL,100,{entry:'edge',edgeGap,miss,settleCamera:true,exactShotPlacement:true});
  try {
    await s.fire();await expect.poll(()=>page.evaluate(()=>window.warningTelemetry.length)).toBeGreaterThan(0);
    await expect.poll(()=>s.ammo.state.players.get(s.ammo.sessionId)?.flying).toBe(false);
    expect(await page.evaluate(()=>window.playerWarnings.edges.length)).toBe(0);
    expect(await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().injuredUntil)).toBe(0);expect(s.errors).toEqual([]);
  }finally{await s.close();}
});
}

for(const [name,angle] of [['left',0],['right',Math.PI],['above',Math.PI/2],['below',-Math.PI/2],['upper-left',Math.PI/4],['lower-right',-3*Math.PI/4]]) {
  test(`an incoming shot from ${name} paints a visible warning clear of controls`,async({page,baseURL},info)=>{
    const s=await playerBulletScene(page,baseURL,100,{entry:'edge',angle,captureFrame:true});
    try {
      await s.fire();await paintedWarning(page,info,`incoming-${name}`);expect(s.errors).toEqual([]);
    }finally{await s.close();}
  });
}

test('a real fan launch also paints the shared incoming warning',async({page,baseURL},info)=>{
  const s=await playerBulletScene(page,baseURL,0,{captureFrame:true});
  const room=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
  const pilot=await new Client(baseURL.replace(/^http/,'ws')).joinById(room,{name:'Fan rider'});pilot.onMessage('*',()=>{});
  try {
    pilot.send('test:setGems',{count:12});await expect.poll(()=>pilot.state.players.get(pilot.sessionId)?.width).toBe(40);
    // An ordinary stationary fan just outside the short viewport axis launches inward.
    // A desktop can already see the old right-side fixture, which correctly needs no alert.
    const horizontal=page.viewportSize().width<=page.viewportSize().height;
    const dx=horizontal?1:0,dy=horizontal?0:1;
    const extent=await page.evaluate(horizontal=>{const v=window.game.currentGameMode.renderView;return(horizontal?v.width:v.height)/2;},horizontal);
    // Account for the nozzle and body exiting toward the learner, plus one replication interval.
    const x=2100+dx*(extent+240),y=2100+dy*(extent+240);
    pilot.send('test:placeTurbine',{x,y,intake:Math.atan2(dy,dx),still:true});
    pilot.send('test:protect',{ms:0});pilot.send('test:moveTo',{x:x+dx*84-20,y:y+dy*84-20});
    await paintedWarning(page,info,'fan-incoming-warning');
    expect(await page.evaluate(()=>[...window.game.currentGameMode.multiplayerManager.getState().players.values()].some(p=>p.flying&&p.flightKind==='turbine'))).toBe(true);
    expect(s.errors).toEqual([]);
  }finally{await pilot.leave();await s.close();}
});
