import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
async function start(page) {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
}
const send = (page, type, data) => page.evaluate(({type,data}) => window.game.currentGameMode.multiplayerManager.room.send(type,data), {type,data});
const phase = page => page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase);
const position = page => page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().x);

test('closing Help returns Space to inhale instead of reopening the menu', async ({page}) => {
  await start(page);
  const opener=page.locator('.hamburger-button:visible, .bar-help:visible').first();
  await opener.click();const drawer=page.getByRole('dialog',{name:'Game Menu'});await expect(drawer).toBeVisible();
  await drawer.getByRole('button',{name:'Close',exact:true}).click();await expect(drawer).toBeHidden();
  await expect(page.locator('canvas.game-canvas')).toBeFocused();
  await page.keyboard.down('Space');
  try { await expect.poll(()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(true);await expect(drawer).toBeHidden(); }
  finally {await page.keyboard.up('Space');}
});

test('the compact menu and minimap align as one dock without a floating player-count label', async ({page}) => {
  await start(page);
  await page.evaluate(()=>{const stroke=CanvasRenderingContext2D.prototype.strokeRect,fill=CanvasRenderingContext2D.prototype.fillText;window.playingLabels=0;
    CanvasRenderingContext2D.prototype.strokeRect=function(x,y,w,h){if(this.getTransform().a===1&&this.strokeStyle.includes('79')&&this.strokeStyle.includes('209')&&this.strokeStyle.includes('197')&&w<200)window.mapBox={x,y,w,h};return stroke.call(this,x,y,w,h);};
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(matchMedia('(max-width: 1199px)').matches&&/\d+ playing/.test(String(text)))window.playingLabels++;return fill.call(this,text,...args);};
  });
  for(const [width,height] of [[320,568],[475,744],[915,412]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(200);
    const at=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),u=c.width/r.width,b=window.mapBox;return b?{left:r.left+b.x/u,right:r.left+(b.x+b.w)/u,top:r.top+b.y/u}:null;});
    expect(at).not.toBeNull();const menu=await page.getByRole('button',{name:'Toggle menu'}).boundingBox();
    expect(Math.abs(menu.x+menu.width-at.right-4)).toBeLessThan(2);
    expect(menu.y+menu.height).toBeLessThanOrEqual(at.top-2);
    expect(at.left).toBeGreaterThan(150);
  }
  expect(await page.evaluate(()=>window.playingLabels)).toBe(0);
  await page.setViewportSize({width:475,height:744});await page.waitForTimeout(200);
  await page.screenshot({path:test.info().outputPath('aligned-hud-dock.png')});
});

test('the drawer accepts touch scrolling and its bottom actions remain reachable', async ({ page, hasTouch, browserName }) => {
  test.skip(!hasTouch, 'phone/tablet touch regression');
  await start(page);
  await page.evaluate(() => { for (let i=0;i<20;i++) window.dispatchEvent(new CustomEvent('ascend:activity',{detail:`Event ${i}: a weapon hit earned gems.`})); window.drawerUI.open(); });
  const drawer = page.getByRole('dialog', { name: 'Game Menu' });
  await expect(drawer).toBeVisible();
  await expect.poll(async () => (await drawer.boundingBox()).x).toBeGreaterThanOrEqual(-.1);
  expect(await drawer.evaluate(el => getComputedStyle(el).touchAction)).toBe('pan-y');
  expect(await drawer.evaluate(el => { const e=new TouchEvent('touchmove',{bubbles:true,cancelable:true}); el.querySelector('.instructions').dispatchEvent(e);return e.defaultPrevented; })).toBe(false);
  expect(await drawer.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const box = await drawer.boundingBox(), x = box.x + box.width / 2, y = Math.min(box.height - 70, 450);
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
    for (let i=1;i<=12;i++) { await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18}]});await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  } else if(browserName==='webkit') { await drawer.press('PageDown'); }
  else { await page.mouse.move(x,y); await page.mouse.wheel(0,600); }
  await expect.poll(() => drawer.evaluate(el => el.scrollTop)).toBeGreaterThan(80);
  await drawer.getByRole('button', { name: 'Show starter tips', exact: true }).scrollIntoViewIfNeeded();
  await expect(drawer.getByRole('button', { name: 'Show starter tips', exact: true })).toBeInViewport();
  await page.screenshot({path:test.info().outputPath('drawer-scrolled.png')});
});

test('a second touch or E places a weapon while movement stays held', async ({ page, hasTouch }) => {
  await start(page); await send(page,'test:pinwheel',{kind:'pinwheel',x:2100,y:2100});
  await expect.poll(() => phase(page)).toBe('parts');
  for (let i=0;i<3 && await phase(page)==='parts';i++) {
    await page.evaluate(() => { const r=window.game.currentGameMode.multiplayerManager.room,p=r.state.players.get(r.sessionId),part=[...r.state.pinwheel.parts].find(p=>!p.carriedBy);if(part)r.send('test:moveTo',{x:part.x-p.width/2,y:part.y-p.height/2}); });
    await page.waitForTimeout(150);
  }
  await expect.poll(() => phase(page)).toBe('carried');
  const before=await position(page);
  if (hasTouch) await page.evaluate(() => {
    const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),x=r.left+r.width*.18,y=r.top+r.height*.83;
    c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:41,pointerType:'touch',clientX:x+65,clientY:y,bubbles:true}));
  }); else await page.keyboard.down('ArrowRight');
  try {
    await expect.poll(() => position(page)).toBeGreaterThan(before+25);
    const at=await position(page);
    if(hasTouch) {
      // Intentionally no compatibility click: Android multitouch may never emit one.
      await page.getByRole('button',{name:'Place weapon',exact:true}).dispatchEvent('pointerdown',{pointerId:42,pointerType:'touch',bubbles:true,cancelable:true});
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,pointerType:'touch',bubbles:true})));
    } else await page.keyboard.press('e');
    await expect.poll(() => phase(page)).toBe('charging');
    await expect.poll(() => position(page)).toBeGreaterThan(at+25);
  } finally {
    if(hasTouch)await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,pointerType:'touch',bubbles:true})));
    else await page.keyboard.up('ArrowRight');
  }
});

test('mobile events stay out of the playfield and remain in drawer history', async ({ page, hasTouch }) => {
  test.skip(!hasTouch,'mobile HUD regression'); await start(page);
  await page.evaluate(() => {
    window.overlays=[];const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(/Gem surge ·|clutter test|TEST HIT/.test(String(text)))window.overlays.push(text);return fill.call(this,text,...args);};
    const m=window.game.currentGameMode;m.addNotice('clutter test');m.banner={title:'TEST HIT',sub:'TEST HIT',at:performance.now()};m.multiplayerManager.room.send('test:surge',{active:true});
  });
  await page.waitForTimeout(500);expect(await page.evaluate(()=>window.overlays)).toEqual([]);
  await page.evaluate(()=>window.drawerUI.open());
  await expect(page.locator('.activity-history')).toContainText('clutter test');
});

test('rival reserved parts show an accent and red X without status words', async ({ page, baseURL }) => {
  await start(page);await send(page,'test:pinwheel',{x:2100,y:2100});await expect.poll(()=>phase(page)).toBe('parts');
  const id=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
  const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(id,{name:'Part collector'});peer.onMessage('*',()=>{});
  try {
    await expect.poll(()=>peer.state.players?.get(peer.sessionId)?.width).toBeGreaterThan(0);
    const part=peer.state.pinwheel.parts[0],p=peer.state.players.get(peer.sessionId);
    peer.send('test:moveTo',{x:part.x-p.width/2,y:part.y-p.height/2});
    await expect.poll(()=>peer.state.pinwheel.owner).toBe(peer.sessionId);
    await page.evaluate(()=>{
      window.lockMarks=0;window.statusWords=[];const stroke=CanvasRenderingContext2D.prototype.stroke,fill=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.strokeStyle==='#ff7c82')window.lockMarks++;return stroke.apply(this,args);};
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(['CLAIMED','YOURS'].includes(String(text)))window.statusWords.push(text);return fill.call(this,text,...args);};
      const m=window.game.currentGameMode,r=m.multiplayerManager.room,p=r.state.players.get(r.sessionId),part=r.state.pinwheel.parts[1];r.send('test:moveTo',{x:part.x-p.width/2+90,y:part.y-p.height/2});
    });
    await expect.poll(()=>page.evaluate(()=>window.lockMarks)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.statusWords)).toEqual([]);
    await page.screenshot({path:test.info().outputPath('reserved-part-red-x.png')});
  } finally { await peer.leave(); }
});

test('close sustained inhale steals healthy cargo and transfers its reserved set', async ({page,baseURL})=>{
  await start(page);await send(page,'test:pinwheel',{x:2100,y:2100});await expect.poll(()=>phase(page)).toBe('parts');
  const roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
  const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:'Healthy carrier'});peer.onMessage('*',()=>{});
  try {
    await expect.poll(()=>peer.state.players?.get(peer.sessionId)?.width).toBeGreaterThan(0);
    const part=peer.state.pinwheel.parts[0],owner=peer.state.players.get(peer.sessionId);
    peer.send('test:moveTo',{x:part.x-owner.width/2,y:part.y-owner.height/2});peer.send('test:face',{angle:0});peer.send('test:protect',{ms:0});
    await expect.poll(()=>peer.state.pinwheel.owner).toBe(peer.sessionId);await page.waitForTimeout(120);
    await page.evaluate(()=>{const r=window.game.currentGameMode.multiplayerManager.room,p=r.state.pinwheel.parts[0];r.send('test:moveTo',{x:p.x-110,y:p.y-10});r.send('test:face',{angle:0});});
    await page.waitForTimeout(150);await page.evaluate(()=>{window.game.currentGameMode.facing={x:1,y:0};});await page.keyboard.down('Space');
    const myId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.sessionId);
    await expect.poll(()=>peer.state.pinwheel.owner).toBe(myId);
    expect(peer.state.players.get(peer.sessionId).injuredUntil).toBe(0);expect(peer.state.players.get(peer.sessionId).gems).toBe(0);
    await expect(page.locator('.activity-history')).toContainText('stole a Pinwheel part');
  } finally {await page.keyboard.up('Space');await peer.leave();}
});
