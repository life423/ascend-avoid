import assert from 'node:assert/strict';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { GameState } from '../schema/GameState.js';
import { ARENA_RULES, CANNON, GEMS } from '../constants/gameConstants.js';
import { bodyMass, creatureSize } from '../game/creatureSize.js';
import { captureHoldMs, missileMassAfterImpact } from '../game/cannon.js';
import { clearCapture, fireCaptive, knockOutWithGems, steal, syncInjuryState, updateHolds, updateInhales } from '../systems/inhale.js';
import { weaponDamage } from '../systems/weaponDamage.js';

const NOW = 100000, W = 4200;
function player(gems = 0, bot = false): PlayerSchema {
  const p = new PlayerSchema('body', 0); p.isBot = bot; p.resetGems(gems, W, W);
  p.placeAt(W / 2 - p.width / 2, W / 2 - p.height / 2); return p;
}
function world(): GameState {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off');
  s.update(0, NOW); s.blackHoles.clear(); return s;
}
function add(s: GameState, id: string, gems: number, bot = false): PlayerSchema {
  const p = s.addPlayer(id, id, NOW); p.isBot = bot; p.resetGems(gems, W, W); p.dropProtection(); return p;
}
function center(p: PlayerSchema): { x: number; y: number } { return { x: p.x + p.width / 2, y: p.y + p.height / 2 }; }

// Observe public bank, body and transactions; no test reads the internal growth account.
for (const bot of [false, true]) {
  const p = player(0, bot);
  for (let gems = 1; gems <= 40; gems++) {
    p.setGems(gems, W, W); assert.equal(p.width, creatureSize(gems), 'ordinary opening gains keep the existing pacing');
  }
  for (const gems of [100, 1000, 5000, 10000, 50000, 100000]) {
    p.setGems(gems, W, W); assert.equal(p.width, creatureSize(gems), 'genuine gains retain the full pre-taper and tapered curve');
  }
  const gradual = player(0, bot);
  for (let gems = 50; gems <= 50000; gems += 50) gradual.setGems(gems, W, W);
  assert.equal(gradual.width, creatureSize(50000), 'fractional growth is retained across many small gains');

  const giant = player(2000000, bot), midpoint = center(giant);
  assert.equal(giant.width, 1470); giant.setGems(1500000, W, W);
  assert.equal(giant.gems, 1500000); assert.equal(giant.width, 1273, 'losing a quarter of a saturated bank visibly removes a quarter of current growth');
  assert.deepEqual(center(giant), midpoint, 'ordinary physical resizing preserves the center');
  for (let i = 0; i < 10; i++) { giant.setGems(giant.gems, W, W); giant.land(); }
  assert.equal(giant.width, 1273, 'old overflow cannot heal through no-op setters or repeated land calls');
  giant.protectFor(1000, NOW); giant.dropProtection(); giant.injure(0);
  const s = world(); s.players.set(giant.sessionId, giant); s.time = giant.injuredUntil; syncInjuryState(s);
  assert(!giant.breathingBlocked); assert.equal(giant.width, 1273, 'injury expiry and protection changes restore no lost growth');

  const overflow = player(2000000, bot); overflow.setGems(10000000, W, W);
  assert.equal(overflow.gems, 10000000); assert.equal(overflow.width, 1470, 'overflow remains transferable wealth');
  overflow.setGems(5000000, W, W); assert.equal(overflow.width, 1039.5, 'receipts at the cap store no invisible growth reserve');
  const fresh = player(10000000, bot); fresh.setGems(5000000, W, W);
  assert.equal(overflow.width, fresh.width, 'extra capped receipts cannot soften the later proportional loss');
  const before = overflow.width; overflow.setGems(overflow.gems + 1000, W, W);
  assert(overflow.width > before + 10 && overflow.width < before + 25, 'newly earned gems rebuild from the damaged body, including the inverse late taper');
  assert(overflow.width < 1100, 'the old five-million bank does not refill the body on a small new receipt');
  const rebuilt = overflow.width; overflow.setGems(overflow.gems, W, W); overflow.land();
  assert.equal(overflow.width, rebuilt); assert.deepEqual(center(overflow), { x: W / 2, y: W / 2 });

  const increments = player(2000000, bot), aggregate = player(2000000, bot);
  increments.setGems(increments.gems - 1, W, W); assert.equal(increments.width, 1470, 'a tiny debit need not visibly jump a half-pixel immediately');
  for (let i = 1; i < 10000; i++) increments.setGems(increments.gems - 1, W, W);
  aggregate.setGems(1990000, W, W);
  assert.equal(increments.gems, aggregate.gems); assert.equal(increments.width, aggregate.width, 'ten thousand subpixel losses accumulate just like one accepted debit');
  assert(increments.width < 1468, 'rounding each displayed width must not erase small accepted losses');

  const nearCap = player(1e12, bot), debitsOnly = player(1e12, bot);
  for (let cycle = 0; cycle < 10; cycle++) {
    nearCap.setGems(nearCap.gems - 100000000, W, W);
    nearCap.setGems(nearCap.gems + 1, W, W);
    debitsOnly.setGems(debitsOnly.gems - 100000000, W, W);
  }
  assert.equal(nearCap.gems, 1e12 - 1000000000 + 10);
  assert(nearCap.width < 1470, 'tiny genuine pickups cannot erase accumulated subpixel damage by re-saturating a near-cap body');
  assert(nearCap.width >= debitsOnly.width && nearCap.width - debitsOnly.width <= .5, 'ten new gems provide only modest growth relative to the same accepted losses');

  const early = player(40, bot); early.setGems(30, W, W); assert.equal(early.width, 58.5);
  const established = player(1000, bot); established.setGems(750, W, W);
  assert(Math.abs(established.width - 261) <= .5, 'the proportional loss is explicit outside the final plateau too');
  established.setGems(-100, W, W); assert.equal(established.gems, 0); assert.equal(established.width, ARENA_RULES.PLAYER_SIZE);
  established.setGems(0, W, W); established.land(); established.setGems(1, W, W);
  assert.equal(established.width, creatureSize(1), 'complete loss clears growth and empty-bank gain has no division by zero');
}

{
  const p = player(10000000); p.setGems(5000000, W, W);
  for (const invalid of [NaN, Infinity, -Infinity]) p.setGems(invalid, W, W);
  assert.equal(p.gems, 5000000); assert.equal(p.width, 1039.5, 'rejected transactions cannot poison bank or body');
  p.resetGems(p.gems, W, W); assert.equal(p.width, 1470, 'absolute reconstruction is an explicit setup operation, distinct from a live no-op');
  const wire = p.toJSON(); assert.equal(wire.width, p.width);
  assert(!Object.prototype.hasOwnProperty.call(wire, 'bodyGrowthMass'), 'the server account does not become a new synchronized client field');
  p.resetGems(1e12, 2100, W); assert(p.width <= 735); p.setGems(5e11, 2100, W);
  assert(p.width > 500 && p.width < 525, 'the same account respects a smaller arena cap');
  const damaged = p.width; p.setGems(p.gems, 2100, W); p.land(); assert.equal(p.width, damaged);
}

{
  const p = player(10000000); p.setGems(5000000, W, W); const ordinary = p.width, middle = center(p);
  p.launch(NOW, 1250, 0, 'shooter', CANNON.FLIGHT_MS);
  assert.equal(p.width, CANNON.BULLET_SIZE); assert.equal(bodyMass(p.width), bodyMass(CANNON.BULLET_SIZE));
  p.setGems(p.gems, W, W); p.land(); assert.equal(p.width, ordinary); assert.deepEqual(center(p), middle);
  p.launch(NOW, 1250, 0, 'shooter', CANNON.FLIGHT_MS); p.setGems(2500000, W, W);
  assert.equal(p.width, CANNON.BULLET_SIZE, 'a live debit cannot change the projectile collision shell or its impact mass');
  p.land(); assert(p.width < ordinary - 250, 'landing restores the debited ordinary body, not the overflowing bank');
  const reduced = p.width; p.launch(NOW, 900, 0, '', 1400, 1.1, 'turbine');
  assert.equal(p.width, reduced, 'fan flight keeps the stored ordinary body'); p.land(); assert.equal(p.width, reduced);
  p.setGems(p.gems + 1000, W, W); assert(p.width > reduced && p.width < 1000, 'a genuine post-flight receipt regrows without overflow healing');
  for (const gems of [0, 1, 5, 32]) assert(missileMassAfterImpact(gems, 1470) <= gems, 'computed flight retention cannot mint a bank from a larger physical shell');
}

function capture(gems: number, captorGems: number, bot = false, shrinkTo?: number) {
  const s = world(), owner = add(s, 'owner', captorGems, bot), prey = add(s, 'prey', gems, bot);
  if (shrinkTo !== undefined) prey.setGems(shrinkTo, W, W);
  owner.placeAt(1000, 1600); owner.facing = 0;
  prey.placeAt(owner.x + owner.width * .8 + 1 - prey.width / 2, owner.y + (owner.height - prey.height) / 2);
  const before = { ownerGems: owner.gems, preyGems: prey.gems, ownerWidth: owner.width, preyWidth: prey.width };
  const hold = captureHoldMs(owner.width, prey.width); owner.startInhale(NOW); updateInhales(s, NOW, .001);
  assert.equal(owner.gulping, prey.sessionId); assert.equal(prey.capturedBy, owner.sessionId);
  return { s, owner, prey, before, hold };
}
for (const bot of [false, true]) {
  const { s, owner, prey, before, hold } = capture(1000, 5000, bot);
  assert.equal(prey.gems, 32); assert.equal(prey.width, CANNON.BULLET_SIZE, 'capture conversion uses the normal bullet backing, not a proportional damage debit');
  assert.equal(owner.gems + prey.gems, before.ownerGems + before.preyGems);
  assert.equal(prey.captureRatio, before.ownerWidth / before.preyWidth); assert.equal(prey.captureHoldMs, hold); assert.equal(owner.gulpEndsAt, hold);
  const balances = [owner.gems, prey.gems]; s.time = hold - 1; updateHolds(s, NOW + s.time);
  assert.deepEqual([owner.gems, prey.gems], balances, 'holding does not transfer growth or gems again');
  s.time = hold; updateHolds(s, NOW + s.time);
  assert(!prey.capturedBy && !prey.flying); assert.equal(prey.width, CANNON.BULLET_SIZE); assert.deepEqual([owner.gems, prey.gems], balances);
}
{
  // A tiny physical body can still carry real overflow wealth after a large proportional debit.
  const { s, owner, prey, before, hold } = capture(1e12, 60, false, 1e9);
  assert(before.preyWidth < 60 && before.preyGems === 1e9);
  assert.equal(prey.gems, 32); assert.equal(prey.width, before.preyWidth, 'capture does not enlarge a smaller body to its bank-derived bullet size');
  assert.equal(owner.gems, before.ownerGems + before.preyGems - 32); assert.equal(owner.width, 1470);
  assert.equal(prey.captureRatio, before.ownerWidth / before.preyWidth); assert.equal(owner.gulpEndsAt, hold, 'the captor windfall cannot extend the pre-transfer hold');
  assert(!fireCaptive(s, owner, NOW), 'the capture-causing input still cannot auto-fire');
  owner.captureNeedsRelease = false; assert(fireCaptive(s, owner, NOW + 1)); assert.equal(prey.width, CANNON.BULLET_SIZE);
  prey.land(); assert.equal(prey.width, before.preyWidth); assert.equal(prey.gems, 32);
  clearCapture(s, owner.sessionId, NOW + 2);
  const small = player(12); const width = small.width; small.captureGems(32, W, W);
  assert.equal(small.gems, 12); assert.equal(small.width, width, 'capture conversion cannot mint gems or enlarge smaller ammunition');
}

{
  const s = world(), victim = add(s, 'victim', 2000000), builder = add(s, 'builder', 0);
  const total = victim.gems + builder.gems, hit = weaponDamage(s, victim, builder.sessionId, 500000, NOW);
  assert.equal(hit.lost, 500000); assert.equal(victim.width, 1273); assert.equal(victim.gems + builder.gems, total);
  assert.equal(builder.weaponDamage, hit.lost); const once = victim.width;
  assert(weaponDamage(s, victim, builder.sessionId, 500000, NOW + 1).blocked); assert.equal(victim.width, once, 'a rejected hit cannot debit growth twice');
}
{
  const s = world(), victim = add(s, 'victim', 2000000), thief = add(s, 'thief', 113964);
  victim.placeAt(2500 - victim.width / 2, 2100 - victim.height / 2);
  thief.placeAt(victim.x - thief.width - 4, 2100 - thief.height / 2); thief.facing = 0; victim.injure(s.time); thief.startInhale(NOW);
  const total = victim.gems + thief.gems, before = victim.gems;
  steal(s, thief, NOW, .1);
  const lost = before - victim.gems; assert(lost > 0 && victim.width < 1470);
  assert.equal(victim.gems + thief.gems, total); assert.equal(victim.robbedTotal, lost); assert.equal(thief.stolenTotal, lost);
  const control = player(before); control.setGems(victim.gems, W, W);
  assert.equal(victim.width, control.width, 'actual theft debits physical growth exactly once');
}

{
  const p = player(10000000), control = player(10000000);
  for (let second = 0; second < 60; second++) p.decay(1, W, W);
  assert(p.gems > 9400000 && p.gems < 9430000, 'existing upkeep still loses about0.1% of excess each second');
  assert(p.width > 1425 && p.width < 1428, 'unchanged upkeep now physically affects a capped body');
  control.setGems(p.gems, W, W); assert.equal(p.width, control.width, 'many upkeep losses equal their accepted aggregate debit');
}
{
  const s = world(), p = add(s, 'respawn', 10000000); p.setGems(5000000, W, W); const damaged = p.width;
  assert(s.spawn(p, NOW + 1)); assert.equal(p.width, damaged, 'spawn preparation cannot refill retained overflow wealth');
  knockOutWithGems(s, p, NOW + 2); assert.equal(p.gems, 0); assert.equal(p.width, ARENA_RULES.PLAYER_SIZE);
  p.pendingWeaponGems = 300; p.pendingCombatGems = 100;
  assert(s.spawn(p, NOW + 5000)); assert.equal(p.gems, 400); assert.equal(p.width, creatureSize(400));
  assert.equal(p.pendingWeaponGems + p.pendingCombatGems, 0);
  const paidWidth = p.width; assert(s.spawn(p, NOW + 6000));
  assert.equal(p.gems, 400); assert.equal(p.width, paidWidth, 'spawn retry neither duplicates pending rewards nor rebuilds from old stock');
}
assert.equal(GEMS.SIZE_MAX_SHARE, .35, 'accounting uses the existing physical cap');
console.log('Growth account passed: unchanged earned pacing, proportional live loss, fractional accumulation, overflow/no-op protection, genuine regrowth, private wire state, capture conservation/snapshots, fixed flight shell, exact theft/damage, upkeep and once-only respawn rewards.');
