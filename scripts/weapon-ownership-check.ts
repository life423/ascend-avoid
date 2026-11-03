import assert from 'node:assert/strict';
import { ownsWeapon, ownershipReveal, WEAPON_OWNERSHIP } from '../src/render/weaponOwnership.ts';
function luminance(hex: string): number {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a: string, b: string): number {
    const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
assert(ownsWeapon({ owner: 'me' }, 'me'));
for (const local of ['', null, undefined, 'other']) assert(!ownsWeapon({ owner: 'me' }, local));
assert(!ownsWeapon({ owner: '' }, ''));
const w = { owner: 'me', phase: 'parts' };
assert.equal(ownershipReveal(w, 'me', 1000), null);
w.phase = 'carried'; assert.equal(ownershipReveal(w, 'me', 1010), 0);
assert.equal(ownershipReveal(w, 'me', 1335), .5);
w.phase = 'charging'; assert.equal(ownershipReveal(w, 'me', 1660), null, 'placement does not replay assembly');
w.phase = 'active'; assert.equal(ownershipReveal(w, 'me', 2000), null);
w.owner = 'other'; assert.equal(ownershipReveal(w, 'me', 2100), null);
assert(!ownsWeapon(w, 'me'), 'ownership changes immediately remove the safety claim');
w.owner = 'me'; assert.equal(ownershipReveal(w, 'me', 2200), 0);
const joined = { owner: 'me', phase: 'active' }; assert.equal(ownershipReveal(joined, 'me', 1e6), null, 'joining an active world creates no assembly flash');
for (const background of ['#16293a', '#0a192f', '#172a46', WEAPON_OWNERSHIP.edge]) assert(contrast(WEAPON_OWNERSHIP.mint, background) >= 12);
for (const background of ['#ffffff', '#ffd166', '#4fe3d9']) assert(contrast(WEAPON_OWNERSHIP.edge, background) > 11, 'opaque navy separates the essential mark on bright overlaps');
console.log('Weapon ownership: exact owner/unknown/disconnect safety, single assembly reveal, placement/lifecycle and contrasting mint/navy pairs passed.');
