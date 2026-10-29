import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');

for (const sourceGems of [12, 100]) test(`standard bullet from ${sourceGems === 12 ? 'small' : 'large'} captive: capture reward, rendered size and landing`, async ({ page, baseURL }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({
    url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true}),
  }));
  await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
  const roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
  const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:sourceGems===12?'Small captive':'Large captive'});peer.onMessage('*',()=>{});
  const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
  try {
    const transfer=Math.max(0,sourceGems-32),initialOwner=250-transfer;
    await send('test:setGems',{count:initialOwner});peer.send('test:setGems',{count:sourceGems});
    await page.waitForFunction(({id,owner,source})=>{
      const m=window.game.currentGameMode.multiplayerManager;return m.getLocalPlayer().gems===owner&&m.getState().players.get(id)?.gems===source;
    },{id:peer.sessionId,owner:initialOwner,source:sourceGems});
    const widths=await page.evaluate(id=>{const m=window.game.currentGameMode.multiplayerManager;return{a:m.getLocalPlayer().width,b:m.getState().players.get(id).width};},peer.sessionId);
    await send('test:moveTo',{x:1000-widths.a/2,y:1000-widths.a/2});await send('test:face',{angle:0});await send('test:protect',{ms:0});
    peer.send('test:moveTo',{x:1000+widths.a*.3+1-widths.b/2,y:1000-widths.b/2});peer.send('test:protect',{ms:0});
    await page.waitForFunction(id=>!window.game.currentGameMode.multiplayerManager.getState().players.get(id)?.spawnProtected,peer.sessionId);
    await page.keyboard.down('Space');
    await page.waitForFunction(id=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping===id,peer.sessionId);
    await page.keyboard.up('Space');
    await expect.poll(()=>page.evaluate(id=>{
      const m=window.game.currentGameMode.multiplayerManager;return{owner:m.getLocalPlayer().gems,captive:m.getState().players.get(id).gems};
    },peer.sessionId)).toEqual({owner:250,captive:Math.min(sourceGems,32)});
    await send('test:face',{angle:Math.PI/4});
    await page.keyboard.press('Space');
    await page.waitForFunction(id=>{
      const m=window.game.currentGameMode,p=m.multiplayerManager.getState().players.get(id);
      return p?.flying&&p.width===60&&p.height===60&&m.drawnSizes.get(id)?.size===60;
    },peer.sessionId);
    expect(await page.evaluate(id=>window.game.currentGameMode.multiplayerManager.getState().players.get(id).gems,peer.sessionId)).toBe(Math.min(sourceGems,32));
    await page.screenshot({path:test.info().outputPath(sourceGems===12?'small-source-standard-bullet.png':'large-source-standard-bullet.png'),scale:'css'});
    await page.waitForFunction(id=>{
      const p=window.game.currentGameMode.multiplayerManager.getState().players.get(id);return p&&!p.flying&&p.state==='alive';
    },peer.sessionId);
    expect(await page.evaluate(id=>{
      const p=window.game.currentGameMode.multiplayerManager.getState().players.get(id);return{width:p.width,gems:p.gems};
    },peer.sessionId)).toEqual({width:sourceGems===12?40:60,gems:Math.min(sourceGems,32)});
    expect(errors).toEqual([]);
  } finally {await page.keyboard.up('Space');await peer.leave();}
});
