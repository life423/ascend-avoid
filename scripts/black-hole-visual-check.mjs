// Exercise actual renderer paths in Node without installing a DOM or raster dependency.
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
const source=buildSync({stdin:{contents:"export * from './src/render/blackHoleStyle.ts'; export * from './src/render/blackHoles.ts'; export {BLACK_HOLE} from './server/constants/gameConstants.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false}).outputFiles[0].text;
const {blackHoleLook,blackHoleRingRadius,drawBlackHoleWorld,drawBlackHoleMarker,drawBlackHoles,BLACK_HOLE_STYLE,BLACK_HOLE}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function canvas(){
 const records=[],stack=[];let path=[],state={fillStyle:'#fff',strokeStyle:'#fff',lineWidth:1,lineCap:'butt',dash:[],x:0,y:0,scale:1,globalAlpha:.7};
 const ctx={
  save(){stack.push({...state,dash:[...state.dash]});},restore(){assert(stack.length,'balanced renderer context');state=stack.pop();},
  translate(x,y){state.x+=x;state.y+=y;},scale(x,y){assert.equal(x,y,'circular markers use uniform scaling');state.scale*=x;},
  beginPath(){path=[];},arc(x,y,r,start,end){assert(r>0&&Number.isFinite(r+start+end),'bounded finite circular path');path.push({x,y,r,start,end});},
  fill(){records.push({kind:'fill',path:[...path],state:{...state}});},stroke(){records.push({kind:'stroke',path:[...path],state:{...state}});},
  setLineDash(dash){state.dash=[...dash];},
  ellipse(){assert.fail('black holes must use circular symbols, not tilted ellipses');},
  createRadialGradient(){assert.fail('no per-frame gradient');},createLinearGradient(){assert.fail('no per-frame gradient');},
 };
 for(const key of['fillStyle','strokeStyle','lineWidth','lineCap','globalAlpha'])Object.defineProperty(ctx,key,{get:()=>state[key],set:value=>{state[key]=value;}});
 Object.defineProperty(ctx,'shadowBlur',{set:value=>assert.equal(value,0,'no per-frame blur')});
 return {ctx,records,stack,state:()=>state};
}
const hole={radius:64,activeAt:5000,phase:'warning',at:5000};
assert.equal(blackHoleLook({...hole,phase:undefined,at:undefined},4999).phase,'warning');
assert.equal(blackHoleLook({...hole,phase:undefined,at:undefined},5000).phase,'active','legacy activeAt still works');
assert.equal(blackHoleLook({...hole,phase:'future-state'},9000).phase,'dormant','unknown phase never invents a live core');
assert.equal(blackHoleLook(hole,5000-BLACK_HOLE.WARNING_MS).progress,0);
assert.equal(blackHoleLook(hole,5000-BLACK_HOLE.WARNING_MS/2).progress,.5);
assert.equal(blackHoleLook(hole,5001).lethal,false,'a client deadline alone never makes an authoritative warning lethal');
assert.equal(blackHoleLook({...hole,phase:'closing'},9000).lethal,true,'closing remains live until its phase patch');
for(const phase of['warning','active','closing','dormant'])for(const radius of[48,64,80]){
 const h={...hole,phase,radius},look=blackHoleLook(h,4000),world=canvas();
 drawBlackHoleWorld(world.ctx,h,look,24000,2,false);
 assert.equal(world.stack.length,0);assert.equal(world.state().globalAlpha,.7,'world artwork restores caller opacity');
 const filled=world.records.filter(r=>r.kind==='fill');
 assert.equal(filled.length,look.lethal?1:0,'only an active/closing core is a filled singularity');
 if(look.lethal){assert.equal(filled[0].path[0].r,radius,'visible lethal core retains its exact physical radius');assert.equal(filled[0].state.fillStyle,BLACK_HOLE_STYLE.core);}
 if(phase==='dormant')assert.equal(world.records.length,0,'dormant location is not marked');
 assert(world.records.length<=8,'bounded world path count');
 assert(world.records.every(r=>r.path.every(p=>p.r<=blackHoleRingRadius(radius))),'decoration stays in its reserved circular envelope');
 const map=canvas();drawBlackHoleMarker(map.ctx,20,30,h,look,2);
 assert.equal(map.stack.length,0);assert.equal(map.state().globalAlpha,.7);
 assert.equal(map.records.filter(r=>r.kind==='fill').length,look.lethal?1:0,'minimap warning remains hollow');
 assert(map.records.length<=6,'bounded minimap path count');
 for(const r of map.records){assert(r.path.every(p=>p.r<=5.8),'compact circular minimap footprint');assert(r.state.scale>=1.7&&r.state.scale<=2.4,'DPR scaling stays bounded across sizes');}
}
{
 const h={...hole,phase:'active'},a=canvas(),b=canvas(),c=canvas();
 drawBlackHoleWorld(a.ctx,h,blackHoleLook(h,4000),0,1,true);
 drawBlackHoleWorld(b.ctx,h,blackHoleLook(h,4000),90000,1,true);
 drawBlackHoleWorld(c.ctx,h,blackHoleLook(h,4000),90000,1,false);
 assert.deepEqual(a.records,b.records,'reduced motion stops decorative rotation');
 assert.notDeepEqual(a.records,c.records,'ordinary orbit animation is subtle circular motion');
}
{
 const c=canvas(),view={x:2000,y:2000,width:500,height:500,scale:1},mode={cssScale:1,renderView:view,worldNow:s=>s.time};
 const state={time:4000,worldWidth:4200,worldHeight:4200,blackHoles:[{...hole,x:500,y:500,phase:'active'}]};
 drawBlackHoles(mode,c.ctx,state,4000);assert.equal(c.records.length,0,'offscreen holes submit no artwork');
 state.blackHoles[0].x=state.blackHoles[0].y=2000;drawBlackHoles(mode,c.ctx,state,4000);assert(c.records.length>0);
 assert.equal(c.stack.length,0,'wrapper and artwork both restore context');
}
function luminance(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
for(const color of[BLACK_HOLE_STYLE.live,BLACK_HOLE_STYLE.warning])assert((luminance(color)+.05)/(luminance(BLACK_HOLE_STYLE.edge)+.05)>10,'phase marks contrast against the minimap background');
console.log('Black-hole visuals passed: circular world/minimap symbols, truthful full closing cores, hollow warnings, hidden dormancy, DPR/size scaling, contrast, reduced motion, bounded paths and offscreen culling.');
