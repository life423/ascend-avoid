import type { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { GemSchema } from '../schema/GemSchema.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { clearCapture, updateInhales, injuryVulnerable, stealWeight } from '../systems/inhale.js';
import { spawnWeapon, updateWeapons, deployWeapon } from '../systems/weapons.js';
import { PRACTICE_ARENA, PRACTICE_STAGES, PRACTICE_LESSONS, BLACK_HOLE_LESSON, type PracticeLesson } from './definitions.js';

/** One learner, explicit targets, real gameplay events. Failed attempts never rewind passed steps. */
export class PracticeController {
  connected = true;
  private learnerId = '';
  private progress = new Map<PracticeLesson, number>();
  private completed = new Set<PracticeLesson>();
  private ammoId = '';
  private targetId = '';
  private stageStartedAt = 0;
  private successAt = 0;
  private resetAt = 0;
  private shotStarted = false;
  private finishBank = 26;
  private lastActivity = 0;
  constructor(readonly state: GameState) {}
  private get view() { return this.state.practice; }
  private get learner() { return this.state.players.get(this.learnerId); }

  attach(id: string, lesson: PracticeLesson, now: number, sequence = false): void {
    this.learnerId = id; this.lastActivity = now;
    if (sequence) this.startSequence(now); else this.select(lesson, false, now);
  }
  startSequence(now: number): void {
    this.progress.clear(); this.completed.clear(); this.view.completed = '';
    this.select('basics', true, now, true);
  }
  activity(now: number): void { this.lastActivity = now; }
  select(lesson: PracticeLesson, replay = false, now = this.state.now, sequence = false): void {
    this.view.sequence = sequence;
    // Extra vertical room lets narrow portrait cameras show a long shot without exposing exterior.
    this.state.worldHeight = lesson === 'blackhole' ? BLACK_HOLE_LESSON.height : PRACTICE_ARENA.height;
    if (replay || this.completed.has(lesson)) { this.progress.set(lesson, 0); this.completed.delete(lesson); }
    this.view.completed = [...this.completed].join(',');
    this.clearScene(now); this.view.lesson = lesson; this.view.total = PRACTICE_STAGES[lesson].length;
    this.view.passed = this.progress.get(lesson) ?? 0; this.view.failures = 0;
    this.setup(now);
  }
  skip(attempt: number, now: number): void {
    if (attempt !== this.view.attempt) return;
    this.clearScene(now); this.view.phase = 'choosing'; this.view.attempt++;
    this.view.targetId = ''; this.view.objectiveKind = ''; this.lastActivity = now;
    if (this.view.sequence) {
      const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(this.view.lesson as PracticeLesson) + 1];
      if (next) this.select(next, true, now, true);
      else this.view.phase = 'finished';
    }
  }
  retry(attempt: number, now: number): void {
    if (attempt === this.view.attempt && this.view.phase === 'waiting') this.fail(now);
  }
  private clearScene(now: number, keepAmmo = false, keepTarget = false): void {
    for (const p of [...this.state.players.values()]) if (p.sessionId !== this.learnerId && !(keepAmmo && p.sessionId === this.ammoId) && !(keepTarget && p.sessionId === this.targetId)) {
      clearCapture(this.state, p.sessionId, now); this.state.clearTheftFor(p.sessionId); this.state.players.delete(p.sessionId);
    }
    this.state.gems.clear(); this.state.fieldGems = 0;
    if (!keepAmmo && this.learner) clearCapture(this.state, this.learnerId, now);
    this.state.blackHoles.clear(); this.state.weaponsOn = false;
    const w = this.state.pinwheel; w.phase = 'waiting'; w.at = 2_147_483_647;
    w.parts.clear(); w.bolts.clear(); w.owner = ''; w.progress = 0;
  }
  private resetLearner(gems: number, now: number): PlayerSchema {
    const p = this.learner;
    if (!p) throw new Error('Practice setup requires its authorized learner');
    p.land(); p.spawnAt(0, 0, now); p.setGems(gems, this.state.worldWidth, this.state.worldHeight);
    p.placeAt(PRACTICE_ARENA.x - p.width / 2, PRACTICE_ARENA.y - p.height / 2);
    p.spawnProtected = false; p.facing = 0; p.stamina = 1; p.staminaAt = now;
    p.exhaleReadyAt = p.puffReadyAt = p.inhaleBlockedUntil = 0;
    p.stopInhale(now); p.steer(0, 0); p.aimAt(0, 0);
    return p;
  }
  private npc(role: string, gems: number, x: number, y: number): PlayerSchema {
    const id = `practice-${this.view.lesson}-${role}-${this.view.attempt}`;
    const p = new PlayerSchema(id, this.state.nextPlayerIndex++);
    p.name = role === 'ammo' ? 'Ammunition' : role === 'attacker' ? 'Practice attacker' : 'Practice rival';
    p.isBot = true; p.setGems(gems, this.state.worldWidth, this.state.worldHeight);
    p.placeAt(x - p.width / 2, y - p.height / 2); p.spawnProtected = false;
    this.state.players.set(id, p); return p;
  }
  private objective(kind: string, id = '', x = 0, y = 0): void {
    this.view.objectiveKind = kind; this.view.targetId = id; this.view.objectiveX = x; this.view.objectiveY = y;
  }
  private preload(p: PlayerSchema, gems: number, now: number): void {
    const ammo = this.npc('ammo', gems, p.x + p.width * .8 + 1, p.y + p.height / 2);
    this.ammoId = ammo.sessionId;
    p.startInhale(now); updateInhales(this.state, now, .001);
    if (p.gulping !== ammo.sessionId) throw new Error('Practice captive setup must satisfy ordinary capture rules');
    p.stopInhale(now); p.captureNeedsRelease = false; // Internal setup at rest; no learner capture input is held.
  }
  private setup(now: number, carry = false): void {
    const lesson = this.view.lesson as PracticeLesson;
    const stage = PRACTICE_STAGES[lesson][this.view.passed];
    if (!stage || !this.learner) return;
    this.view.phase = 'setup'; this.view.attempt++; this.view.stage = stage; this.view.cue = '';
    this.stageStartedAt = now; this.successAt = this.resetAt = 0; this.shotStarted = false;
    if (!carry) { this.view.resetSerial++; this.clearScene(now); }
    let p = this.learner;
    if (lesson === 'basics') {
      if (stage === 'grow') {
        p = this.resetLearner(0, now);
        for (let i = 0; i < 4; i++) { const gem = new GemSchema(PRACTICE_ARENA.x + 55 + i * 28, PRACTICE_ARENA.y); gem.value = 10; this.state.gems.set(`practice-gem-${this.view.attempt}-${i}`, gem); }
        this.state.fieldGems = 4; this.objective('gem', '', PRACTICE_ARENA.x + 55, PRACTICE_ARENA.y);
      } else if (stage === 'capture') {
        p = this.resetLearner(40, now);
        const ammo = this.npc('ammo', 12, p.x + p.width + 65, p.y + p.height / 2);
        this.ammoId = ammo.sessionId; this.objective('player', this.ammoId);
      } else if (stage === 'shoot') {
        if (!carry || !p.gulping) { p = this.resetLearner(40, now); this.preload(p, 12, now); }
        const target = this.npc('larger-rival', 75, p.x + p.width / 2 + 300, p.y + p.height / 2);
        this.targetId = target.sessionId; this.objective('player', this.targetId);
      } else {
        if (carry) {
          const spent = this.state.players.get(this.ammoId);
          if (spent) { clearCapture(this.state, spent.sessionId, now); this.state.players.delete(spent.sessionId); }
        }
        if (!carry) {
          p = this.resetLearner(40, now);
          const target = this.npc('injured-rival', this.finishBank, p.x + p.width / 2 + 170, p.y + p.height / 2);
          target.injure(this.state.time); this.targetId = target.sessionId;
        }
        this.objective('player', this.targetId);
      }
    } else if (lesson === 'blackhole') {
      if (stage === 'capture') {
        p = this.resetLearner(250, now);
        const ammo = this.npc('ammo', 100, p.x + p.width + 65, p.y + p.height / 2);
        this.ammoId = ammo.sessionId; this.objective('player', this.ammoId);
      } else {
        // Restore only a failed shot. A first attempt carries the learner's actual capture forward.
        if (!carry || !p.gulping) { p = this.resetLearner(250, now); this.preload(p, 100, now); }
        this.state.blackHoles.push(new BlackHoleSchema(BLACK_HOLE_LESSON.x, BLACK_HOLE_LESSON.y, 64, 0));
        this.objective('hole', '', BLACK_HOLE_LESSON.x, BLACK_HOLE_LESSON.y);
      }
    } else if (lesson === 'weapon') {
      if (stage === 'collect' || !carry) {
        p = this.resetLearner(40, now); this.state.weaponsOn = true;
        spawnWeapon(this.state, PRACTICE_ARENA.x + 140, PRACTICE_ARENA.y, 'pulsar');
        let i = 0; for (const part of this.state.pinwheel.parts) { part.x = PRACTICE_ARENA.x + 110 + i * 48; part.y = PRACTICE_ARENA.y + (i - 1) * 86; i++; }
        if (stage !== 'collect') {
          // Restore an already-proven assembly through real contact collection, not a client command.
          for (const part of this.state.pinwheel.parts) { part.x = p.x + p.width / 2; part.y = p.y + p.height / 2; }
          updateWeapons(this.state, .001, now);
        }
      }
      this.state.weaponsOn = true;
      if (stage === 'effect') {
        const w = this.state.pinwheel;
        if (!carry) deployWeapon(this.state, p);
        const target = this.npc('weapon-target', 60, w.x + 180, w.y);
        this.targetId = target.sessionId; this.objective('player', this.targetId);
      } else { const part = this.state.pinwheel.parts[0]; this.objective(stage === 'collect' ? 'parts' : 'placement', '', part?.x ?? 0, part?.y ?? 0); }
    } else {
      p = this.resetLearner(100, now);
      const attacker = this.npc('attacker', 100, p.x + p.width + 95, p.y + p.height / 2);
      attacker.facing = Math.PI; this.targetId = attacker.sessionId;
      this.objective('player', this.targetId); this.view.cue = 'warning';
    }
    this.view.phase = 'waiting'; this.lastActivity = now;
  }
  private success(now: number): void {
    if (this.view.phase !== 'waiting') return;
    this.view.phase = 'success'; this.successAt = now; this.lastActivity = now;
    const lesson = this.view.lesson as PracticeLesson;
    this.progress.set(lesson, this.view.passed + 1);
  }
  private fail(now: number): void {
    if (this.view.phase !== 'waiting') return;
    this.view.phase = 'reset'; this.view.failures++; this.resetAt = now;
    this.learner?.stopInhale(now); this.learner?.steer(0, 0); this.lastActivity = now;
  }
  observe(type: string, data: Record<string, unknown>, now: number, attempt = this.view.attempt): void {
    if (attempt !== this.view.attempt || this.view.phase !== 'waiting') return;
    const own = data.byId === this.learnerId;
    if (this.view.lesson === 'basics') {
      if (this.view.stage === 'capture' && type === 'capture' && own && data.targetId === this.ammoId) this.success(now);
      if (this.view.stage === 'shoot' && type === 'launch' && own && data.id === this.ammoId) this.shotStarted = true;
      if (this.view.stage === 'shoot' && type === 'impact' && own && data.projectileId === this.ammoId && data.targetId === this.targetId && Number(data.gems) > 0) {
        const target = this.state.players.get(this.targetId);
        if (data.out === true) { this.progress.set('basics', PRACTICE_STAGES.basics.length); this.view.passed = PRACTICE_STAGES.basics.length - 1; }
        else this.finishBank = target?.gems ?? 26;
        this.success(now);
      }
      if (this.view.stage === 'finish' && type === 'combatReward' && own && data.targetId === this.targetId && data.how === 'mouth') this.success(now);
    } else if (this.view.lesson === 'blackhole') {
      if (this.view.stage === 'capture' && type === 'capture' && own && data.targetId === this.ammoId) this.success(now);
      if (this.view.stage === 'shoot') {
        if (type === 'launch' && own && data.id === this.ammoId) this.shotStarted = true;
        if (type === 'combatReward' && own && data.targetId === this.ammoId && data.how === 'blackhole') this.success(now);
      }
    } else if (this.view.lesson === 'weapon') {
      if (this.view.stage === 'collect' && type === 'weaponAssembled' && own && this.state.pinwheel.owner === this.learnerId && this.state.pinwheel.phase === 'carried') this.success(now);
      if (this.view.stage === 'place' && type === 'weaponPlaced' && own && this.state.pinwheel.owner === this.learnerId && this.state.pinwheel.phase === 'charging') this.success(now);
      if (this.view.stage === 'effect' && type === 'credit' && own && data.targetId === this.targetId && data.how === 'pulsar' && Number(data.gems) > 0) this.success(now);
    } else if (type === 'parry' && data.id === this.learnerId && data.targetId === this.targetId) this.success(now);
    else if (type === 'exhale' && data.id === this.learnerId) this.fail(now);
  }
  beforeTick(now: number): void {
    if (!this.connected || !this.learner) return;
    if (this.view.phase === 'waiting' && this.view.lesson === 'defense' && now - this.stageStartedAt >= 1400) {
      const attacker = this.state.players.get(this.targetId);
      if (attacker && this.view.cue === 'warning') { attacker.startInhale(now); this.view.cue = 'attacking'; }
    }
  }
  afterTick(now: number): void {
    if (!this.connected || !this.learner) return;
    if (this.view.phase === 'complete' && this.view.sequence && now - this.lastActivity >= 1400) {
      const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(this.view.lesson as PracticeLesson) + 1];
      if (next) this.select(next, true, now, true);
      return;
    }
    if (this.view.phase === 'success' && this.view.lesson === 'basics' && this.view.stage === 'shoot') {
      const spent = this.state.players.get(this.ammoId);
      if (spent) { clearCapture(this.state, spent.sessionId, now); this.state.players.delete(spent.sessionId); }
    }
    if (this.view.phase === 'reset' && now - this.resetAt >= 100) { this.setup(now); return; }
    const successMs = this.view.lesson === 'blackhole' && this.view.stage === 'shoot' ? BLACK_HOLE_LESSON.rewardMs : 650;
    if (this.view.phase === 'success' && now - this.successAt >= successMs) {
      const lesson = this.view.lesson as PracticeLesson, next = this.progress.get(lesson) ?? 0;
      if (next >= PRACTICE_STAGES[lesson].length) {
        this.completed.add(lesson); this.view.completed = [...this.completed].join(','); this.view.phase = 'complete';
        this.clearScene(now); this.objective(''); this.lastActivity = now; return;
      }
      this.view.passed = next; this.view.failures = 0; this.setup(now, true); return;
    }
    if (this.view.phase !== 'waiting') return;
    const p = this.learner;
    if (p.state !== 'alive' || p.injuredUntil > this.state.time || p.continuedTheft) { this.fail(now); return; }
    const target = this.state.players.get(this.targetId);
    const ammo = this.state.players.get(this.ammoId);
    if (this.view.stage === 'grow') {
      const first = this.state.gems.values().next().value;
      if (first) this.objective('gem', '', first.x, first.y);
      if (p.gems >= 40 && !this.state.gems.size) this.success(now);
    } else if (this.view.stage === 'capture') {
      if (!ammo || ammo.state !== 'alive') this.fail(now);
    } else if (this.view.stage === 'shoot') {
      if (!ammo || ammo.state !== 'alive' || (!ammo.capturedBy && !ammo.flying) || (this.shotStarted && !ammo.flying)) this.fail(now);
    } else if (this.view.lesson === 'basics' && this.view.stage === 'finish') {
      if (target && now < target.suctionSafeUntil) this.view.cue = 'recovering';
      else if (p.stunned) this.view.cue = 'resume-inhale';
      else if (p.inhaling || this.view.cue === 'recovering') this.view.cue = '';
      if (!target || target.state !== 'alive' || !injuryVulnerable(this.state, target, now)) this.fail(now);
    } else if (this.view.lesson === 'weapon') {
      const w = this.state.pinwheel;
      if (this.view.stage === 'collect') { const part = w.parts.find(part => part.carriedBy !== this.learnerId); if (part) this.objective('parts', '', part.x, part.y); }
      else if ((this.view.stage === 'place' && w.phase !== 'carried') || (this.view.stage === 'effect' && (!target || w.phase === 'waiting'))) this.fail(now);
    } else if (this.view.lesson === 'defense' && this.view.cue === 'attacking') {
      if (!target || !target.inhaling || stealWeight(this.state, target, p) <= 0 || now - this.stageStartedAt > 4400) this.fail(now);
    }
  }
  shouldClose(now: number): boolean {
    return now - this.lastActivity > (['complete', 'choosing', 'finished'].includes(this.view.phase) ? PRACTICE_ARENA.finishedMs : PRACTICE_ARENA.idleMs);
  }
}
