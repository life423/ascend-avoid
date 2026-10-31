import type { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { GemSchema } from '../schema/GemSchema.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { clearCapture, updateInhales, injuryVulnerable } from '../systems/inhale.js';
import { spawnWeapon, updateWeapons, deployWeapon } from '../systems/weapons.js';
import { waveActive } from '../game/gustWave.js';
import { EXHALE } from '../constants/gameConstants.js';
import { PRACTICE_ARENA, PRACTICE_STAGES, PRACTICE_LESSONS, BLACK_HOLE_LESSON, type PracticeLesson } from './definitions.js';

type FinishCheckpoint = { gems: number; targetGems: number };

/** Private scenarios use ordinary physics. Only server-observed results certify a stage. */
export class PracticeController {
  connected = true;
  private learnerId = '';
  private progress = new Map<PracticeLesson, number>();
  private completed = new Set<PracticeLesson>();
  private readied = new Set<string>();
  private ammoId = '';
  private targetId = '';
  private stageStartedAt = 0;
  private successAt = 0;
  private resetAt = 0;
  private shotStarted = false;
  private aimedSince = 0;
  private puffAt = 0;
  private rearBroken = false;
  private injuryEndsAt = 0;
  private startX = 0;
  private startY = 0;
  private waitForRespawn = false;
  private respawnSeenAt = 0;
  private finishBank: FinishCheckpoint = { gems: 40, targetGems: 26 };
  private theftStart = 0;
  private lastActivity = 0;
  constructor(readonly state: GameState) {}
  private get view() { return this.state.practice; }
  private get learner() { return this.state.players.get(this.learnerId); }
  private get acting() { return this.view.phase === 'waiting' || this.view.phase === 'resolving'; }

  attach(id: string, lesson: PracticeLesson, now: number, sequence = false): void {
    this.learnerId = id; this.lastActivity = now;
    if (sequence) this.startSequence(now); else this.select(lesson, false, now);
  }
  startSequence(now: number): void {
    this.progress.clear(); this.completed.clear(); this.readied.clear(); this.view.completed = '';
    this.select('basics', true, now, true);
  }
  activity(now: number): void { this.lastActivity = now; }
  select(lesson: PracticeLesson, replay = false, now = this.state.now, sequence = false, carryAmmo = false): void {
    this.view.sequence = sequence;
    // Room for the real seven-second escape, and for both subjects on narrow portrait screens.
    this.state.worldWidth = lesson === 'defense' ? 2400 : PRACTICE_ARENA.width;
    this.state.worldHeight = lesson === 'defense' ? 2400 : (lesson === 'blackhole' || lesson === 'combat') ? BLACK_HOLE_LESSON.height : PRACTICE_ARENA.height;
    if (replay || this.completed.has(lesson)) {
      this.progress.set(lesson, 0); this.completed.delete(lesson);
      for (const key of [...this.readied]) if (key.startsWith(lesson + '/')) this.readied.delete(key);
    }
    this.view.completed = [...this.completed].join(',');
    this.clearScene(now, carryAmmo);
    this.view.lesson = lesson; this.view.total = PRACTICE_STAGES[lesson].length;
    this.view.passed = this.progress.get(lesson) ?? 0; this.view.failures = 0; this.view.feedback = '';
    this.setup(now, carryAmmo);
  }
  skip(attempt: number, now: number): void {
    if (attempt !== this.view.attempt) return;
    this.clearScene(now); this.view.phase = 'choosing'; this.view.attempt++;
    this.view.targetId = ''; this.view.objectiveKind = ''; this.lastActivity = now;
    if (this.view.sequence) {
      const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(this.view.lesson as PracticeLesson) + 1];
      if (next) this.select(next, true, now, true); else this.view.phase = 'finished';
    }
  }
  ready(attempt: number, now: number): void {
    if (attempt !== this.view.attempt || this.view.phase !== 'ready') return;
    this.readied.add(this.view.lesson + '/' + this.view.stage);
    this.view.phase = 'waiting'; this.stageStartedAt = this.lastActivity = now;
    if (this.view.stage === 'injured-escape' && this.learner) {
      this.learner.injure(this.state.time); this.injuryEndsAt = this.learner.injuredUntil; this.view.cue = 'injured';
    }
  }
  retry(attempt: number, now: number): void {
    if (attempt === this.view.attempt && this.acting) this.fail(now, 'This attempt is ready to try again.');
  }
  private clearScene(now: number, keepAmmo = false): void {
    this.state.gustWaves.clear();
    for (const p of [...this.state.players.values()]) {
      if (p.sessionId === this.learnerId || (keepAmmo && p.sessionId === this.ammoId)) continue;
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
    p.dropProtection(); p.facing = 0; p.spin = 0; p.stamina = 1; p.staminaAt = now;
    p.exhaleReadyAt = p.puffReadyAt = p.inhaleBlockedUntil = 0;
    p.stopInhale(now); p.steer(0, 0); p.aimAt(0, 0);
    return p;
  }
  private npc(role: string, gems: number, x: number, y: number): PlayerSchema {
    const id = `practice-${this.view.lesson}-${role}-${this.view.attempt}`;
    const p = new PlayerSchema(id, this.state.nextPlayerIndex++);
    p.name = role === 'ammo' ? 'Ammunition' : role === 'attacker' ? 'Practice pursuer' : role === 'soft-contact' ? 'Soft body' : 'Practice rival';
    p.isBot = true; p.setGems(gems, this.state.worldWidth, this.state.worldHeight);
    p.placeAt(x - p.width / 2, y - p.height / 2); p.dropProtection();
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
    p.stopInhale(now); p.captureNeedsRelease = false;
  }
  private setup(now: number, carry = false): void {
    const lesson = this.view.lesson as PracticeLesson, stage = PRACTICE_STAGES[lesson][this.view.passed];
    if (!stage || !this.learner) return;
    this.view.phase = 'setup'; this.view.attempt++; this.view.stage = stage; this.view.cue = '';
    this.stageStartedAt = now; this.successAt = this.resetAt = this.aimedSince = this.puffAt = 0;
    this.shotStarted = this.rearBroken = this.waitForRespawn = false; this.respawnSeenAt = 0;
    const fresh = !carry || lesson === 'defense' || (lesson === 'combat' && stage === 'wound');
    if (fresh) { this.view.resetSerial++; this.clearScene(now); }
    let p = this.learner;
    if (lesson === 'basics') {
      if (stage === 'grow') {
        p = this.resetLearner(0, now);
        this.npc('soft-contact', 0, PRACTICE_ARENA.x + 25, PRACTICE_ARENA.y + 18);
        for (let i = 0; i < 4; i++) {
          const gem = new GemSchema(PRACTICE_ARENA.x + 130 + i * 28, PRACTICE_ARENA.y); gem.value = 10;
          this.state.gems.set(`practice-gem-${this.view.attempt}-${i}`, gem);
        }
        this.state.fieldGems = 4; this.objective('gem', '', PRACTICE_ARENA.x + 130, PRACTICE_ARENA.y);
      } else {
        if (carry) this.clearScene(now);
        p = this.resetLearner(40, now); this.view.resetSerial++;
        const ammo = this.npc('ammo', 12, p.x + p.width + 65, p.y + p.height / 2);
        this.ammoId = ammo.sessionId; this.objective('player', this.ammoId);
      }
    } else if (lesson === 'combat') {
      if (stage === 'aim' || stage === 'shatter') {
        if (!carry || !p.gulping) { p = this.resetLearner(40, now); this.preload(p, 12, now); }
        if (stage === 'aim' || !carry) {
          const target = this.npc('smaller-rival', 20, p.x + p.width / 2 + 280, p.y + p.height / 2 - 280);
          this.targetId = target.sessionId;
        }
        if (stage === 'shatter' && !carry) { p.facing = -Math.PI / 4; p.spin = 0; p.aimAt(1, -1); }
        this.objective('player', this.targetId);
      } else if (stage === 'wound') {
        p = this.resetLearner(40, now); this.preload(p, 12, now);
        const target = this.npc('near-rival', 75, p.x + p.width / 2 + 230, p.y + p.height / 2);
        this.targetId = target.sessionId; this.objective('player', this.targetId);
      } else {
        if (!carry) {
          p = this.resetLearner(this.finishBank.gems, now);
          const target = this.npc('injured-rival', this.finishBank.targetGems, p.x + p.width / 2 + (stage === 'approach' ? 245 : 175), p.y + p.height / 2);
          target.injure(this.state.time); this.targetId = target.sessionId;
        }
        this.theftStart = this.state.players.get(this.targetId)?.robbedTotal ?? 0;
        this.objective('player', this.targetId);
      }
    } else if (lesson === 'blackhole') {
      if (stage === 'capture') {
        p = this.resetLearner(250, now);
        const ammo = this.npc('ammo', 100, p.x + p.width + 65, p.y + p.height / 2);
        this.ammoId = ammo.sessionId; this.objective('player', this.ammoId);
      } else {
        if (!carry || !p.gulping) { p = this.resetLearner(250, now); this.preload(p, 100, now); }
        this.state.blackHoles.push(new BlackHoleSchema(BLACK_HOLE_LESSON.x, BLACK_HOLE_LESSON.y, 64, 0));
        this.objective('hole', '', BLACK_HOLE_LESSON.x, BLACK_HOLE_LESSON.y);
      }
    } else if (lesson === 'weapon') {
      if (stage === 'collect' || !carry) {
        p = this.resetLearner(40, now); this.state.weaponsOn = true;
        spawnWeapon(this.state, PRACTICE_ARENA.x + 140, PRACTICE_ARENA.y, 'pulsar');
        let i = 0;
        for (const part of this.state.pinwheel.parts) { part.x = PRACTICE_ARENA.x + 110 + i * 48; part.y = PRACTICE_ARENA.y + (i - 1) * 86; i++; }
        if (stage !== 'collect') {
          for (const part of this.state.pinwheel.parts) { part.x = p.x + p.width / 2; part.y = p.y + p.height / 2; }
          updateWeapons(this.state, .001, now);
        }
      }
      this.state.weaponsOn = true;
      if (stage === 'effect') {
        const w = this.state.pinwheel; if (!carry) deployWeapon(this.state, p);
        const target = this.npc('weapon-target', 60, w.x + 180, w.y);
        this.targetId = target.sessionId; this.objective('player', this.targetId);
      } else {
        const part = this.state.pinwheel.parts[0];
        this.objective(stage === 'collect' ? 'parts' : 'placement', '', part?.x ?? 0, part?.y ?? 0);
      }
    } else {
      p = this.resetLearner(100, now);
      // Leave room above and below for portrait framing, including expanded injury help.
      p.placeAt(p.x + 100, this.state.worldHeight / 2 - p.height / 2);
      const attacker = this.npc('attacker', stage === 'rear-cover' ? 100 : 180, p.x + p.width / 2 - (stage === 'rear-cover' ? 185 : 480), p.y + p.height / 2);
      attacker.facing = 0; this.targetId = attacker.sessionId;
      this.objective('player', this.targetId);
      this.startX = p.x + p.width / 2; this.startY = p.y + p.height / 2;
      this.view.cue = 'warning';
      if (!this.readied.has(lesson + '/' + stage)) { this.view.phase = 'ready'; this.lastActivity = now; return; }
      if (stage === 'injured-escape') { p.injure(this.state.time); this.injuryEndsAt = p.injuredUntil; this.view.cue = 'injured'; }
    }
    this.view.phase = 'waiting'; this.lastActivity = now;
  }
  private rememberFinish(): void {
    const p = this.learner, target = this.state.players.get(this.targetId);
    if (p && target) this.finishBank = { gems: p.gems, targetGems: target.gems };
  }
  private success(now: number, feedback = 'That worked.'): void {
    if (!this.acting) return;
    this.view.phase = 'success'; this.view.feedback = feedback; this.successAt = now; this.lastActivity = now;
    this.progress.set(this.view.lesson as PracticeLesson, this.view.passed + 1);
  }
  private fail(now: number, feedback: string): void {
    if (!this.acting) return;
    this.view.phase = 'reset'; this.view.failures++; this.view.feedback = feedback; this.resetAt = now;
    const p = this.learner, attacker = this.state.players.get(this.targetId);
    p?.stopInhale(now); p?.steer(0, 0);
    attacker?.stopInhale(now); attacker?.steer(0, 0);
    this.waitForRespawn = p?.state !== 'alive'; this.respawnSeenAt = 0; this.lastActivity = now;
  }
  observe(type: string, data: Record<string, unknown>, now: number, attempt = this.view.attempt): void {
    if (attempt !== this.view.attempt || !this.acting) return;
    const own = data.byId === this.learnerId, lesson = this.view.lesson, stage = this.view.stage;
    if ((lesson === 'basics' || lesson === 'blackhole') && stage === 'capture' && type === 'capture' && own && data.targetId === this.ammoId) this.success(now, 'Captured. Your full cheeks mean a shot is ready.');
    if ((lesson === 'combat' || lesson === 'blackhole') && type === 'launch' && own && data.id === this.ammoId) {
      this.shotStarted = true;
      if (stage === 'aim') this.fail(now, 'Aim at the outlined rival before firing. Your shot is restored.');
    }
    if (lesson === 'combat') {
      if (stage === 'shatter' && type === 'combatReward' && own && data.targetId === this.targetId && data.how === 'cannon') this.success(now, 'Shattered! A landed shot finishes a rival when you are at least 20% wider.');
      if (stage === 'wound' && type === 'impact' && own && data.projectileId === this.ammoId && data.targetId === this.targetId && Number(data.gems) > 0) {
        if (data.out === true) this.fail(now, 'This attempt needs a surviving injured rival. Your shot is restored.');
        else { this.rememberFinish(); this.success(now, 'The split shell and worried eyes show an injury.'); }
      }
      if (['approach', 'steal', 'finish'].includes(stage) && type === 'combatReward' && own && data.targetId === this.targetId && data.how === 'mouth') {
        // Skilled learners can demonstrate approach, theft and finish in one continuous action.
        this.view.passed = PRACTICE_STAGES.combat.length - 1;
        this.success(now, 'Finished at the mouth. Their remaining gems are yours.');
      }
    } else if (lesson === 'blackhole' && stage === 'shoot' && type === 'combatReward' && own && data.targetId === this.ammoId && data.how === 'blackhole') {
      this.success(now, 'Watch their gems return to you.');
    } else if (lesson === 'weapon') {
      if (stage === 'collect' && type === 'weaponAssembled' && own && this.state.pinwheel.owner === this.learnerId && this.state.pinwheel.phase === 'carried') this.success(now, 'Assembled. Place it when you are ready.');
      if (stage === 'place' && type === 'weaponPlaced' && own && this.state.pinwheel.owner === this.learnerId && this.state.pinwheel.phase === 'charging') this.success(now, 'Placed. It charges and fires automatically.');
      if (stage === 'effect' && type === 'credit' && own && data.targetId === this.targetId && data.how === 'pulsar' && Number(data.gems) > 0) this.success(now, 'Your weapon hit the marked rival.');
    } else if (lesson === 'defense' && stage === 'rear-cover') {
      if (type === 'exhale' && data.id === this.learnerId) { this.puffAt = now; this.view.phase = 'resolving'; this.view.cue = 'wrapping'; }
      const wave = this.state.gustWaves.get(this.learnerId);
      if (type === 'parry' && data.id === this.learnerId && data.targetId === this.targetId && wave && waveActive(wave, this.state.time)) {
        this.rearBroken = true; this.view.cue = 'move-clear'; this.view.feedback = 'Rear cover broke suction. Keep moving!';
      }
    }
  }
  beforeTick(now: number): void {
    if (!this.connected || !this.learner || !this.acting || this.view.lesson !== 'defense') return;
    const attacker = this.state.players.get(this.targetId), p = this.learner;
    if (!attacker || attacker.state !== 'alive') return;
    const dx = p.x + p.width / 2 - attacker.x - attacker.width / 2, dy = p.y + p.height / 2 - attacker.y - attacker.height / 2;
    const d = Math.hypot(dx, dy);
    attacker.aimAt(dx, dy);
    attacker.steer(d > p.width + 50 ? dx / Math.max(1, d) : 0, d > p.width + 50 ? dy / Math.max(1, d) : 0);
    if (now - this.stageStartedAt >= 800 && !this.rearBroken && !attacker.inhaling) {
      attacker.startInhale(now);
      if (this.view.cue === 'warning') this.view.cue = 'attacking';
    }
  }
  afterTick(now: number): void {
    if (!this.connected || !this.learner) return;
    const p = this.learner, lesson = this.view.lesson as PracticeLesson, stage = this.view.stage;
    if (this.view.phase === 'complete' && this.view.sequence && now - this.lastActivity >= 1400) {
      const next = PRACTICE_LESSONS[PRACTICE_LESSONS.indexOf(lesson) + 1];
      if (next) this.select(next, true, now, true, lesson === 'basics' && !!p.gulping);
      return;
    }
    if (this.view.phase === 'success' && lesson === 'combat' && (stage === 'wound' || stage === 'shatter')) {
      const spent = this.state.players.get(this.ammoId);
      if (spent && !spent.capturedBy) { clearCapture(this.state, spent.sessionId, now); this.state.players.delete(spent.sessionId); }
    }
    if (this.view.phase === 'reset') {
      if (this.waitForRespawn) {
        if (p.state !== 'alive') return;
        if (!this.respawnSeenAt) { this.respawnSeenAt = now; this.view.feedback = 'Back in clear space. This step will try again.'; }
        if (now - this.respawnSeenAt < 650) return;
      }
      if (now - this.resetAt >= 100) this.setup(now);
      return;
    }
    if (this.view.phase === 'success') {
      // Approach/theft are one continuous action; pausing their cues would waste the real injury window.
      const delay = lesson === 'blackhole' && stage === 'shoot' ? BLACK_HOLE_LESSON.rewardMs : stage === 'shatter' ? 1200 : ['approach', 'steal'].includes(stage) ? 0 : 650;
      if (now - this.successAt < delay) return;
      const next = this.progress.get(lesson) ?? 0;
      if (next >= PRACTICE_STAGES[lesson].length) {
        this.completed.add(lesson); this.view.completed = [...this.completed].join(','); this.view.phase = 'complete';
        if (!(lesson === 'basics' && this.view.sequence && p.gulping)) { this.clearScene(now); this.objective(''); }
        this.lastActivity = now; return;
      }
      this.view.passed = next; this.view.failures = 0; this.view.feedback = '';
      if (lesson === 'combat' && ['wound', 'approach', 'steal'].includes(stage)) this.rememberFinish();
      this.setup(now, true); return;
    }
    if (!this.acting) return;
    if (p.state !== 'alive') { this.fail(now, 'Caught. You will respawn in clear space, then retry this step.'); return; }
    const woundedEscape = lesson === 'defense' && stage === 'injured-escape';
    if (!woundedEscape && injuryVulnerable(this.state, p, now)) { this.fail(now, 'You were injured. Only this attempt will restart.'); return; }
    const target = this.state.players.get(this.targetId), ammo = this.state.players.get(this.ammoId);
    if (lesson === 'basics' && stage === 'grow') {
      const first = this.state.gems.values().next().value;
      if (first) this.objective('gem', '', first.x, first.y);
      if (!this.state.gems.size) {
        if (p.gems >= 40) this.success(now, 'Grown. Soft contact lets you keep moving.');
        else this.fail(now, 'The soft body reached some gems. A fresh trail is ready; go around it.');
      }
    } else if (stage === 'capture') {
      if (!ammo || ammo.state !== 'alive') this.fail(now, 'The practice rival is being replaced.');
    } else if (lesson === 'combat' && stage === 'aim') {
      if (!ammo?.capturedBy) { this.fail(now, 'Your captive escaped. A fresh practice shot is ready.'); return; }
      if (target) {
        const angle = Math.atan2(target.y + target.height / 2 - p.y - p.height / 2, target.x + target.width / 2 - p.x - p.width / 2);
        const error = Math.abs(Math.atan2(Math.sin(angle - p.facing), Math.cos(angle - p.facing)));
        if (error <= .10) { if (!this.aimedSince) this.aimedSince = now; if (now - this.aimedSince >= 250) this.success(now, 'Aimed. Release your aim, then fire.'); }
        else this.aimedSince = 0;
      }
    } else if (stage === 'shoot' || (lesson === 'combat' && ['shatter', 'wound'].includes(stage))) {
      if (!ammo || ammo.state !== 'alive' || (!ammo.capturedBy && !ammo.flying) || (this.shotStarted && !ammo.flying)) this.fail(now, 'The shot missed or the captive escaped. Your shot is restored.');
    } else if (lesson === 'combat') {
      if (!target || target.state !== 'alive') { this.fail(now, 'Drained! Now try the mouth finish: move closer while inhaling.'); return; }
      if (!injuryVulnerable(this.state, target, now)) { this.fail(now, 'The shell healed. A fresh injured rival is ready for this step.'); return; }
      const distance = Math.hypot(target.x + target.width / 2 - p.x - p.width / 2, target.y + target.height / 2 - p.y - p.height / 2);
      if (now < target.suctionSafeUntil) this.view.cue = 'recovering'; else if (this.view.cue === 'recovering') this.view.cue = '';
      if (stage === 'approach' && distance <= 220) this.success(now, 'Close enough. Inhale to steal exposed gems.');
      if (stage === 'steal' && target.robbedTotal >= this.theftStart + 5 && p.gems > this.finishBank.gems) this.success(now, 'Theft shrinks the rival and grows you. Move in for the finish.');
    } else if (lesson === 'weapon') {
      const w = this.state.pinwheel;
      if (stage === 'collect') { const part = w.parts.find(part => part.carriedBy !== this.learnerId); if (part) this.objective('parts', '', part.x, part.y); }
      else if ((stage === 'place' && w.phase !== 'carried') || (stage === 'effect' && (!target || w.phase === 'waiting'))) this.fail(now, 'Your assembled weapon is being restored for this step.');
    } else if (lesson === 'defense') {
      const moved = Math.hypot(p.x + p.width / 2 - this.startX, p.y + p.height / 2 - this.startY);
      if (stage === 'rear-cover') {
        if (this.rearBroken && moved >= 145 && target && !target.inhaling) this.success(now, 'Escaped. The fixed wall gave you room to move.');
        else if (this.puffAt && now - this.puffAt > EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_HOLD_MS + 500 && !this.rearBroken) this.fail(now, 'The wave did not break rear suction. Keep facing away and tap while fleeing.');
        else if (now - this.stageStartedAt > 9000) this.fail(now, 'Use a quick tap for a puff, then keep moving clear.');
      } else if (this.state.time >= this.injuryEndsAt && !injuryVulnerable(this.state, p, now) && moved >= 180) this.success(now, 'Recovered. The shell closed and breathing is available again.');
    }
  }
  shouldClose(now: number): boolean {
    return now - this.lastActivity > (['complete', 'choosing', 'finished'].includes(this.view.phase) ? PRACTICE_ARENA.finishedMs : PRACTICE_ARENA.idleMs);
  }
}
