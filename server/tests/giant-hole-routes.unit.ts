import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { arenaClearance } from '../game/arenaBoundary.js';
import { moveSpeed } from '../game/movement.js';
import { creatureSize } from '../game/creatureSize.js';
import { BLACK_HOLE } from '../constants/gameConstants.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';

const W=4200,NOW=100000,size=creatureSize(1e9),pad=size/2+8,n=80,step=(W-2*pad)/n;
const holes=BLACK_HOLE.POSITIONS.map(([x,y])=>({x:x*W,y:y*W,r:BLACK_HOLE.CORE_RADIUS+size/2+BLACK_HOLE.RIM_CLEARANCE}));
const point=(id:number)=>({x:pad+(id%(n+1))*step,y:pad+Math.floor(id/(n+1))*step});
const id=(x:number,y:number)=>y*(n+1)+x;
const open=(at:{x:number;y:number})=>arenaClearance(at.x,at.y,W,W)>=pad-1e-6 && holes.every(h=>Math.hypot(at.x-h.x,at.y-h.y)>=h.r+32);
// Independent sampled route search: edges are also checked continuously against circles.
function segmentClear(a:{x:number;y:number},b:{x:number;y:number}) {
  const dx=b.x-a.x,dy=b.y-a.y;
  return holes.every(h=>{const t=Math.max(0,Math.min(1,((h.x-a.x)*dx+(h.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(a.x+t*dx-h.x,a.y+t*dy-h.y)>=h.r+24;});
}
const center=id(n/2,n/2),queue=[center],previous=new Map([[center,-1]]);
for(let head=0;head<queue.length;head++) {
  const here=queue[head],x=here%(n+1),y=Math.floor(here/(n+1));
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    if(x+dx<0||x+dx>n||y+dy<0||y+dy>n)continue;
    const next=id(x+dx,y+dy);
    if(previous.has(next)||!open(point(next))||!segmentClear(point(here),point(next)))continue;
    previous.set(next,here);queue.push(next);
  }
}
assert.equal(size,1470);
assert(holes[0].y-pad-holes[0].r>=120,'top corridor has at least 120 units of center clearance beyond the full giant body');
const routeTimes:{corner:number;seconds:number}[]=[];
for(const corner of[id(0,0),id(n,0),id(0,n),id(n,n)]) for(const bot of[false,true]) {
  assert(previous.has(corner),'every maximum-body corner connects to the middle without intersecting any hole or wall');
  const path=[];
  for(let at=corner;at!==-1;) {path.push(point(at));const parent=previous.get(at);assert(parent!==undefined);at=parent;}
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.gems.clear();s.weaponsOn=s.surgesOn=s.trafficHits=false;s.setTurbines('off');s.update(0,NOW);
  const p=s.addPlayer('giant','Giant',NOW);p.isBot=bot;p.setGems(1e9,W,W);p.placeAt(path[0].x-size/2,path[0].y-size/2);p.dropProtection();
  const upkeepOnly=new PlayerSchema('upkeep',0);upkeepOnly.setGems(1e9,W,W);
  let at=1,tick=0,last={x:p.x+p.width/2,y:p.y+p.width/2};
  while(at<path.length&&tick<5000) {
    const dx=path[at].x-p.x-p.width/2,dy=path[at].y-p.y-p.width/2,d=Math.hypot(dx,dy);
    if(d<6){at++;continue;}
    const speed=moveSpeed(p.width);
    p.steer(dx/d,dy/d);tick++;s.update(1/30,NOW+tick*1000/30);upkeepOnly.decay(1/30,W,W);
    const center={x:p.x+p.width/2,y:p.y+p.width/2};
    assert(arenaClearance(center.x,center.y,W,W)>=p.width/2+8-1e-5);
    assert(s.blackHoles.every(h=>Math.hypot(center.x-h.x,center.y-h.y)>=h.radius+p.width/2+8-.01),'ordinary walking preserves the full body/rim clearance');
    assert(Math.hypot(center.x-last.x,center.y-last.y)<=speed/30+.01,'no teleport or speed bonus as ordinary upkeep reduces body size');last=center;
  }
  assert.equal(at,path.length,'actual authoritative movement can follow the clear route');
  assert.equal(p.state,'alive');assert.equal(p.gems,upkeepOnly.gems,'walking around holes causes no gem damage beyond existing upkeep');
  assert.equal(p.width,upkeepOnly.width,'the route loses only the same physical growth as ordinary upkeep');
  if(!bot)routeTimes.push({corner,seconds:tick/30});
}
console.log(JSON.stringify({maximumWidth:size,cornerToCenterRouteSeconds:routeTimes}));
console.log('Maximum-size hole routes passed: connected corners/center, continuous edge clearance and actual human/bot movement, full collision, no speed boost or walking damage.');
