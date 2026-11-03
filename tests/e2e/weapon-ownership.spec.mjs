import { test, expect } from '@playwright/test';
import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { Client } from 'colyseus.js';
const kinds=['pinwheel','pulsar','sentinel','ricochet','ion','comet'];
mkdirSync('.tmp/ownership',{recursive:true});
const bundle=buildSync({entryPoints:['tests/fixtures/weapon-ownership.ts'],bundle:true,format:'iife',globalName:'OwnershipFixture',platform:'browser',write:false}).outputFiles[0].text;
async function gallery(page) {
 await page.route('**/__ownership-gallery',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:12px;background:#0a192f;color:#eafaff;font:14px system-ui}h1{font-size:19px}article{max-width:520px;margin-bottom:18px}canvas{display:block;width:100%;height:auto;border-radius:8px}h2{font-size:14px;font-weight:600}</style></head><body><h1>Weapon ownership — render review</h1><main></main></body></html>'}));
 await page.goto('/__ownership-gallery');await page.addScriptTag({content:bundle});
}
for(const kind of kinds) test(`${kind}: owner mark and every attack remain distinct over navy and white`,async({page})=>{
 await gallery(page);
 const result=await page.evaluate(({kind,kinds})=>{
  const outcomes=[];const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const count=(canvas,at,radius,color)=>{
   const c=canvas.getContext('2d'),data=c.getImageData(0,0,canvas.width,canvas.height).data,target=rgb(color);let found=0;
   for(let y=Math.max(0,Math.floor(at.y-radius));y<Math.min(canvas.height,at.y+radius);y++)for(let x=Math.max(0,Math.floor(at.x-radius));x<Math.min(canvas.width,at.x+radius);x++){
    const i=(y*canvas.width+x)*4;if(target.every((v,k)=>Math.abs(data[i+k]-v)<=4)&&data[i+3]===255)found++;
   }return found;
  };
  for(const bright of [false,true])for(const zoom of [1,.35])for(const own of [true,false]){
   const article=document.createElement('article'),title=document.createElement('h2'),canvas=document.createElement('canvas');
   title.textContent=`${kind} · ${own?'Yours':'Rival'} · ${bright?'White overlap':'Space'} · ${zoom===1?'Near':'Far'}`;article.append(title,canvas);document.querySelector('main').append(article);
   const info=OwnershipFixture.render(canvas,kind,own,bright,true,zoom);
   const shield={x:info.mark.x+info.mark.r/Math.SQRT2,y:info.mark.y+info.mark.r/Math.SQRT2};
   outcomes.push({own,bright,zoom,markMint:count(canvas,shield,7,'#80fff1'),markNavy:count(canvas,shield,7,'#07131f'),attackColor:count(canvas,info.attack,9,info.color),attackNavy:count(canvas,info.attack,9,'#07131f')});
  }
  const ghost=document.createElement('canvas'); const g=OwnershipFixture.render(ghost,kind,true,false,true,1,null);
  const shield={x:g.mark.x+g.mark.r/Math.SQRT2,y:g.mark.y+g.mark.r/Math.SQRT2};
  let charge=null;
  if(!['ion','pulsar'].includes(kind)){
   const a=document.createElement('canvas'),b=document.createElement('canvas');const armed=OwnershipFixture.render(a,kind,true,true,true),unarmed=OwnershipFixture.render(b,kind,true,true,false);
   const pixel=(c,p)=>[...c.getContext('2d').getImageData(Math.round(p.x),Math.round(p.y),1,1).data];charge={armed:pixel(a,armed.attack),unarmed:pixel(b,unarmed.attack)};
  }
  return {outcomes,ghostMint:count(ghost,shield,7,'#80fff1'),charge,kinds:kinds.length};
 },{kind,kinds});
 for(const o of result.outcomes){
  expect(o.attackColor,JSON.stringify(o)).toBeGreaterThan(2);expect(o.attackNavy,JSON.stringify(o)).toBeGreaterThan(2);
  if(o.own){expect(o.markMint,JSON.stringify(o)).toBeGreaterThan(2);expect(o.markNavy).toBeGreaterThan(2);}else expect(o.markMint).toBe(0);
 }
 expect(result.ghostMint).toBe(0);
 if(result.charge){expect(result.charge.armed).not.toEqual(result.charge.unarmed);expect(result.charge.unarmed.slice(0,3)).toEqual([16,35,50]);}
 await page.screenshot({path:test.info().outputPath(`${kind}-ownership.png`),fullPage:true,scale:'css'});
});

test('reduced-motion ownership marks stay static while preserving the safety shape',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await gallery(page);
 const same=await page.evaluate(()=>{
  const a=document.createElement('canvas'),b=document.createElement('canvas');OwnershipFixture.mark(a,true,0);OwnershipFixture.mark(b,true,.5);
  return a.toDataURL()===b.toDataURL();
 });expect(same).toBe(true);
});

test('actual assembly, placement and a second viewer show ownership from the authoritative builder',async({page,baseURL})=>{
 test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local fixture only');
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true,testTurbines:'manual'})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
 await send('test:setGems',{count:100});await send('test:pinwheel',{kind:'pinwheel',x:2100,y:2100});
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.room.state.pinwheel.parts.length===3);
 for(let i=0;i<3;i++){
  const at=await page.evaluate(i=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),part=m.multiplayerManager.room.state.pinwheel.parts[i];return{x:part.x-p.width/2,y:part.y-p.height/2};},i);
  await send('test:moveTo',at);
  await page.waitForFunction(i=>{const m=window.game.currentGameMode,w=m.multiplayerManager.room.state.pinwheel;return w.phase==='carried'||w.parts[i]?.carriedBy===m.multiplayerManager.room.sessionId;},i);
 }
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase==='carried');
 const snapshot=()=>page.evaluate(()=>{const m=window.game.currentGameMode,w=m.multiplayerManager.room.state.pinwheel;return{owner:w.owner,me:m.multiplayerManager.room.sessionId,phase:w.phase};});
 expect((await snapshot()).owner).toBe((await snapshot()).me);
 await page.getByRole('button',{name:'Place weapon',exact:true}).click();
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase==='active');
 const roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
 const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:'Other viewer'});peer.onMessage('*',()=>{});
 try {await expect.poll(()=>peer.state.pinwheel.owner).toBe((await snapshot()).me);expect(peer.state.pinwheel.owner).not.toBe(peer.sessionId);}
 finally{await peer.leave();}
 await page.screenshot({path:test.info().outputPath('assembled-owned-pinwheel.png'),scale:'css'});
});

test('all six minimap markers carry the same shield only for their local owner',async({page})=>{
 await gallery(page);
 const counts=await page.evaluate(kinds=>kinds.flatMap(kind=>[1,2.625].map(unit=>{
  const mint=(own,localId)=>{
   const c=document.createElement('canvas');document.querySelector('main').append(c);OwnershipFixture.minimap(c,kind,own,localId,unit);
   const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
   for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-128)<5&&Math.abs(p[i+1]-255)<5&&Math.abs(p[i+2]-241)<5&&p[i+3]===255)n++;
   c.remove();return n;
  };return {kind,unit,owned:mint(true,'me'),rival:mint(false,'me'),unknown:mint(true,null)};
 })),kinds);
 for(const c of counts){expect(c.owned,JSON.stringify(c)).toBeGreaterThan(10);expect(c.rival).toBe(0);expect(c.unknown).toBe(0);}
});
