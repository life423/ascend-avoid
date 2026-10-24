import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { BotBrain } from "../game/bots.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { CANNON } from "../constants/gameConstants.js";
import { escapePress, fireCaptive } from "./inhale.js";

const { PLAYER_STATE, BOTS, INHALE, BOMBS } = GAME_CONSTANTS;

/**
 * Bots swallow smaller creatures, pick up bombs, and spit them at a good target: someone big,
 * slow, or rooted while inhaling. A lit bomb in the mouth goes straight back out.
 */
export function botMouth(state: GameState, bot: PlayerSchema, now: number) : void {
  if (bot.state !== PLAYER_STATE.ALIVE || bot.sliding || bot.recovering) return;
  if (bot.capturedBy) {
    botEscape(state, bot, now);
    return;
  }
  const cx = bot.x + bot.width / 2;
  const cy = bot.y + bot.height / 2;
  if (bot.gulping) {
    botFire(state, bot, cx, cy, now);
    return;
  }
  if (bot.mouth) {
    let target: PlayerSchema | null = null;
    let best = -Infinity;
    state.players.forEach((other) => {
      if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
      const d = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
      if (d < 140 || d > 360) return;
      const score = other.width + (other.inhaling ? 60 : 0) - d * 0.1;
      if (score > best) {
        best = score;
        target = other;
      }
    });
    const aim = target as PlayerSchema | null;
    if (bot.mouth === "lit") {
      state.spit(bot, aim ? aim.x + aim.width / 2 - cx : Math.cos(bot.facing), aim ? aim.y + aim.height / 2 - cy : Math.sin(bot.facing), now);
    } else if (aim && Math.random() < 0.03) {
      state.spit(bot, aim.x + aim.width / 2 - cx + (Math.random() - 0.5) * 60, aim.y + aim.height / 2 - cy + (Math.random() - 0.5) * 60, now);
    }
    return;
  }
  // Inhaling: keep the mouth on whoever it's robbing or swallowing for as long as its breath lasts,
  // and let go once nobody has been in its inhale for a moment (saving its breath)
  if (bot.inhaling) {
    const held = bot.stealingFrom ? state.players.get(bot.stealingFrom) : undefined;
    if (held) {
      bot.aimAt(held.x + held.width / 2 - cx, held.y + held.height / 2 - cy);
      bot.inhaleIdleSince = 0;
    } else if (!bot.inhaleIdleSince) {
      bot.inhaleIdleSince = now;
    } else if (now - bot.inhaleIdleSince > 700) {
      bot.stopInhale(now);
      bot.inhaleIdleSince = 0;
    }
    return;
  }
  if (Math.random() > 0.12) return;
  // Someone stealing from this bot: it runs from a robber its size or bigger (its brain sees to that)
  // and often inhales back as it goes; a smaller robber is faster, so it turns and fights
  let thief: PlayerSchema | null = null;
  state.players.forEach((other) => {
    if (other.robbing.split(",").includes(bot.sessionId)) thief = other;
  });
  const robber = thief as PlayerSchema | null;
  if (robber) {
    if (Math.random() < 0.8) {
      bot.startInhale(now, INHALE.MAX_MS);
      bot.aimAt(robber.x + robber.width / 2 - cx, robber.y + robber.height / 2 - cy);
    }
    return;
  }
  const reach = INHALE.REACH + bot.width * INHALE.REACH_PER_SIZE;
  let want: { x: number; y: number } | null = null;
  let nearest = reach;
  state.players.forEach((other) => {
    if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.width * INHALE.EAT_RATIO > bot.width) return;
    const d = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
    if (d < nearest) {
      nearest = d;
      want = { x: other.x + other.width / 2, y: other.y + other.height / 2 };
    }
  });
  // Nothing to swallow: rob anyone in reach (they can rob back)
  state.players.forEach((other) => {
    if (want || other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.gems < 1) return;
    const ox = other.x + other.width / 2;
    const oy = other.y + other.height / 2;
    const d = Math.hypot(ox - cx, oy - cy);
    if (d - other.width / 2 > reach + bot.width * 0.3) return;
    want = { x: ox, y: oy };
  });
  state.bombs.forEach((bomb) => {
    if (bomb.heldBy || bomb.respawnAt || bomb.lit()) return;
    const d = Math.hypot(bomb.x - cx, bomb.y - cy);
    if (d < Math.min(nearest, 170)) {
      nearest = d;
      want = { x: bomb.x, y: bomb.y };
    }
  });
  const goal = want as { x: number; y: number } | null;
  if (!goal) return;
  // As long as its breath lasts (it lets go once nobody is in its inhale)
  bot.inhaleIdleSince = 0;
  bot.startInhale(now, INHALE.MAX_MS);
  bot.aimAt(goal.x - cx, goal.y - cy);
}

/** Which way a bot should run to get clear of a lit bomb about to go off (null when it's safe) */
export function bombDanger(state: GameState, bot: PlayerSchema) : { x: number; y: number } | null {
  const cx = bot.x + bot.width / 2;
  const cy = bot.y + bot.height / 2;
  let escape: { x: number; y: number } | null = null;
  state.bombs.forEach((bomb) => {
    if (escape || !bomb.lit() || bomb.heldBy || bomb.respawnAt) return;
    const d = Math.hypot(cx - bomb.x, cy - bomb.y);
    if (d > BOMBS.BLAST_RADIUS + bot.width / 2 + 40 || bomb.explodesAt - state.time > 1600) return;
    escape = d > 1e-6 ? { x: (cx - bomb.x) / d, y: (cy - bomb.y) / d } : { x: 1, y: 0 };
  });
  return escape as { x: number; y: number } | null;
}

/** Keep the world lively: bots fill in until `botFill` are playing, and make room as people arrive */
export function balanceBots(state: GameState, now: number) : void {
  let people = 0;
  state.players.forEach((player) => {
    if (!player.isBot) people++;
  });
  const wanted = people === 0 ? 0 : Math.max(0, state.botFill - people);
  while (state.brains.size < wanted) addBot(state, now);
  while (state.brains.size > wanted) removeBot(state);
}

export function addBot(state: GameState, now: number) : void {
  const id = `bot-${state.nextBotId++}`;
  const taken = new Set<string>();
  state.players.forEach((player) => taken.add(player.name));
  const free = BOTS.NAMES.filter((name) => !taken.has(name));
  const bot = new PlayerSchema(id, state.nextPlayerIndex++);
  bot.name = free.length > 0 ? free[Math.floor(Math.random() * free.length)] : `Bot ${state.nextBotId}`;
  bot.isBot = true;
  state.players.set(id, bot);
  state.brains.set(id, new BotBrain());
  state.spawn(bot, now);
}

/**
 * Holding someone (its mouth full, button or no button): the bot heads for the best target in range (bigger is
 * better, nearer is better), which turns it to face them, and fires once it's lined up; with nobody to aim at
 * for a while, it fires straight ahead
 */
function botFire(state: GameState, bot: PlayerSchema, cx: number, cy: number, now: number) : void {
  const captive = state.players.get(bot.gulping);
  if (!captive) return;
  let target: PlayerSchema | null = null;
  let best = -Infinity;
  state.players.forEach((other) => {
    if (other === bot || other === captive || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.capturedBy || other.flying) return;
    const d = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
    if (d > BOTS.FIRE_RANGE) return;
    const score = other.width - d * 0.05;
    if (score > best) {
      best = score;
      target = other;
    }
  });
  const aim = target as PlayerSchema | null;
  const held = now - bot.captureStartedAt;
  if (aim) {
    const dx = aim.x + aim.width / 2 - cx;
    const dy = aim.y + aim.height / 2 - cy;
    const d = Math.hypot(dx, dy) || 1;
    bot.steer(dx / d, dy / d);
    if (held >= CANNON.ARM_MS && Math.abs(angleGap(bot.facing, Math.atan2(dy, dx))) <= BOTS.FIRE_AIM) fireCaptive(state, bot, now);
  } else if (held >= Math.max(CANNON.ARM_MS, BOTS.FIRE_WAIT_MS)) {
    fireCaptive(state, bot, now);
  }
}

/** Caught: dazed at first, then it tries a direction every ESCAPE_EVERY_MS, the right one ESCAPE_SKILL of the time */
function botEscape(state: GameState, bot: PlayerSchema, now: number) : void {
  if (state.time < bot.dazedUntil || now < bot.escapeTryAt || bot.escapeStep >= bot.escapeKeys.length) return;
  bot.escapeTryAt = now + BOTS.ESCAPE_EVERY_MS;
  const right = bot.escapeKeys[bot.escapeStep];
  const wrong = "UDLR".replace(right, "");
  escapePress(state, bot, Math.random() < BOTS.ESCAPE_SKILL ? right : wrong[Math.floor(Math.random() * wrong.length)]);
}

/** The shortest turn from one angle to another, in radians (signed) */
function angleGap(from: number, to: number) : number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The bot with the fewest gems leaves */
export function removeBot(state: GameState) : void {
  const pick = { id: "", gems: Infinity };
  state.brains.forEach((_, id) => {
    const gems = state.players.get(id)?.gems ?? 0;
    if (gems < pick.gems) {
      pick.id = id;
      pick.gems = gems;
    }
  });
  state.brains.delete(pick.id);
  state.players.delete(pick.id);
}
