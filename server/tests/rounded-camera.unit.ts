import assert from 'node:assert/strict';
import { WORLD } from '../constants/gameConstants.js';
import { constrainArenaView, viewShort } from '../game/camera.js';

// Independent geometric oracle: flat bounds plus the four physical quarter circles.
function inside(x: number, y: number, w: number, h: number): boolean {
  const r = Math.min(700, Math.min(w, h) / 4);
  if (x < -1e-5 || x > w + 1e-5 || y < -1e-5 || y > h + 1e-5) return false;
  if ((x < r || x > w - r) && (y < r || y > h - r))
    return Math.hypot(x - (x < r ? r : w - r), y - (y < r ? r : h - r)) <= r + 1e-5;
  return true;
}
let checked = 0;
for (const [w, h] of [[4200,4200], [2100,4200], [1400,1400]]) {
  const r = Math.min(700, Math.min(w,h)/4);
  for (const body of [20, 100, 300, Math.min(w,h)*.35]) for (const aspect of [412/915,915/412,1280/720,1,.3,3.5]) {
    const short = viewShort(body), width = short * Math.max(1,aspect), height = short / Math.min(1,aspect);
    for (const sx of [-1,1]) for (const sy of [-1,1]) {
      let previous: ReturnType<typeof constrainArenaView> | null = null;
      for (let i=0;i<=90;i++) {
        const angle=i*Math.PI/180, inset=Math.max(r,body/2+8),inner=Math.max(0,r-body/2-8);
        const focus={x:(sx<0?inset:w-inset)+sx*inner*Math.cos(angle),y:(sy<0?inset:h-inset)+sy*inner*Math.sin(angle),width:body};
        const v=constrainArenaView({x:focus.x,y:focus.y,width,height,scale:2},w,h,focus);
        assert(v.x-v.width/2>=-1e-5 && v.y-v.height/2>=-1e-5 && v.x+v.width/2<=w+1e-5 && v.y+v.height/2<=h+1e-5, 'the view stays inside the world bounds');
        assert(Math.abs(v.width*v.scale-width*2)<1e-6);assert(Math.abs(v.height*v.scale-height*2)<1e-6);
        for(const distance of [focus.x-v.x+v.width/2,v.x+v.width/2-focus.x,focus.y-v.y+v.height/2,v.y+v.height/2-focus.y])assert(distance>=body*.1-1e-5,'the followed body retains a visible central region on every side');
        if(previous){assert(Math.hypot(v.x-previous.x,v.y-previous.y)<120,'camera position is continuous while following the curved wall');assert(Math.abs(v.scale-previous.scale)<.3,JSON.stringify({reason:'zoom continuity',w,h,body,aspect,i,previous,v}));}
        previous=v; checked++;
      }
    }
    for(const p of [{x:w/2,y:h/2},{x:0,y:0},{x:w,y:h}]) {
      const v=constrainArenaView({...p,width:width*10,height:height*10,scale:1},w,h);
      for(const x of [v.x-v.width/2,v.x+v.width/2])for(const y of [v.y-v.height/2,v.y+v.height/2])assert(inside(x,y,w,h),'held views and extreme zoom never expose an exterior corner');
    }
  }
}
const unchanged={x:2100,y:2100,width:800,height:1200,scale:1};
assert.deepEqual(constrainArenaView(unchanged,4200,4200,{x:2100,y:2100,width:300}),unchanged,'ordinary interior framing and zoom are unchanged');

// Legal wall positions where the old strict rectangle completely hid a nearby body.
const encounters = [
  { focus: { x: 760, y: 760, width: 1470 }, rival: { x: 220, y: 220, width: 20 } },
  { focus: { x: 539.85, y: 57.66, width: 60 }, rival: { x: 457.63, y: 100.11, width: 90 } },
  { focus: { x: 217.753, y: 217.753, width: 20 }, rival: { x: 194, y: 244, width: 20 } },
  { focus: { x: 743, y: 1943, width: 1470 }, rival: { x: 68, y: 1500, width: 120 } },
  { focus: { x: 83, y: 1000, width: 150 }, rival: { x: 18, y: 940, width: 20 } }
];
for (const { focus, rival } of encounters) {
  for (const [pixelsX, pixelsY] of [[412, 915], [915, 412], [1280, 720]]) {
    const short = viewShort(focus.width);
    const aspect = Math.max(WORLD.MIN_VIEW_ASPECT, Math.min(WORLD.MAX_VIEW_ASPECT, pixelsX / pixelsY));
    const scale = Math.max(pixelsX / (short * Math.max(1, aspect)), pixelsY / (short / Math.min(1, aspect)));
    for (const flipX of [false, true]) for (const flipY of [false, true]) {
      const mirror = ({ x, y, width }: typeof focus) => ({ x: flipX ? 4200-x : x, y: flipY ? 4200-y : y, width });
      const subject = mirror(focus), peer = mirror(rival);
      const view = constrainArenaView({ ...subject, width: pixelsX / scale, height: pixelsY / scale, scale }, 4200, 4200, subject);
      for (const body of [subject, peer]) {
        assert(Math.abs(body.x - view.x) + body.width / 2 <= view.width / 2 + 1e-5 &&
          Math.abs(body.y - view.y) + body.width / 2 <= view.height / 2 + 1e-5,
        JSON.stringify({ reason: 'both nearby bodies fit in the view', subject, peer, view }));
      }
    }
  }
}
console.log(`Rounded camera passed: ${checked} corner/size/aspect checks, nearby rivals at corners and straight walls, continuous movement, extreme zoom and held views.`);
