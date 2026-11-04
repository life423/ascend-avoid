import assert from 'node:assert/strict';
import { HudBackingFade, hudFocus, hudObstruction } from '../src/render/hudReadability.ts';
import { pickupLabels } from '../src/render/pickupReadability.ts';

const rect = { x: 10, y: 52, width: 132, height: 80 };
assert.equal(hudObstruction(rect, [{ x: 900, y: 900, radius: 200 }], 1), 0);
assert.equal(hudObstruction(rect, [{ x: 80, y: 90, radius: 25 }], 1), 1);
// Matching physical pixels and CSS units gives identical mobile/desktop overlap geometry.
const original = hudFocus(160, 170, 400, -Math.PI / 2, .6, true, 1);
const doubled = hudFocus(320, 340, 400, -Math.PI / 2, 1.2, true, 2);
assert.equal(hudObstruction(rect, original, 1), hudObstruction({ x: 20, y: 104, width: 264, height: 160 }, doubled, 2));
assert.equal(hudFocus(160, 170, 400, 0, .6, false, 1).length, 1, 'inactive airflow cannot obstruct the HUD');
assert.equal(original.length, 3, 'face and immediate active airflow use a bounded number of checks');
const edge = hudObstruction(rect, [{ x: 10 + 132 + 24, y: 90, radius: 25 }], 1);
assert(edge > 0 && edge < 1, 'edge coverage is continuous rather than binary');
const fade = new HudBackingFade();
for (let t = 0; t <= 800; t += 16) fade.update(1, t);
assert(fade.alpha >= .22 && fade.alpha < .23, 'glass becomes transparent while text is drawn separately at full alpha');
const low = fade.alpha;
assert(Math.abs(fade.update(0, 850) - low) < .005, 'brief threshold jitter cannot restore the panel');
for (let t = 1050; t <= 3000; t += 16) fade.update(0, t);
assert(fade.alpha > .998, 'clear space smoothly restores the original HUD');

const events = [{ amount: 1, at: 500 }, { amount: 2, at: 550 }, { amount: -4, at: 600 }, { amount: 500, at: 1001 }, { amount: 900, at: 0 }];
const labels = pickupLabels(events, 1000, 800, 1, false, false);
assert.deepEqual(labels.map(l => l.amount), [3, -4], 'ignore future/expired events; preserve actual positive and negative totals');
assert.equal(labels.length, 2, 'rapid theft and collection never create an overlapping text stack');
assert(labels[1].offsetY - labels[0].offsetY >= labels[0].fontSize + 4, 'gain and loss lanes remain separated');
for (const zoom of [.12, .25, .6, 1, 2]) {
    const pixel = 1 / zoom;
    const giant = pickupLabels([{ amount: 1, at: 1000 }], 1000, 800, pixel, true, true)[0];
    assert(giant.fontSize * zoom >= 12, 'the minimum text size stays readable as a giant zooms out');
    assert(giant.offsetY >= 64 + 8 * pixel, 'reserve the existing crown and gem label before adding pickup text');
}
const still = pickupLabels([{ amount: 1, at: 900 }], 1000, 800, 3, true, true)[0];
const stillLater = pickupLabels([{ amount: 1, at: 900 }], 1200, 800, 3, true, true)[0];
assert.equal(still.offsetY, stillLater.offsetY, 'reduced motion keeps labels still');
assert(stillLater.alpha < still.alpha, 'the reduced-motion counter still retires quietly');
assert.deepEqual(pickupLabels(events, 2000, 800, 1, false, false), [], 'expired effects leave no stale UI');
console.log('HUD readability: projected face/airflow, pixel-ratio parity, continuous overlap/grace, score retention, pickup totals/expiry, giant text/crown spacing and reduced motion passed.');
