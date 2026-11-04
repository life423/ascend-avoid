import assert from 'node:assert/strict';
import { InhaleFraming, constrainArenaView, viewShort, type ArenaView, type CameraSubject } from '../game/camera.js';
import { constrainArena } from '../game/arenaBoundary.js';
import { INHALE } from '../constants/gameConstants.js';

const W=4200;
function subject(width:number,x=2100,y=2100,facing=0):CameraSubject {return {width,x,y,facing,inhaling:false,vx:0,vy:0};}
function base(s:CameraSubject,aspect:number):ArenaView {
  const short=viewShort(s.width);
  return constrainArenaView({x:s.x,y:s.y,width:short*Math.max(1,aspect),height:short/Math.min(1,aspect),scale:1},W,W,s);
}
function check(v:ArenaView,s:CameraSubject,normal:ArenaView) {
  assert(Math.abs(v.width-normal.width)<1e-6 && Math.abs(v.height-normal.height)<1e-6 && Math.abs(v.scale-normal.scale)<1e-8,'inhale never changes zoom');
  for(const x of[v.x-v.width/2,v.x+v.width/2])for(const y of[v.y-v.height/2,v.y+v.height/2]) {
    assert(x>=-1e-5&&y>=-1e-5&&x<=W+1e-5&&y<=W+1e-5,'viewport inside straight walls');
    if((x<700||x>3500)&&(y<700||y>3500))assert(Math.hypot(x-(x<700?700:3500),y-(y<700?700:3500))<=700+1e-5,'viewport inside rounded wall');
  }
  for(const d of[s.x-v.x+v.width/2,v.x+v.width/2-s.x,s.y-v.y+v.height/2,v.y+v.height/2-s.y])assert(d>=s.width*.1-1e-5,'player central body remains visible');
  const minimum=(a:ArenaView)=>Math.min(s.x-a.x+a.width/2,a.x+a.width/2-s.x,s.y-a.y+a.height/2,a.y+a.height/2-s.y);
  if(minimum(normal)>=s.width/2-1e-5)assert(minimum(v)>=s.width/2-1e-5,'a fully visible body stays fully visible during the pan');
}
function visibleReach(v:ArenaView,s:CameraSubject) {
  const fx=Math.cos(s.facing),fy=Math.sin(s.facing);
  const dx=fx>1e-9?(v.x+v.width/2-s.x)/fx:fx< -1e-9?(v.x-v.width/2-s.x)/fx:Infinity;
  const dy=fy>1e-9?(v.y+v.height/2-s.y)/fy:fy< -1e-9?(v.y-v.height/2-s.y)/fy:Infinity;
  return Math.max(0,Math.min(dx,dy)-s.width*.3);
}
let cases=0;
for(const width of[20,100,240,241,301,612,1049,1470])for(const aspect of[412/915,915/412,1280/720,1,.3,3.5])for(const corner of[null,[-1,-1],[-1,1],[1,-1],[1,1]])for(let direction=0;direction<8;direction++) {
  const body={x:corner&&corner[0]<0?0:corner?W:2100-width/2,y:corner&&corner[1]<0?0:corner?W:2100-width/2,width,height:width};
  constrainArena(body,W,W);
  const s=subject(width,body.x+width/2,body.y+width/2,direction*Math.PI/4),normal=base(s,aspect),framing=new InhaleFraming();
  assert.deepEqual(framing.update(normal,s,1/60,W,W),normal,'idle view is unchanged');s.inhaling=true;
  let previous=normal,v=normal;
  for(let tick=0;tick<90;tick++) {
    v=framing.update(normal,s,1/60,W,W);check(v,s,normal);
    assert(Math.hypot(v.x-previous.x,v.y-previous.y)<Math.min(normal.width,normal.height)*.016+1e-5,'feasible pan eases instead of snapping against a clamp');previous=v;
  }
  if(width<=240)assert.deepEqual(v,normal,'small-player framing is unchanged');
  if(!corner&&width>=612) {
    const gain=visibleReach(v,s)-visibleReach(normal,s);
    assert(gain>=-1e-5,'settled forward framing never takes away visible reach at center');
    const acrossShort=aspect<1?direction===0:aspect>1?direction===2:direction===0;
    if(acrossShort && aspect!==1 && aspect>=.4 && aspect<=2.5)assert(gain>100,`large players gain forward view on representative phone/desktop short axes: ${JSON.stringify({width,aspect,direction,gain})}`);
  }
  // Release eases to the exact same idle framing/zoom.
  s.inhaling=false;for(let tick=0;tick<180;tick++){v=framing.update(normal,s,1/60,W,W);check(v,s,normal);}
  assert(Math.hypot(v.x-normal.x,v.y-normal.y)<.2);cases++;
}
{
  const s=subject(1470),v=base(s,412/915),f=new InhaleFraming();s.inhaling=true;
  for(let i=0;i<90;i++)f.update(v,s,1/60,W,W);
  // Continuous rotation and repeated on/off input retain containment and fixed zoom.
  for(let i=0;i<360;i++){s.facing+=Math.PI/180;s.inhaling=i%30<15;check(f.update(v,s,1/60,W,W),s,v);}
  assert.deepEqual(f.update(v,null,1/60,W,W),v,'knockout/capture hold clears attack offset');
  s.inhaling=false;assert.deepEqual(f.update(v,s,1/60,W,W),v,'respawn cannot inherit a prior attack offset');
  s.inhaling=true;for(let i=0;i<90;i++)f.update(v,s,1/60,W,W);
  const small=subject(100);assert.deepEqual(f.update(base(small,1),small,1/60,W,W),base(small,1),'shrinking to a small body clears the offset');
}
{
  const s=subject(612),f=new InhaleFraming();s.inhaling=true;
  for(let tick=0;tick<360;tick++) {
    const angle=tick*Math.PI/720,inner=700-s.width/2-8;
    s.x=700-inner*Math.cos(angle);s.y=700-inner*Math.sin(angle);s.facing=angle+Math.PI;
    const normal=base(s,tick<120?412/915:tick<240?915/412:1);
    check(f.update(normal,s,1/60,W,W),s,normal);
  }
}
const sample=subject(612),normal=base(sample,412/915),f=new InhaleFraming();sample.inhaling=true;let active=normal;
for(let i=0;i<180;i++)active=f.update(normal,sample,1/60,W,W);
console.log(JSON.stringify({width:612,reach:INHALE.REACH+612*INHALE.REACH_PER_SIZE,before:visibleReach(normal,sample),after:visibleReach(active,sample),zoomUnchanged:active.scale===normal.scale}));
console.log(`Inhale framing passed: ${cases} size/aspect/corner/direction cases, increased forward view, no inhale zoom, visible body, no exterior, smooth release/rotation and lifecycle reset.`);
