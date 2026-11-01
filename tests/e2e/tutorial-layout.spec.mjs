import { test, expect } from '@playwright/test';
import { openLesson, practiceInput, playPractice, readPractice } from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local tutorial checks');
test.beforeEach(({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch control geometry');
  page.on('pageerror', e => { throw e; });
});

async function recordControls(page) {
  await page.evaluate(() => {
    const controls = window.game.currentGameMode.controls, draw = controls.draw;
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function(x, y, radius, ...args) {
      if (window.recordingControls) window.controlArcs.push({ x, y, radius });
      return arc.call(this, x, y, radius, ...args);
    };
    controls.draw = function(...args) {
      window.controlArcs = []; window.recordingControls = true;
      window.controlFrame = { width: args[0].canvas.width, height: args[0].canvas.height };
      try { return draw.apply(this, args); } finally { window.recordingControls = false; }
    };
  });
}

async function clearOfControls(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect.poll(() => page.evaluate(() => {
    const bar = document.querySelector('.practice-actions').getBoundingClientRect();
    const c = document.querySelector('canvas.game-canvas'), box = c.getBoundingClientRect();
    const arcs = window.controlArcs ?? [];
    const inset = window.game.responsiveManager.safeArea;
    if (!arcs.length || window.controlFrame?.width !== c.width || window.controlFrame?.height !== c.height || bar.left < box.left + inset.left || bar.right > box.right - inset.right + .5 || bar.top < box.top + inset.top || bar.bottom > box.bottom - inset.bottom + .5) return false;
    const sx = box.width / c.width, sy = box.height / c.height;
    for (const arc of arcs) {
      const x = box.left + arc.x * sx, y = box.top + arc.y * sy, radius = arc.radius * Math.max(sx, sy);
      const gap = Math.hypot(Math.max(bar.left - x, 0, x - bar.right), Math.max(bar.top - y, 0, y - bar.bottom)) - radius;
      if (gap < 10) return false;
    }
    const place = document.querySelector('.weapon-place-button:not([hidden])')?.getBoundingClientRect();
    if (place && !(bar.right + 10 <= place.left || place.right + 10 <= bar.left || bar.bottom + 10 <= place.top || place.bottom + 10 <= bar.top)) return false;
    return true;
  }), { message: 'the actual drawn joystick, knob and action ring must have visible clearance' }).toBe(true);
}

test('toolbar clears drawn controls across sizes, safe areas, enlarged text and a panned viewport', async ({ page }) => {
  test.setTimeout(90000);
  await openLesson(page, 'defense'); await recordControls(page);
  for (const [width, height] of [[280,568],[320,568],[360,640],[393,852],[412,915],[430,932],[568,320],[667,375],[740,340],[812,375],[915,412],[1024,600],[768,1024],[1280,800],[320,320],[360,280],[568,240]]) {
    await page.setViewportSize({ width, height });
    await test.step(`${width} × ${height}`,()=>clearOfControls(page));
    if (height < 300) for (const button of await page.locator('.practice-actions button').all()) {
      await button.focus();
      await button.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'nearest'}));
      expect(await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBe(true);
    }
    if ([280,412,568,768].includes(width)) await page.screenshot({ path:test.info().outputPath(`clear-${width}x${height}.png`), scale:'css' });
  }
  await page.setViewportSize({ width:412, height:915 });
  await page.evaluate(() => {
    for (const [side,value] of Object.entries({top:24,right:28,bottom:34,left:28})) document.documentElement.style.setProperty(`--arena-safe-${side}`,`${value}px`);
    dispatchEvent(new Event('resize'));
  });
  await clearOfControls(page);
  await page.addStyleTag({ content:'.practice-actions button { font-size:24px !important; }' });
  await clearOfControls(page);
  await page.evaluate(() => {
    for (const [name,value] of Object.entries({width:innerWidth-24,height:innerHeight-160,offsetTop:16,offsetLeft:12})) Object.defineProperty(visualViewport,name,{configurable:true,get:()=>value});
    visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll'));
  });
  await clearOfControls(page);
  await page.screenshot({ path:test.info().outputPath('safe-area-large-text-panned.png'), scale:'css' });
});

test('a floating joystick and its fully extended knob never run under the toolbar', async ({ page }) => {
  await openLesson(page, 'defense'); await recordControls(page);
  const c = page.locator('canvas.game-canvas');
  for (const [width,height] of [[412,915],[740,340]]) {
    await page.setViewportSize({width,height}); await clearOfControls(page);
    for (const y of [height-96,height/2]) {
      await c.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:41,clientX:96,clientY:y});
      for (const [dx,dy] of [[0,-90],[90,0],[-90,0],[0,90]]) {
        await page.evaluate(({x,y})=>window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',pointerId:41,clientX:x,clientY:y})),{x:96+dx,y:y+dy});
        await clearOfControls(page);
      }
      await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',pointerId:41})));
    }
  }
});

test('carried weapon placement stays separate from the toolbar and touch controls', async ({ page,browserName,hasTouch }) => {
  test.setTimeout(60000); await openLesson(page,'weapon'); await recordControls(page);
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await playPractice(page,input,{until:v=>v.stage==='place'&&v.phase==='waiting'});
    for(const [width,height] of [[320,568],[412,915],[568,320],[740,340],[768,1024]]) {
      await page.setViewportSize({width,height}); await clearOfControls(page);
      const place=page.getByRole('button',{name:'Place weapon',exact:true});
      expect(await place.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);
      await page.screenshot({path:test.info().outputPath(`place-${width}.png`),scale:'css'});
    }
    await input.tapButton(page.getByRole('button',{name:'Place weapon',exact:true}));
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getState().practice.phase==='complete');
    expect((await readPractice(page)).failures).toBe(0);
  } finally { await input.close(); }
});
