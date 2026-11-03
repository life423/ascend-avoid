import assert from 'node:assert/strict';
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
  for (const body of [20, 100, 300, Math.min(1260, Math.min(w,h)*.3)]) for (const aspect of [412/915,915/412,1280/720,1,.3,3.5]) {
    const short = viewShort(body), width = short * Math.max(1,aspect), height = short / Math.min(1,aspect);
    for (const sx of [-1,1]) for (const sy of [-1,1]) {
      let previous: ReturnType<typeof constrainArenaView> | null = null;
      for (let i=0;i<=90;i++) {
        const angle=i*Math.PI/180, inner=r-body/2-8;
        const focus={x:(sx<0?r:w-r)+sx*inner*Math.cos(angle),y:(sy<0?r:h-r)+sy*inner*Math.sin(angle),width:body};
        const v=constrainArenaView({x:focus.x,y:focus.y,width,height,scale:2},w,h,focus);
        for(const x of [v.x-v.width/2,v.x+v.width/2])for(const y of [v.y-v.height/2,v.y+v.height/2])assert(inside(x,y,w,h),JSON.stringify({w,h,body,aspect,i,v,focus}));
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
console.log(`Rounded camera passed: ${checked} independent corner/size/aspect checks, visible body core, continuous corner movement, extreme zoom and held views.`);
