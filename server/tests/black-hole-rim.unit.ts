import assert from 'node:assert/strict';
import { slideBlackHoleRims } from '../game/blackHole.js';
import { BLACK_HOLE, ARENA_RULES } from '../constants/gameConstants.js';
const hole = {x:1050,y:1260,radius:64}, dt=1/30;
function walk(width:number, cx:number,cy:number,dx:number,dy:number) {
  const from={x:cx-width/2,y:cy-width/2};
  const p=slideBlackHoleRims({...from,width,height:width,x:from.x+dx,y:from.y+dy},from.x,from.y,[hole],4200,4200,dt);
  return {x:p.x+width/2,y:p.y+width/2};
}
for(const width of [20,100,600,1260]) {
  const radius=64+width/2+BLACK_HOLE.RIM_CLEARANCE;
  // Approach from the open right side, head-on, and keep holding the same control.
  let p={x:hole.x+radius+80,y:hole.y}; let deviation=0;
  for(let i=0;i<700;i++) {
    const next=walk(width,p.x,p.y,-130*dt,0);
    assert(Math.hypot(next.x-hole.x,next.y-hole.y)>=radius-.01,`width ${width} never overlaps the core`);
    assert(Math.hypot(next.x-p.x,next.y-p.y)<=130*dt+.01,'routing cannot add walking distance');
    assert(next.x>=ARENA_RULES.EDGE_MARGIN+width/2 && next.y>=ARENA_RULES.EDGE_MARGIN+width/2);
    deviation=Math.max(deviation,Math.abs(next.y-hole.y));p=next;
  }
  assert(deviation>radius*.7,'head-on movement slides around instead of stopping');
  // Surface contact must allow immediately moving away again.
  const away=walk(width,hole.x+radius,hole.y,4,0);assert(away.x>hole.x+radius+3.9);
}
for(const side of [-1,1]) {
  const p=walk(100,1200,1260,-80,side*30);assert(Math.sign(p.y-1260)===side,'tangential intent chooses its own side');
}
{
  const p=walk(100,1300,1260,-500,0);assert(Math.hypot(p.x-hole.x,p.y-hole.y)>=122-.01,'fast skid cannot tunnel');
}
{
  let p={x:hole.x,y:hole.y};
  for(let i=0;i<30;i++) {const next=walk(100,p.x,p.y,0,0);assert(Math.hypot(next.x-p.x,next.y-p.y)<=180*dt+.01);p=next;}
  assert(Math.hypot(p.x-hole.x,p.y-hole.y)>=122-.01,'growth overlap recovers gradually');
}
{
  let p={x:ARENA_RULES.EDGE_MARGIN+630,y:1260};let initial=Math.hypot(p.x-hole.x,p.y-hole.y);
  for(let i=0;i<300;i++) {const next=walk(1260,p.x,p.y,0,0);assert(next.x>=ARENA_RULES.EDGE_MARGIN+630);assert(Math.hypot(next.x-hole.x,next.y-hole.y)>=initial-.1);p=next;initial=Math.hypot(p.x-hole.x,p.y-hole.y);}
  assert(initial>=702-.1,'giant pinched against a wall recovers toward open space');
}
console.log('Black-hole rims: head-on slide, all body sizes, outward release, sides, swept skids, gradual growth recovery and walls pass.');
